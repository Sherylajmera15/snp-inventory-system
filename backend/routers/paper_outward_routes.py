from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection

router = APIRouter(prefix="/api/paper-outward", tags=["paper-outward"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class OutwardItemInput(BaseModel):
    quality: str
    gsm: int
    form_type: str
    reel_width: Optional[float] = None
    sheet_length: Optional[float] = None
    sheet_width: Optional[float] = None
    weight_issued: Optional[float] = None
    sheets_issued: Optional[int] = None
    issue_method: Optional[str] = None

    @model_validator(mode="after")
    def validate_item(self):
        if self.form_type not in ("Reel Form", "Sheet Form"):
            raise ValueError("form_type must be 'Reel Form' or 'Sheet Form'")
        if self.form_type == "Reel Form":
            if not self.weight_issued or self.weight_issued <= 0:
                raise ValueError("weight_issued is required and must be > 0 for Reel Form")
        else:
            if self.issue_method not in ("sheets", "weight"):
                raise ValueError("issue_method must be 'sheets' or 'weight' for Sheet Form")
            if self.issue_method == "sheets":
                if not self.sheets_issued or self.sheets_issued <= 0:
                    raise ValueError("sheets_issued is required for sheet method")
            else:
                if not self.weight_issued or self.weight_issued <= 0:
                    raise ValueError("weight_issued is required for weight method")
        return self


class PaperOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    job_name: str
    job_card_number: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[OutwardItemInput]
    force_adjustment: bool = False

    @model_validator(mode="after")
    def validate_body(self):
        if not self.job_name or not self.job_name.strip():
            raise ValueError("job_name is required")
        if not self.items:
            raise ValueError("At least one paper item is required")
        return self


class PaperOutwardHeaderUpdate(BaseModel):
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

def _available_reel_stock(cursor, quality: str, gsm: int, reel_width: Optional[float] = None) -> float:
    if reel_width is not None:
        inward_cond = "AND pi.reel_width = %s"
        inward_p = [reel_width]
        adj_cond = "AND (adj.reel_width = %s OR adj.reel_width IS NULL)"
        adj_p = [reel_width]
        out_cond = "AND (poi.reel_width = %s OR poi.reel_width IS NULL)"
        out_p = [reel_width]
    else:
        inward_cond = inward_p = adj_cond = adj_p = out_cond = out_p = ""

    cursor.execute(f"""
        SELECT
            COALESCE((
                SELECT SUM(pirw.weight)
                FROM PaperItems pi
                JOIN PaperItemReelWeights pirw ON pirw.paper_item_id = pi.id
                WHERE pi.quality = %s AND pi.gsm = %s AND pi.form_type = 'Reel Form'
                {inward_cond}
            ), 0)
            + COALESCE((
                SELECT SUM(adj.quantity)
                FROM PaperAdjustmentEntries adj
                WHERE adj.quality = %s AND adj.gsm = %s AND adj.form_type = 'Reel Form'
                {adj_cond}
            ), 0)
            - COALESCE((
                SELECT SUM(poi.weight_issued)
                FROM PaperOutwardItems poi
                WHERE poi.quality = %s AND poi.gsm = %s AND poi.form_type = 'Reel Form'
                AND poi.weight_issued IS NOT NULL
                {out_cond}
            ), 0)
    """, [quality, gsm] + list(inward_p) + [quality, gsm] + list(adj_p) + [quality, gsm] + list(out_p))
    return float(cursor.fetchone()[0] or 0)


def _available_sheet_stock(cursor, quality: str, gsm: int, sheet_length: Optional[float] = None, sheet_width: Optional[float] = None) -> float:
    if sheet_length is not None and sheet_width is not None:
        inward_cond = "AND pi.sheet_length = %s AND pi.sheet_width = %s"
        inward_p = [sheet_length, sheet_width]
        adj_cond = "AND ((adj.sheet_length = %s AND adj.sheet_width = %s) OR (adj.sheet_length IS NULL AND adj.sheet_width IS NULL))"
        adj_p = [sheet_length, sheet_width]
        out_cond = "AND ((poi.sheet_length = %s AND poi.sheet_width = %s) OR (poi.sheet_length IS NULL AND poi.sheet_width IS NULL))"
        out_p = [sheet_length, sheet_width]
    else:
        inward_cond = inward_p = adj_cond = adj_p = out_cond = out_p = ""

    cursor.execute(f"""
        SELECT
            COALESCE((
                SELECT SUM(pi.total_sheets)
                FROM PaperItems pi
                WHERE pi.quality = %s AND pi.gsm = %s AND pi.form_type = 'Sheet Form'
                AND pi.total_sheets IS NOT NULL
                {inward_cond}
            ), 0)
            + COALESCE((
                SELECT SUM(adj.quantity)
                FROM PaperAdjustmentEntries adj
                WHERE adj.quality = %s AND adj.gsm = %s AND adj.form_type = 'Sheet Form'
                {adj_cond}
            ), 0)
            - COALESCE((
                SELECT SUM(poi.sheets_issued)
                FROM PaperOutwardItems poi
                WHERE poi.quality = %s AND poi.gsm = %s AND poi.form_type = 'Sheet Form'
                AND poi.sheets_issued IS NOT NULL
                {out_cond}
            ), 0)
    """, [quality, gsm] + list(inward_p) + [quality, gsm] + list(adj_p) + [quality, gsm] + list(out_p))
    return float(cursor.fetchone()[0] or 0)


def _check_shortages(cursor, items: List[OutwardItemInput], exclude_outward_id: Optional[int] = None) -> list:
    shortages = []
    for item in items:
        if item.form_type == "Reel Form":
            available = _available_reel_stock(cursor, item.quality, item.gsm, item.reel_width)
            if exclude_outward_id:
                rw_cond = "AND (reel_width = %s OR reel_width IS NULL)" if item.reel_width is not None else "AND reel_width IS NULL"
                rw_p = [item.reel_width] if item.reel_width is not None else []
                cursor.execute(
                    f"SELECT COALESCE(SUM(weight_issued), 0) FROM PaperOutwardItems WHERE outward_id = %s AND quality = %s AND gsm = %s AND form_type = 'Reel Form' {rw_cond}",
                    [exclude_outward_id, item.quality, item.gsm] + rw_p,
                )
                available += float(cursor.fetchone()[0] or 0)
            if item.weight_issued and available < item.weight_issued:
                shortages.append({
                    "quality": item.quality, "gsm": item.gsm, "form_type": item.form_type,
                    "reel_width": item.reel_width,
                    "unit": "Kg",
                    "available": round(available, 2),
                    "requested": item.weight_issued,
                    "shortage": round(item.weight_issued - available, 2),
                })
        elif item.form_type == "Sheet Form" and item.issue_method == "sheets":
            available = _available_sheet_stock(cursor, item.quality, item.gsm, item.sheet_length, item.sheet_width)
            if exclude_outward_id:
                sl_cond = "AND ((sheet_length = %s AND sheet_width = %s) OR (sheet_length IS NULL AND sheet_width IS NULL))" if item.sheet_length is not None else "AND sheet_length IS NULL AND sheet_width IS NULL"
                sl_p = [item.sheet_length, item.sheet_width] if item.sheet_length is not None else []
                cursor.execute(
                    f"SELECT COALESCE(SUM(sheets_issued), 0) FROM PaperOutwardItems WHERE outward_id = %s AND quality = %s AND gsm = %s AND form_type = 'Sheet Form' {sl_cond}",
                    [exclude_outward_id, item.quality, item.gsm] + sl_p,
                )
                available += float(cursor.fetchone()[0] or 0)
            if item.sheets_issued and available < item.sheets_issued:
                shortages.append({
                    "quality": item.quality, "gsm": item.gsm, "form_type": item.form_type,
                    "sheet_length": item.sheet_length, "sheet_width": item.sheet_width,
                    "unit": "Sheets",
                    "available": int(available),
                    "requested": item.sheets_issued,
                    "shortage": item.sheets_issued - int(available),
                })
    return shortages


def _insert_items_and_adjustments(cursor, outward_id: int, items: List[OutwardItemInput], shortages: list):
    shortage_map = {(s["quality"], s["gsm"], s["form_type"]): s for s in shortages}

    for item in items:
        cursor.execute("""
            INSERT INTO PaperOutwardItems (outward_id, quality, gsm, form_type, reel_width, sheet_length, sheet_width, weight_issued, sheets_issued, issue_method)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            outward_id, item.quality, item.gsm, item.form_type,
            item.reel_width, item.sheet_length, item.sheet_width,
            item.weight_issued,
            item.sheets_issued,
            item.issue_method,
        ))

        key = (item.quality, item.gsm, item.form_type)
        if key in shortage_map:
            s = shortage_map[key]
            cursor.execute("""
                INSERT INTO PaperAdjustmentEntries (outward_id, quality, gsm, form_type, quantity, unit, reason)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                outward_id,
                item.quality, item.gsm, item.form_type,
                s["shortage"],
                s["unit"],
                f"Auto-created due to outward stock shortage. Outward ID: {outward_id}",
            ))


def _fetch_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT o.id, o.outward_date, o.outward_time, o.job_name, o.job_card_number, "
        "o.issued_by, o.received_by, o.remarks, o.created_at, o.created_by, u.username "
        "FROM PaperOutward o LEFT JOIN Users u ON o.created_by = u.id WHERE o.id = %s",
        (outward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")

    cursor.execute(
        "SELECT id, quality, gsm, form_type, reel_width, sheet_length, sheet_width, weight_issued, sheets_issued, issue_method "
        "FROM PaperOutwardItems WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    items = [
        {
            "id": r[0], "quality": r[1], "gsm": r[2], "form_type": r[3],
            "reel_width": float(r[4]) if r[4] is not None else None,
            "sheet_length": float(r[5]) if r[5] is not None else None,
            "sheet_width": float(r[6]) if r[6] is not None else None,
            "weight_issued": float(r[7]) if r[7] is not None else None,
            "sheets_issued": r[8],
            "issue_method": r[9],
        }
        for r in cursor.fetchall()
    ]

    cursor.execute(
        "SELECT id, quality, gsm, form_type, quantity, unit, reason, created_at "
        "FROM PaperAdjustmentEntries WHERE outward_id = %s",
        (outward_id,),
    )
    adjustments = [
        {
            "id": r[0], "quality": r[1], "gsm": r[2], "form_type": r[3],
            "quantity": float(r[4]), "unit": r[5], "reason": r[6],
            "created_at": r[7].isoformat() if r[7] else None,
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


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/stock-reels")
def get_stock_reels(
    quality: str = Query(...),
    gsm: int = Query(...),
    reel_width: Optional[float] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    if reel_width is not None:
        cursor.execute(
            """
            SELECT pirw.weight
            FROM PaperItems pi
            JOIN PaperItemReelWeights pirw ON pirw.paper_item_id = pi.id
            WHERE pi.quality = %s AND pi.gsm = %s AND pi.form_type = 'Reel Form'
              AND ABS(pi.reel_width - %s) < 0.01
            ORDER BY pi.id ASC, pirw.reel_number ASC
            """,
            (quality, gsm, reel_width),
        )
    else:
        cursor.execute(
            """
            SELECT pirw.weight
            FROM PaperItems pi
            JOIN PaperItemReelWeights pirw ON pirw.paper_item_id = pi.id
            WHERE pi.quality = %s AND pi.gsm = %s AND pi.form_type = 'Reel Form'
            ORDER BY pi.id ASC, pirw.reel_number ASC
            """,
            (quality, gsm),
        )
    reels = [{"weight_kg": round(float(r[0]), 2)} for r in cursor.fetchall()]
    conn.close()
    return {"reels": reels}


@router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT pi.quality, pi.gsm, pi.reel_width,
            SUM(pirw.weight)
            + COALESCE((
                SELECT SUM(adj.quantity)
                FROM PaperAdjustmentEntries adj
                WHERE adj.quality = pi.quality AND adj.gsm = pi.gsm AND adj.form_type = 'Reel Form'
                AND (adj.reel_width = pi.reel_width OR adj.reel_width IS NULL)
            ), 0)
            - COALESCE((
                SELECT SUM(poi.weight_issued)
                FROM PaperOutwardItems poi
                WHERE poi.quality = pi.quality AND poi.gsm = pi.gsm AND poi.form_type = 'Reel Form'
                AND poi.weight_issued IS NOT NULL
                AND (poi.reel_width = pi.reel_width OR poi.reel_width IS NULL)
            ), 0) AS available_qty
        FROM PaperItems pi
        JOIN PaperItemReelWeights pirw ON pirw.paper_item_id = pi.id
        WHERE pi.form_type = 'Reel Form'
        GROUP BY pi.quality, pi.gsm, pi.reel_width
    """)
    reel_rows = cursor.fetchall()

    cursor.execute("""
        SELECT pi.quality, pi.gsm, pi.sheet_length, pi.sheet_width,
            COALESCE(SUM(pi.total_sheets), 0)
            + COALESCE((
                SELECT SUM(adj.quantity)
                FROM PaperAdjustmentEntries adj
                WHERE adj.quality = pi.quality AND adj.gsm = pi.gsm AND adj.form_type = 'Sheet Form'
                AND (
                    (adj.sheet_length = pi.sheet_length AND adj.sheet_width = pi.sheet_width)
                    OR (adj.sheet_length IS NULL AND adj.sheet_width IS NULL)
                )
            ), 0)
            - COALESCE((
                SELECT SUM(poi.sheets_issued)
                FROM PaperOutwardItems poi
                WHERE poi.quality = pi.quality AND poi.gsm = pi.gsm AND poi.form_type = 'Sheet Form'
                AND poi.sheets_issued IS NOT NULL
                AND (
                    (poi.sheet_length = pi.sheet_length AND poi.sheet_width = pi.sheet_width)
                    OR (poi.sheet_length IS NULL AND poi.sheet_width IS NULL)
                )
            ), 0) AS available_qty
        FROM PaperItems pi
        WHERE pi.form_type = 'Sheet Form' AND pi.total_sheets IS NOT NULL
        GROUP BY pi.quality, pi.gsm, pi.sheet_length, pi.sheet_width
    """)
    sheet_rows = cursor.fetchall()
    conn.close()

    result = []
    for q, g, rw, qty in reel_rows:
        result.append({
            "quality": q, "gsm": g, "form_type": "Reel Form",
            "reel_width": float(rw) if rw is not None else None,
            "sheet_length": None, "sheet_width": None,
            "available_qty": round(float(qty or 0), 2), "unit": "Kg",
        })
    for q, g, sl, sw, qty in sheet_rows:
        result.append({
            "quality": q, "gsm": g, "form_type": "Sheet Form",
            "reel_width": None,
            "sheet_length": float(sl) if sl is not None else None,
            "sheet_width": float(sw) if sw is not None else None,
            "available_qty": int(qty or 0), "unit": "Sheets",
        })

    result.sort(key=lambda x: (x["quality"], x["gsm"]))
    return result


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COUNT(DISTINCT po.id),
            COALESCE(SUM(poi.weight_issued), 0),
            COALESCE(SUM(poi.sheets_issued), 0)
        FROM PaperOutward po
        LEFT JOIN PaperOutwardItems poi ON poi.outward_id = po.id
        WHERE po.outward_date::date = CURRENT_DATE
    """)
    r = cursor.fetchone()
    today = {"total_entries": r[0], "total_reel_weight_kg": round(float(r[1]), 2), "total_sheets": int(r[2])}

    cursor.execute("""
        SELECT
            COUNT(DISTINCT po.id),
            COALESCE(SUM(poi.weight_issued), 0),
            COALESCE(SUM(poi.sheets_issued), 0)
        FROM PaperOutward po
        LEFT JOIN PaperOutwardItems poi ON poi.outward_id = po.id
        WHERE DATE_TRUNC('month', po.outward_date) = DATE_TRUNC('month', CURRENT_DATE)
    """)
    r = cursor.fetchone()
    month = {"total_entries": r[0], "total_reel_weight_kg": round(float(r[1]), 2), "total_sheets": int(r[2])}

    cursor.execute("""
        SELECT quality, gsm, form_type,
            COALESCE(SUM(weight_issued), 0) as total_weight,
            COALESCE(SUM(sheets_issued), 0) as total_sheets
        FROM PaperOutwardItems
        GROUP BY quality, gsm, form_type
        ORDER BY total_weight DESC, total_sheets DESC
        LIMIT 5
    """)
    top_qualities = [
        {"quality": r[0], "gsm": r[1], "form_type": r[2],
         "total_weight_kg": round(float(r[3]), 2), "total_sheets": int(r[4])}
        for r in cursor.fetchall()
    ]

    cursor.execute("""
        SELECT po.job_name,
            COALESCE(SUM(poi.weight_issued), 0) as total_weight,
            COALESCE(SUM(poi.sheets_issued), 0) as total_sheets
        FROM PaperOutward po
        JOIN PaperOutwardItems poi ON poi.outward_id = po.id
        GROUP BY po.job_name
        ORDER BY total_weight DESC, total_sheets DESC
        LIMIT 5
    """)
    top_jobs = [
        {"job_name": r[0], "total_weight_kg": round(float(r[1]), 2), "total_sheets": int(r[2])}
        for r in cursor.fetchall()
    ]

    conn.close()
    return {"today": today, "month": month, "top_consumed_qualities": top_qualities, "top_jobs": top_jobs}


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
        f"SELECT id FROM PaperOutward WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/job-card-suggestions")
def job_card_suggestions(q: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    if q and q.strip():
        cursor.execute(
            "SELECT DISTINCT job_card_number FROM PaperOutward "
            "WHERE job_card_number IS NOT NULL AND job_card_number <> '' AND job_card_number ILIKE %s "
            "ORDER BY job_card_number LIMIT 20",
            (f"%{q.strip()}%",),
        )
    else:
        cursor.execute(
            "SELECT DISTINCT job_card_number FROM PaperOutward "
            "WHERE job_card_number IS NOT NULL AND job_card_number <> '' "
            "ORDER BY job_card_number LIMIT 20"
        )
    results = [r[0] for r in cursor.fetchall()]
    conn.close()
    return results


@router.get("")
def list_outward(
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    where_clauses = []
    params: list = []

    if date_from:
        where_clauses.append("po.outward_date >= %s")
        params.append(date_from)
    if date_to:
        where_clauses.append("po.outward_date <= %s")
        params.append(date_to)
    if search:
        like = f"%{search}%"
        where_clauses.append("""(
            po.job_name ILIKE %s
            OR po.job_card_number ILIKE %s
            OR po.issued_by ILIKE %s
            OR po.received_by ILIKE %s
            OR po.remarks ILIKE %s
            OR TO_CHAR(po.outward_date, 'YYYY-MM-DD') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM PaperOutwardItems poi WHERE poi.outward_id = po.id
                AND (poi.quality ILIKE %s OR poi.gsm::text ILIKE %s)
            )
        )""")
        params.extend([like] * 8)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    cursor.execute(f"""
        SELECT po.id, po.outward_date, po.outward_time, po.job_name, po.job_card_number,
               po.issued_by, po.received_by, po.remarks, po.created_at,
               COUNT(poi.id) as item_count,
               COALESCE(SUM(poi.weight_issued), 0) as total_weight,
               COALESCE(SUM(poi.sheets_issued), 0) as total_sheets
        FROM PaperOutward po
        LEFT JOIN PaperOutwardItems poi ON poi.outward_id = po.id
        {where_sql}
        GROUP BY po.id, po.outward_date, po.outward_time, po.job_name, po.job_card_number,
                 po.issued_by, po.received_by, po.remarks, po.created_at
        ORDER BY po.outward_date DESC, po.id DESC
    """, params)

    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT outward_id, quality, gsm, form_type FROM PaperOutwardItems WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
            ids,
        )
        for item_row in cursor.fetchall():
            label = f"{item_row[1]} {item_row[2]} GSM ({item_row[3].replace(' Form', '')})"
            summaries.setdefault(item_row[0], []).append(label)

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
            "total_sheets_issued": int(r[11]),
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/{outward_id}")
def get_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(outward_id)


@router.post("")
def create_outward(body: PaperOutwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        shortages = _check_shortages(cursor, body.items)

        if shortages and not body.force_adjustment:
            conn.close()
            return {"status": "stock_shortage", "shortages": shortages}

        cursor.execute("""
            INSERT INTO PaperOutward (outward_date, outward_time, job_name, job_card_number, issued_by, received_by, remarks, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            body.outward_date, body.outward_time,
            body.job_name.strip(),
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
def update_outward(outward_id: int, body: PaperOutwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT outward_date, outward_time, created_by FROM PaperOutward WHERE id = %s", (outward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        shortages = _check_shortages(cursor, body.items, exclude_outward_id=outward_id)

        if shortages and not body.force_adjustment:
            conn.close()
            return {"status": "stock_shortage", "shortages": shortages}

        cursor.execute("""
            UPDATE PaperOutward
            SET outward_date = %s, outward_time = %s, job_name = %s, job_card_number = %s,
                issued_by = %s, received_by = %s, remarks = %s
            WHERE id = %s
        """, (
            body.outward_date, body.outward_time, body.job_name.strip(),
            body.job_card_number.strip() if body.job_card_number else None,
            body.issued_by, body.received_by, body.remarks, outward_id,
        ))

        cursor.execute("DELETE FROM PaperOutwardItems WHERE outward_id = %s", (outward_id,))
        cursor.execute("DELETE FROM PaperAdjustmentEntries WHERE outward_id = %s", (outward_id,))
        _insert_items_and_adjustments(cursor, outward_id, body.items, shortages if body.force_adjustment else [])
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return _fetch_detail(outward_id)


@router.patch("/{outward_id}")
def patch_outward_header(outward_id: int, body: PaperOutwardHeaderUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT outward_date, outward_time, created_by FROM PaperOutward WHERE id = %s", (outward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE PaperOutward SET outward_date=%s, outward_time=%s, job_name=%s, job_card_number=%s, "
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
    cursor.execute("SELECT id FROM PaperOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")

    cursor.execute("DELETE FROM PaperAdjustmentEntries WHERE outward_id = %s", (outward_id,))
    cursor.execute("DELETE FROM PaperOutward WHERE id = %s", (outward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
