from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection

router = APIRouter(prefix="/api/ctp-outward", tags=["ctp-outward"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CTPOutwardItemInput(BaseModel):
    plate_size: str
    quantity_issued: int

    @model_validator(mode="after")
    def validate_item(self):
        if not self.plate_size or not self.plate_size.strip():
            raise ValueError("plate_size is required")
        if self.quantity_issued <= 0:
            raise ValueError("quantity_issued must be greater than 0")
        return self


class CTPOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[CTPOutwardItemInput]
    force_adjustment: bool = False

    @model_validator(mode="after")
    def validate_body(self):
        if not self.items:
            raise ValueError("At least one plate item is required")
        return self


class DeleteRequest(BaseModel):
    password: str


class CTPOutwardUpdate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


# ─── Stock helpers ────────────────────────────────────────────────────────────

def _available_stock(cursor, plate_size: str) -> int:
    cursor.execute("""
        SELECT
            COALESCE((
                SELECT SUM(cps.total_plates)
                FROM CTPPlateSizes cps
                WHERE cps.plate_size = %s
            ), 0)
            + COALESCE((
                SELECT SUM(adj.quantity)
                FROM CTPAdjustmentEntries adj
                WHERE adj.plate_size = %s
            ), 0)
            - COALESCE((
                SELECT SUM(coi.quantity_issued)
                FROM CTPOutwardItems coi
                WHERE coi.plate_size = %s
            ), 0)
    """, (plate_size, plate_size, plate_size))
    return int(cursor.fetchone()[0] or 0)


def _check_shortages(cursor, items: List[CTPOutwardItemInput], exclude_outward_id: Optional[int] = None) -> list:
    shortages = []
    for item in items:
        available = _available_stock(cursor, item.plate_size)
        if exclude_outward_id:
            cursor.execute(
                "SELECT COALESCE(SUM(quantity_issued), 0) FROM CTPOutwardItems WHERE outward_id = %s AND plate_size = %s",
                (exclude_outward_id, item.plate_size),
            )
            available += int(cursor.fetchone()[0] or 0)
        if available < item.quantity_issued:
            shortages.append({
                "plate_size": item.plate_size,
                "available": available,
                "requested": item.quantity_issued,
                "shortage": item.quantity_issued - available,
            })
    return shortages


def _insert_items_and_adjustments(cursor, outward_id: int, items: List[CTPOutwardItemInput], shortages: list):
    shortage_map = {s["plate_size"]: s for s in shortages}
    for item in items:
        cursor.execute(
            "INSERT INTO CTPOutwardItems (outward_id, plate_size, quantity_issued) VALUES (%s, %s, %s)",
            (outward_id, item.plate_size, item.quantity_issued),
        )
        if item.plate_size in shortage_map:
            s = shortage_map[item.plate_size]
            cursor.execute(
                "INSERT INTO CTPAdjustmentEntries (outward_id, plate_size, quantity, reason) VALUES (%s, %s, %s, %s)",
                (outward_id, item.plate_size, s["shortage"],
                 f"Auto-created due to outward stock shortage. CTP Outward ID: {outward_id}"),
            )


def _fetch_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT o.id, o.outward_date, o.outward_time, o.issued_by, o.received_by, o.remarks, o.created_at, "
        "o.created_by, u.username "
        "FROM CTPOutward o LEFT JOIN Users u ON o.created_by = u.id WHERE o.id = %s",
        (outward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="CTP Outward entry not found")

    cursor.execute(
        "SELECT id, plate_size, quantity_issued FROM CTPOutwardItems WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    items = [
        {"id": r[0], "plate_size": r[1], "quantity_issued": r[2]}
        for r in cursor.fetchall()
    ]

    cursor.execute(
        "SELECT id, plate_size, quantity, reason, created_at FROM CTPAdjustmentEntries WHERE outward_id = %s",
        (outward_id,),
    )
    adjustments = [
        {
            "id": r[0], "plate_size": r[1], "quantity": r[2],
            "reason": r[3], "created_at": r[4].isoformat() if r[4] else None,
        }
        for r in cursor.fetchall()
    ]

    conn.close()
    return {
        "id": header[0],
        "outward_date": header[1],
        "outward_time": header[2],
        "issued_by": header[3],
        "received_by": header[4],
        "remarks": header[5],
        "created_at": header[6].isoformat() if header[6] else None,
        "created_by_id": header[7],
        "created_by_name": header[8],
        "items": items,
        "adjustments": adjustments,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT cps.plate_size,
            SUM(cps.total_plates)
            + COALESCE((
                SELECT SUM(adj.quantity)
                FROM CTPAdjustmentEntries adj
                WHERE adj.plate_size = cps.plate_size
            ), 0)
            - COALESCE((
                SELECT SUM(coi.quantity_issued)
                FROM CTPOutwardItems coi
                WHERE coi.plate_size = cps.plate_size
            ), 0) AS available_qty
        FROM CTPPlateSizes cps
        GROUP BY cps.plate_size
        ORDER BY cps.plate_size
    """)
    rows = cursor.fetchall()
    conn.close()
    return [{"plate_size": r[0], "available_qty": int(r[1] or 0)} for r in rows]


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COUNT(DISTINCT co.id), COALESCE(SUM(coi.quantity_issued), 0)
        FROM CTPOutward co
        LEFT JOIN CTPOutwardItems coi ON coi.outward_id = co.id
        WHERE co.outward_date::date = CURRENT_DATE
    """)
    r = cursor.fetchone()
    today = {"total_entries": r[0], "total_plates": int(r[1])}

    cursor.execute("""
        SELECT COUNT(DISTINCT co.id), COALESCE(SUM(coi.quantity_issued), 0)
        FROM CTPOutward co
        LEFT JOIN CTPOutwardItems coi ON coi.outward_id = co.id
        WHERE DATE_TRUNC('month', co.outward_date) = DATE_TRUNC('month', CURRENT_DATE)
    """)
    r = cursor.fetchone()
    month = {"total_entries": r[0], "total_plates": int(r[1])}

    cursor.execute("""
        SELECT coi.plate_size, COALESCE(SUM(coi.quantity_issued), 0) AS plates_issued
        FROM CTPOutwardItems coi
        GROUP BY coi.plate_size
        ORDER BY plates_issued DESC
        LIMIT 10
    """)
    size_breakdown = [{"plate_size": r[0], "plates_issued": int(r[1])} for r in cursor.fetchall()]

    cursor.execute("""
        SELECT co.received_by, COALESCE(SUM(coi.quantity_issued), 0) AS total_plates
        FROM CTPOutward co
        JOIN CTPOutwardItems coi ON coi.outward_id = co.id
        WHERE co.received_by IS NOT NULL AND co.received_by <> ''
        GROUP BY co.received_by
        ORDER BY total_plates DESC
        LIMIT 5
    """)
    top_receivers = [{"name": r[0], "total_plates": int(r[1])} for r in cursor.fetchall()]

    conn.close()
    return {
        "today": today,
        "month": month,
        "size_breakdown": size_breakdown,
        "top_receivers": top_receivers,
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
        f"SELECT id FROM CTPOutward WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id",
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
        where_clauses.append("co.outward_date >= %s")
        params.append(date_from)
    if date_to:
        where_clauses.append("co.outward_date <= %s")
        params.append(date_to)
    if search:
        like = f"%{search}%"
        where_clauses.append("""(
            co.issued_by ILIKE %s
            OR co.received_by ILIKE %s
            OR co.remarks ILIKE %s
            OR TO_CHAR(co.outward_date, 'YYYY-MM-DD') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM CTPOutwardItems coi WHERE coi.outward_id = co.id
                AND (coi.plate_size ILIKE %s OR coi.quantity_issued::text ILIKE %s)
            )
        )""")
        params.extend([like] * 6)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    cursor.execute(f"""
        SELECT co.id, co.outward_date, co.outward_time, co.issued_by, co.received_by,
               co.remarks, co.created_at,
               COUNT(coi.id) AS item_count,
               COALESCE(SUM(coi.quantity_issued), 0) AS total_plates
        FROM CTPOutward co
        LEFT JOIN CTPOutwardItems coi ON coi.outward_id = co.id
        {where_sql}
        GROUP BY co.id, co.outward_date, co.outward_time, co.issued_by, co.received_by,
                 co.remarks, co.created_at
        ORDER BY co.outward_date DESC, co.id DESC
    """, params)
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT outward_id, plate_size, quantity_issued FROM CTPOutwardItems WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
            ids,
        )
        for ir in cursor.fetchall():
            summaries.setdefault(ir[0], []).append(f"{ir[1]} — {ir[2]:,} Plates")

    conn.close()
    return [
        {
            "id": r[0],
            "outward_date": r[1],
            "outward_time": r[2],
            "issued_by": r[3],
            "received_by": r[4],
            "remarks": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "item_count": r[7],
            "total_plates_issued": int(r[8]),
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/{outward_id}")
def get_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(outward_id)


@router.post("")
def create_outward(body: CTPOutwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        shortages = _check_shortages(cursor, body.items)
        if shortages and not body.force_adjustment:
            conn.close()
            return {"status": "stock_shortage", "shortages": shortages}

        cursor.execute("""
            INSERT INTO CTPOutward (outward_date, outward_time, issued_by, received_by, remarks, created_by)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
        """, (body.outward_date, body.outward_time, body.issued_by, body.received_by, body.remarks, current_user["id"]))
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
def update_outward(outward_id: int, body: CTPOutwardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT outward_date, outward_time, created_by FROM CTPOutward WHERE id = %s", (outward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="CTP Outward entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE CTPOutward SET outward_date=%s, outward_time=%s, issued_by=%s, received_by=%s, remarks=%s WHERE id=%s",
        (body.outward_date, body.outward_time or None,
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
    cursor.execute("SELECT id FROM CTPOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="CTP Outward entry not found")

    cursor.execute("DELETE FROM CTPAdjustmentEntries WHERE outward_id = %s", (outward_id,))
    cursor.execute("DELETE FROM CTPOutward WHERE id = %s", (outward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
