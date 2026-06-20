from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection

router = APIRouter(prefix="/api/ink-outward", tags=["ink-outward"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class InkOutwardItemInput(BaseModel):
    item_type: str
    category: str
    color: Optional[str] = None
    pantone_number: Optional[str] = None
    varnish_type: Optional[str] = None
    containers_issued: int
    weight_per_container: float

    @model_validator(mode="after")
    def validate_item(self):
        if self.item_type not in ("UV Ink", "Conventional Ink"):
            raise ValueError("item_type must be UV Ink or Conventional Ink")
        if self.category not in ("Ink", "Varnish"):
            raise ValueError("category must be Ink or Varnish")
        if self.containers_issued <= 0:
            raise ValueError("containers_issued must be > 0")
        if self.weight_per_container <= 0:
            raise ValueError("weight_per_container must be > 0")
        if self.category == "Ink" and not self.color:
            raise ValueError("color is required for Ink")
        if self.category == "Varnish" and not self.varnish_type:
            raise ValueError("varnish_type is required for Varnish")
        return self

    @property
    def total_weight(self) -> float:
        return round(self.containers_issued * self.weight_per_container, 2)


class InkOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    job_name: Optional[str] = None
    job_card_number: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[InkOutwardItemInput]
    force_adjustment: bool = False

    @model_validator(mode="after")
    def validate_body(self):
        if not self.items:
            raise ValueError("At least one ink/varnish item is required")
        return self


class InkOutwardUpdate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    job_name: Optional[str] = None
    job_card_number: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class DeleteRequest(BaseModel):
    password: str


# ─── Stock helpers ────────────────────────────────────────────────────────────

def _nc(col: str, val) -> tuple:
    """NULL-safe condition: returns (sql_fragment, [params])."""
    if val is not None and str(val).strip():
        return f"{col} = %s", [val]
    return f"{col} IS NULL", []


def _available_stock(cursor, item_type: str, category: str, color, pantone_number, varnish_type) -> float:
    color_i, color_ip = _nc("ivi.color", color)
    pn_i, pn_ip = _nc("ivi.pantone_number", pantone_number)
    vt_i, vt_ip = _nc("ivi.varnish_type", varnish_type)

    color_a, color_ap = _nc("adj.color", color)
    pn_a, pn_ap = _nc("adj.pantone_number", pantone_number)
    vt_a, vt_ap = _nc("adj.varnish_type", varnish_type)

    color_o, color_op = _nc("ioi.color", color)
    pn_o, pn_op = _nc("ioi.pantone_number", pantone_number)
    vt_o, vt_op = _nc("ioi.varnish_type", varnish_type)

    cursor.execute(f"""
        SELECT
            COALESCE((
                SELECT SUM(ivi.item_total_weight)
                FROM InkVarnishItems ivi
                WHERE ivi.item_type = %s AND ivi.category = %s
                AND {color_i} AND {pn_i} AND {vt_i}
            ), 0)
            + COALESCE((
                SELECT SUM(adj.quantity_kg)
                FROM InkAdjustmentEntries adj
                WHERE adj.item_type = %s AND adj.category = %s
                AND {color_a} AND {pn_a} AND {vt_a}
            ), 0)
            - COALESCE((
                SELECT SUM(ioi.total_weight_issued)
                FROM InkOutwardItems ioi
                WHERE ioi.item_type = %s AND ioi.category = %s
                AND {color_o} AND {pn_o} AND {vt_o}
            ), 0)
    """,
        [item_type, category] + color_ip + pn_ip + vt_ip
        + [item_type, category] + color_ap + pn_ap + vt_ap
        + [item_type, category] + color_op + pn_op + vt_op,
    )
    return float(cursor.fetchone()[0] or 0)


def _check_shortages(cursor, items: List[InkOutwardItemInput], exclude_outward_id: Optional[int] = None) -> list:
    shortages = []
    for item in items:
        available = _available_stock(
            cursor, item.item_type, item.category,
            item.color, item.pantone_number, item.varnish_type,
        )
        if exclude_outward_id:
            color_o, color_op = _nc("ioi.color", item.color)
            pn_o, pn_op = _nc("ioi.pantone_number", item.pantone_number)
            vt_o, vt_op = _nc("ioi.varnish_type", item.varnish_type)
            cursor.execute(f"""
                SELECT COALESCE(SUM(ioi.total_weight_issued), 0)
                FROM InkOutwardItems ioi
                WHERE ioi.outward_id = %s AND ioi.item_type = %s AND ioi.category = %s
                AND {color_o} AND {pn_o} AND {vt_o}
            """, [exclude_outward_id, item.item_type, item.category] + color_op + pn_op + vt_op)
            available += float(cursor.fetchone()[0] or 0)

        if available < item.total_weight:
            shortages.append({
                "item_type": item.item_type,
                "category": item.category,
                "color": item.color,
                "pantone_number": item.pantone_number,
                "varnish_type": item.varnish_type,
                "available_kg": round(available, 2),
                "requested_kg": item.total_weight,
                "shortage_kg": round(item.total_weight - available, 2),
            })
    return shortages


def _insert_items_and_adjustments(cursor, outward_id: int, items: List[InkOutwardItemInput], shortages: list):
    def _shortage_key(s):
        return (s["item_type"], s["category"], s["color"], s["pantone_number"], s["varnish_type"])

    shortage_map = {_shortage_key(s): s for s in shortages}

    for item in items:
        cursor.execute("""
            INSERT INTO InkOutwardItems
                (outward_id, item_type, category, color, pantone_number, varnish_type,
                 containers_issued, weight_per_container, total_weight_issued)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (outward_id, item.item_type, item.category, item.color, item.pantone_number,
              item.varnish_type, item.containers_issued, item.weight_per_container, item.total_weight))

        key = (item.item_type, item.category, item.color, item.pantone_number, item.varnish_type)
        if key in shortage_map:
            s = shortage_map[key]
            cursor.execute("""
                INSERT INTO InkAdjustmentEntries
                    (outward_id, item_type, category, color, pantone_number, varnish_type, quantity_kg, reason)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (outward_id, item.item_type, item.category, item.color, item.pantone_number,
                  item.varnish_type, s["shortage_kg"],
                  f"Auto-created due to outward stock shortage. Ink Outward ID: {outward_id}"))


def _fetch_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT o.id, o.outward_date, o.outward_time, o.job_name, o.job_card_number, "
        "o.issued_by, o.received_by, o.remarks, o.created_at, o.created_by, u.username "
        "FROM InkOutward o LEFT JOIN Users u ON o.created_by = u.id WHERE o.id = %s",
        (outward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Ink Outward entry not found")

    cursor.execute(
        "SELECT id, item_type, category, color, pantone_number, varnish_type, "
        "containers_issued, weight_per_container, total_weight_issued "
        "FROM InkOutwardItems WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    items = [
        {
            "id": r[0], "item_type": r[1], "category": r[2],
            "color": r[3], "pantone_number": r[4], "varnish_type": r[5],
            "containers_issued": r[6],
            "weight_per_container": float(r[7]),
            "total_weight_issued": float(r[8]),
        }
        for r in cursor.fetchall()
    ]

    cursor.execute(
        "SELECT id, item_type, category, color, pantone_number, varnish_type, "
        "quantity_kg, reason, created_at FROM InkAdjustmentEntries WHERE outward_id = %s",
        (outward_id,),
    )
    adjustments = [
        {
            "id": r[0], "item_type": r[1], "category": r[2],
            "color": r[3], "pantone_number": r[4], "varnish_type": r[5],
            "quantity_kg": float(r[6]), "reason": r[7],
            "created_at": r[8].isoformat() if r[8] else None,
        }
        for r in cursor.fetchall()
    ]

    conn.close()
    return {
        "id": header[0],
        "outward_date": header[1],
        "outward_time": header[2],
        "job_name": header[3],
        "job_card_number": header[4],
        "issued_by": header[5],
        "received_by": header[6],
        "remarks": header[7],
        "created_at": header[8].isoformat() if header[8] else None,
        "created_by_id": header[9],
        "created_by_name": header[10],
        "items": items,
        "adjustments": adjustments,
    }


def _item_display_label(item_type: str, category: str, color, pantone_number, varnish_type) -> str:
    if category == "Ink":
        label = f"{item_type} — {color}"
        if pantone_number:
            label += f" ({pantone_number})"
    else:
        uv_conv = "UV" if item_type == "UV Ink" else "Conventional"
        label = f"{uv_conv} Varnish — {varnish_type}"
    return label


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            ivi.item_type, ivi.category, ivi.color, ivi.pantone_number, ivi.varnish_type,
            SUM(ivi.item_total_weight)
            + COALESCE((
                SELECT SUM(adj.quantity_kg)
                FROM InkAdjustmentEntries adj
                WHERE adj.item_type = ivi.item_type AND adj.category = ivi.category
                AND (adj.color = ivi.color OR (adj.color IS NULL AND ivi.color IS NULL))
                AND (adj.pantone_number = ivi.pantone_number OR (adj.pantone_number IS NULL AND ivi.pantone_number IS NULL))
                AND (adj.varnish_type = ivi.varnish_type OR (adj.varnish_type IS NULL AND ivi.varnish_type IS NULL))
            ), 0)
            - COALESCE((
                SELECT SUM(ioi.total_weight_issued)
                FROM InkOutwardItems ioi
                WHERE ioi.item_type = ivi.item_type AND ioi.category = ivi.category
                AND (ioi.color = ivi.color OR (ioi.color IS NULL AND ivi.color IS NULL))
                AND (ioi.pantone_number = ivi.pantone_number OR (ioi.pantone_number IS NULL AND ivi.pantone_number IS NULL))
                AND (ioi.varnish_type = ivi.varnish_type OR (ioi.varnish_type IS NULL AND ivi.varnish_type IS NULL))
            ), 0) AS available_weight_kg,
            COALESCE((
                SELECT SUM(ivbg.number_of_boxes * ivbg.containers_per_box)
                FROM InkVarnishBoxGroups ivbg
                JOIN InkVarnishItems ivi2 ON ivi2.id = ivbg.item_id
                WHERE ivi2.item_type = ivi.item_type AND ivi2.category = ivi.category
                AND (ivi2.color = ivi.color OR (ivi2.color IS NULL AND ivi.color IS NULL))
                AND (ivi2.pantone_number = ivi.pantone_number OR (ivi2.pantone_number IS NULL AND ivi.pantone_number IS NULL))
                AND (ivi2.varnish_type = ivi.varnish_type OR (ivi2.varnish_type IS NULL AND ivi.varnish_type IS NULL))
            ), 0)
            - COALESCE((
                SELECT SUM(ioi.containers_issued)
                FROM InkOutwardItems ioi
                WHERE ioi.item_type = ivi.item_type AND ioi.category = ivi.category
                AND (ioi.color = ivi.color OR (ioi.color IS NULL AND ivi.color IS NULL))
                AND (ioi.pantone_number = ivi.pantone_number OR (ioi.pantone_number IS NULL AND ivi.pantone_number IS NULL))
                AND (ioi.varnish_type = ivi.varnish_type OR (ioi.varnish_type IS NULL AND ivi.varnish_type IS NULL))
            ), 0) AS available_containers
        FROM InkVarnishItems ivi
        GROUP BY ivi.item_type, ivi.category, ivi.color, ivi.pantone_number, ivi.varnish_type
        ORDER BY ivi.item_type, ivi.category, ivi.color, ivi.varnish_type
    """)
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "item_type": r[0], "category": r[1], "color": r[2],
            "pantone_number": r[3], "varnish_type": r[4],
            "available_weight_kg": round(float(r[5] or 0), 2),
            "available_containers": int(r[6] or 0),
        }
        for r in rows
    ]


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def _stats(where_sql: str, params: list) -> dict:
        cursor.execute(f"""
            SELECT COUNT(DISTINCT io.id),
                COALESCE(SUM(CASE WHEN ioi.category = 'Ink' THEN ioi.total_weight_issued ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN ioi.category = 'Varnish' THEN ioi.total_weight_issued ELSE 0 END), 0)
            FROM InkOutward io
            LEFT JOIN InkOutwardItems ioi ON ioi.outward_id = io.id
            {where_sql}
        """, params)
        r = cursor.fetchone()
        return {
            "total_entries": r[0],
            "total_ink_kg": round(float(r[1]), 2),
            "total_varnish_kg": round(float(r[2]), 2),
        }

    today = _stats("WHERE io.outward_date::date = CURRENT_DATE", [])
    month = _stats("WHERE DATE_TRUNC('month', io.outward_date) = DATE_TRUNC('month', CURRENT_DATE)", [])

    cursor.execute("""
        SELECT ioi.color, ioi.pantone_number,
               COALESCE(SUM(ioi.total_weight_issued), 0) AS total_kg
        FROM InkOutwardItems ioi
        WHERE ioi.category = 'Ink'
        GROUP BY ioi.color, ioi.pantone_number
        ORDER BY total_kg DESC
    """)
    color_breakdown = []
    for r in cursor.fetchall():
        label = r[0] or "—"
        if r[1]:
            label += f" ({r[1]})"
        color_breakdown.append({"label": label, "total_kg": round(float(r[2]), 2)})

    cursor.execute("""
        SELECT ioi.item_type, ioi.varnish_type,
               COALESCE(SUM(ioi.total_weight_issued), 0) AS total_kg
        FROM InkOutwardItems ioi
        WHERE ioi.category = 'Varnish'
        GROUP BY ioi.item_type, ioi.varnish_type
        ORDER BY total_kg DESC
    """)
    varnish_breakdown = []
    for r in cursor.fetchall():
        uv_conv = "UV" if r[0] == "UV Ink" else "Conventional"
        label = f"{uv_conv} — {r[1] or 'Varnish'}"
        varnish_breakdown.append({"label": label, "total_kg": round(float(r[2]), 2)})

    cursor.execute("""
        SELECT ioi.item_type, ioi.category, ioi.color, ioi.pantone_number, ioi.varnish_type,
               COALESCE(SUM(ioi.total_weight_issued), 0) AS total_kg
        FROM InkOutwardItems ioi
        GROUP BY ioi.item_type, ioi.category, ioi.color, ioi.pantone_number, ioi.varnish_type
        ORDER BY total_kg DESC
        LIMIT 10
    """)
    top_consumed = []
    for r in cursor.fetchall():
        label = _item_display_label(r[0], r[1], r[2], r[3], r[4])
        top_consumed.append({"label": label, "total_kg": round(float(r[5]), 2)})

    conn.close()
    return {
        "today": today, "month": month,
        "color_breakdown": color_breakdown,
        "varnish_breakdown": varnish_breakdown,
        "top_consumed": top_consumed,
    }


@router.get("/export")
def export_outward(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["1=1"]
    params: list = []
    if date_from:
        where.append("outward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("outward_date <= %s")
        params.append(date_to)
    cursor.execute(
        f"SELECT id FROM InkOutward WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("")
def list_outward(
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    where_clauses: list = []
    params: list = []

    if date_from:
        where_clauses.append("io.outward_date >= %s")
        params.append(date_from)
    if date_to:
        where_clauses.append("io.outward_date <= %s")
        params.append(date_to)
    if search:
        like = f"%{search}%"
        where_clauses.append("""(
            io.job_name ILIKE %s
            OR io.job_card_number ILIKE %s
            OR io.issued_by ILIKE %s
            OR io.received_by ILIKE %s
            OR io.remarks ILIKE %s
            OR TO_CHAR(io.outward_date, 'YYYY-MM-DD') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM InkOutwardItems ioi WHERE ioi.outward_id = io.id
                AND (
                    ioi.item_type ILIKE %s OR ioi.category ILIKE %s
                    OR ioi.color ILIKE %s OR ioi.pantone_number ILIKE %s
                    OR ioi.varnish_type ILIKE %s
                    OR ioi.total_weight_issued::text ILIKE %s
                )
            )
        )""")
        params.extend([like] * 12)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    cursor.execute(f"""
        SELECT io.id, io.outward_date, io.outward_time, io.job_name, io.job_card_number,
               io.issued_by, io.received_by, io.remarks, io.created_at,
               COUNT(ioi.id) AS item_count,
               COALESCE(SUM(ioi.total_weight_issued), 0) AS total_weight
        FROM InkOutward io
        LEFT JOIN InkOutwardItems ioi ON ioi.outward_id = io.id
        {where_sql}
        GROUP BY io.id, io.outward_date, io.outward_time, io.job_name, io.job_card_number,
                 io.issued_by, io.received_by, io.remarks, io.created_at
        ORDER BY io.outward_date DESC, io.id DESC
    """, params)
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT outward_id, item_type, category, color, pantone_number, varnish_type "
            f"FROM InkOutwardItems WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
            ids,
        )
        for ir in cursor.fetchall():
            label = _item_display_label(ir[1], ir[2], ir[3], ir[4], ir[5])
            summaries.setdefault(ir[0], []).append(label)

    conn.close()
    return [
        {
            "id": r[0],
            "outward_date": r[1],
            "outward_time": r[2],
            "job_name": r[3],
            "job_card_number": r[4],
            "issued_by": r[5],
            "received_by": r[6],
            "remarks": r[7],
            "created_at": r[8].isoformat() if r[8] else None,
            "item_count": r[9],
            "total_weight_issued": round(float(r[10]), 2),
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/{outward_id}")
def get_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(outward_id)


@router.post("")
def create_outward(body: InkOutwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        shortages = _check_shortages(cursor, body.items)
        if shortages and not body.force_adjustment:
            conn.close()
            return {"status": "stock_shortage", "shortages": shortages}

        cursor.execute("""
            INSERT INTO InkOutward
                (outward_date, outward_time, job_name, job_card_number,
                 issued_by, received_by, remarks, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            body.outward_date, body.outward_time,
            body.job_name.strip() if body.job_name else None,
            body.job_card_number.strip() if body.job_card_number else None,
            body.issued_by, body.received_by, body.remarks,
            current_user["id"],
        ))
        outward_id = cursor.fetchone()[0]

        _insert_items_and_adjustments(cursor, outward_id, body.items, shortages if body.force_adjustment else [])
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return {"status": "created", "id": outward_id}


@router.put("/{outward_id}")
def update_outward(outward_id: int, body: InkOutwardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT outward_date, outward_time, created_by FROM InkOutward WHERE id = %s", (outward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Ink Outward entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE InkOutward SET outward_date=%s, outward_time=%s, job_name=%s, job_card_number=%s, "
        "issued_by=%s, received_by=%s, remarks=%s WHERE id=%s",
        (body.outward_date, body.outward_time or None,
         body.job_name.strip() if body.job_name else None,
         body.job_card_number.strip() if body.job_card_number else None,
         body.issued_by.strip() if body.issued_by else None,
         body.received_by.strip() if body.received_by else None,
         body.remarks.strip() if body.remarks else None,
         outward_id),
    )
    conn.commit()
    conn.close()
    return _fetch_detail(outward_id)


@router.delete("/{outward_id}")
def delete_outward(outward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM InkOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Ink Outward entry not found")

    cursor.execute("DELETE FROM InkAdjustmentEntries WHERE outward_id = %s", (outward_id,))
    cursor.execute("DELETE FROM InkOutward WHERE id = %s", (outward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
