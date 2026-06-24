"""
Lamination Film module.
Handles inward and outward for lamination film rolls with FIFO stock consumption.
"""
from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class RollWeightInput(BaseModel):
    roll_number: int
    weight: float


class LaminationInwardCreate(BaseModel):
    inward_date: date
    inward_time: Optional[time] = None
    supplier_name: str
    invoice_number: Optional[str] = None
    received_by: str
    remarks: Optional[str] = None
    film_type: str  # PVC | BOPP | SILVER | HOLOGRAPHIC | OTHER
    custom_type: Optional[str] = None
    roll_size: Optional[str] = None
    rolls: List[RollWeightInput]


class LaminationOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    receiver_name: Optional[str] = None
    issued_by: Optional[str] = None
    film_type: str
    custom_type: Optional[str] = None
    roll_size: Optional[str] = None
    quantity_issued: float
    remarks: Optional[str] = None
    force_adjustment: bool = False


class LaminationOutwardHeaderUpdate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    receiver_name: Optional[str] = None
    issued_by: Optional[str] = None
    remarks: Optional[str] = None


class DeleteRequest(BaseModel):
    password: str


# ─── Suggestion helper ────────────────────────────────────────────────────────

def _remember(cursor, category: str, value):
    if not value:
        return
    v = str(value).strip()
    if not v:
        return
    cursor.execute(
        "INSERT INTO suggestionmemory (category, value) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (category, v),
    )


# ─── Detail helpers ───────────────────────────────────────────────────────────

def _fetch_inward_detail(inward_id: int) -> dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT i.id, i.inward_date, i.inward_time, i.supplier_name, i.invoice_number,
                   i.received_by, i.remarks, i.film_type, i.custom_type, i.roll_size,
                   i.created_by, COALESCE(u.full_name, u.username)
            FROM laminationfilminward i
            LEFT JOIN users u ON u.id = i.created_by
            WHERE i.id = %s
            """,
            (inward_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Inward entry not found")

        detail = {
            "id": row[0],
            "inward_date": str(row[1]) if row[1] else None,
            "inward_time": str(row[2]) if row[2] else None,
            "supplier_name": row[3],
            "invoice_number": row[4],
            "received_by": row[5],
            "remarks": row[6],
            "film_type": row[7],
            "custom_type": row[8],
            "roll_size": row[9],
            "created_by": row[10],
            "created_by_name": row[11],
        }

        cursor.execute(
            """
            SELECT id, roll_number, original_weight, remaining_weight, is_consumed
            FROM laminationfilmroll
            WHERE inward_id = %s
            ORDER BY roll_number
            """,
            (inward_id,),
        )
        detail["rolls"] = [
            {
                "id": r[0],
                "roll_number": r[1],
                "original_weight": float(r[2]) if r[2] is not None else None,
                "remaining_weight": float(r[3]) if r[3] is not None else None,
                "is_consumed": r[4],
            }
            for r in cursor.fetchall()
        ]
        return detail
    finally:
        conn.close()


def _fetch_outward_detail(outward_id: int) -> dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT o.id, o.outward_date, o.outward_time, o.receiver_name, o.issued_by,
                   o.film_type, o.custom_type, o.roll_size, o.quantity_issued,
                   o.remarks, o.created_by, COALESCE(u.full_name, u.username)
            FROM laminationfilmoutward o
            LEFT JOIN users u ON u.id = o.created_by
            WHERE o.id = %s
            """,
            (outward_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Outward entry not found")

        detail = {
            "id": row[0],
            "outward_date": str(row[1]) if row[1] else None,
            "outward_time": str(row[2]) if row[2] else None,
            "receiver_name": row[3],
            "issued_by": row[4],
            "film_type": row[5],
            "custom_type": row[6],
            "roll_size": row[7],
            "quantity_issued": float(row[8]) if row[8] is not None else None,
            "remarks": row[9],
            "created_by": row[10],
            "created_by_name": row[11],
        }

        cursor.execute(
            """
            SELECT oi.id, oi.roll_id, r.roll_number, oi.weight_taken
            FROM laminationfilmoutwarditem oi
            JOIN laminationfilmroll r ON r.id = oi.roll_id
            WHERE oi.outward_id = %s
            ORDER BY oi.id
            """,
            (outward_id,),
        )
        detail["items"] = [
            {
                "id": r[0],
                "roll_id": r[1],
                "roll_number": r[2],
                "weight_taken": float(r[3]) if r[3] is not None else None,
            }
            for r in cursor.fetchall()
        ]

        cursor.execute(
            """
            SELECT id, film_type, custom_type, roll_size, quantity, reason
            FROM laminationfilmadjustment
            WHERE outward_id = %s
            """,
            (outward_id,),
        )
        detail["adjustments"] = [
            {
                "id": r[0],
                "film_type": r[1],
                "custom_type": r[2],
                "roll_size": r[3],
                "quantity": float(r[4]) if r[4] is not None else None,
                "reason": r[5],
            }
            for r in cursor.fetchall()
        ]
        return detail
    finally:
        conn.close()


# ─── Lamination Inward Router ─────────────────────────────────────────────────

lamination_router = APIRouter(prefix="/api/lamination", tags=["lamination"])


@lamination_router.get("/suggestions")
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT value FROM suggestionmemory WHERE category = 'lamination_supplier_name' ORDER BY value"
        )
        rows = cursor.fetchall()
        return {"supplier_names": [r[0] for r in rows]}
    finally:
        conn.close()


@lamination_router.delete("/suggestions")
def delete_suggestion(
    value: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM suggestionmemory WHERE category = 'lamination_supplier_name' AND value = %s",
            (value,),
        )
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}


@lamination_router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user)):
    from datetime import date as date_cls
    today = date_cls.today()
    month_start = today.replace(day=1)

    conn = get_connection()
    try:
        c = conn.cursor()

        # Today entries
        c.execute(
            "SELECT COUNT(*) FROM laminationfilminward WHERE inward_date::date = %s", (today,)
        )
        entries_today = c.fetchone()[0] or 0

        # Today weight received
        c.execute(
            """
            SELECT COALESCE(SUM(r.original_weight), 0)
            FROM laminationfilmroll r
            JOIN laminationfilminward i ON i.id = r.inward_id
            WHERE i.inward_date::date = %s
            """,
            (today,),
        )
        weight_received_today = float(c.fetchone()[0] or 0)

        # Today weight issued
        c.execute(
            "SELECT COALESCE(SUM(quantity_issued), 0) FROM laminationfilmoutward WHERE outward_date::date = %s",
            (today,),
        )
        weight_issued_today = float(c.fetchone()[0] or 0)

        # Month entries
        c.execute(
            "SELECT COUNT(*) FROM laminationfilminward WHERE inward_date >= %s", (month_start,)
        )
        entries_month = c.fetchone()[0] or 0

        # Month weight received
        c.execute(
            """
            SELECT COALESCE(SUM(r.original_weight), 0)
            FROM laminationfilmroll r
            JOIN laminationfilminward i ON i.id = r.inward_id
            WHERE i.inward_date >= %s
            """,
            (month_start,),
        )
        weight_received_month = float(c.fetchone()[0] or 0)

        # Month weight issued
        c.execute(
            "SELECT COALESCE(SUM(quantity_issued), 0) FROM laminationfilmoutward WHERE outward_date >= %s",
            (month_start,),
        )
        weight_issued_month = float(c.fetchone()[0] or 0)

        # Stock by type
        c.execute(
            """
            SELECT i.film_type, i.custom_type, i.roll_size,
                   COUNT(r.id) FILTER (WHERE r.is_consumed = FALSE) AS roll_count,
                   COALESCE(SUM(r.remaining_weight) FILTER (WHERE r.is_consumed = FALSE), 0) AS total_weight
            FROM laminationfilmroll r
            JOIN laminationfilminward i ON i.id = r.inward_id
            GROUP BY i.film_type, i.custom_type, i.roll_size
            HAVING COALESCE(SUM(r.remaining_weight) FILTER (WHERE r.is_consumed = FALSE), 0) > 0
               OR COUNT(r.id) FILTER (WHERE r.is_consumed = FALSE) > 0
            ORDER BY i.film_type, i.roll_size NULLS LAST
            """
        )
        stock_by_type = [
            {
                "film_type": row[0],
                "custom_type": row[1],
                "roll_size": row[2],
                "roll_count": row[3] or 0,
                "total_weight": float(row[4] or 0),
            }
            for row in c.fetchall()
        ]

        return {
            "entries_today": entries_today,
            "weight_received_today": weight_received_today,
            "weight_issued_today": weight_issued_today,
            "entries_month": entries_month,
            "weight_received_month": weight_received_month,
            "weight_issued_month": weight_issued_month,
            "stock_by_type": stock_by_type,
        }
    finally:
        conn.close()


@lamination_router.get("/export")
def export_inward(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        conditions = []
        params = []
        if date_from:
            conditions.append("inward_date >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("inward_date <= %s")
            params.append(date_to)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cursor.execute(
            f"SELECT id FROM laminationfilminward {where} ORDER BY inward_date DESC, id DESC",
            params,
        )
        ids = [row[0] for row in cursor.fetchall()]
    finally:
        conn.close()

    return [_fetch_inward_detail(inward_id) for inward_id in ids]


@lamination_router.get("")
def list_inward(
    search: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conditions = []
    params = []

    if search:
        like = f"%{search}%"
        conditions.append(
            "(i.supplier_name ILIKE %s OR i.invoice_number ILIKE %s OR i.received_by ILIKE %s"
            " OR i.film_type ILIKE %s OR i.remarks ILIKE %s)"
        )
        params.extend([like, like, like, like, like])
    if date_from:
        conditions.append("i.inward_date >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("i.inward_date <= %s")
        params.append(date_to)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT i.id, i.inward_date, i.inward_time, i.supplier_name, i.invoice_number,
                   i.received_by, i.film_type, i.custom_type, i.roll_size, i.remarks,
                   COUNT(r.id) AS roll_count,
                   COALESCE(SUM(r.original_weight), 0) AS total_weight,
                   ARRAY_AGG(r.original_weight ORDER BY r.roll_number) FILTER (WHERE r.id IS NOT NULL) AS roll_weights
            FROM laminationfilminward i
            LEFT JOIN laminationfilmroll r ON r.inward_id = i.id
            {where}
            GROUP BY i.id, i.inward_date, i.inward_time, i.supplier_name, i.invoice_number,
                     i.received_by, i.film_type, i.custom_type, i.roll_size, i.remarks
            ORDER BY i.inward_date DESC, i.inward_time DESC, i.id DESC
            """,
            params,
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "inward_date": str(row[1]) if row[1] else None,
                "inward_time": str(row[2]) if row[2] else None,
                "supplier_name": row[3],
                "invoice_number": row[4],
                "received_by": row[5],
                "film_type": row[6],
                "custom_type": row[7],
                "roll_size": row[8],
                "remarks": row[9],
                "roll_count": row[10] or 0,
                "total_weight": float(row[11] or 0),
                "roll_weights": [float(w) for w in row[12]] if row[12] else [],
            }
            for row in rows
        ]
    finally:
        conn.close()


@lamination_router.get("/{inward_id}")
def get_inward(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_inward_detail(inward_id)


@lamination_router.post("", status_code=status.HTTP_201_CREATED)
def create_inward(
    body: LaminationInwardCreate,
    current_user: dict = Depends(get_current_user),
):
    # Validate required fields
    if not body.supplier_name or not body.supplier_name.strip():
        raise HTTPException(status_code=400, detail="supplier_name is required")
    if not body.received_by or not body.received_by.strip():
        raise HTTPException(status_code=400, detail="received_by is required")
    if not body.film_type or not body.film_type.strip():
        raise HTTPException(status_code=400, detail="film_type is required")
    if not body.rolls:
        raise HTTPException(status_code=400, detail="At least one roll is required")
    for roll in body.rolls:
        if roll.weight <= 0:
            raise HTTPException(status_code=400, detail=f"Roll {roll.roll_number} weight must be greater than 0")
    if body.film_type == "OTHER" and not body.custom_type:
        raise HTTPException(status_code=400, detail="custom_type is required when film_type is OTHER")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO laminationfilminward
                (inward_date, inward_time, supplier_name, invoice_number, received_by, remarks,
                 film_type, custom_type, roll_size, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                body.inward_date,
                body.inward_time,
                body.supplier_name.strip(),
                body.invoice_number.strip() if body.invoice_number else None,
                body.received_by.strip(),
                body.remarks.strip() if body.remarks else None,
                body.film_type.strip(),
                body.custom_type.strip() if body.custom_type else None,
                body.roll_size.strip() if body.roll_size else None,
                current_user["id"],
            ),
        )
        inward_id = cursor.fetchone()[0]

        for roll in body.rolls:
            cursor.execute(
                """
                INSERT INTO laminationfilmroll
                    (inward_id, roll_number, original_weight, remaining_weight, is_consumed)
                VALUES (%s, %s, %s, %s, FALSE)
                """,
                (inward_id, roll.roll_number, roll.weight, roll.weight),
            )

        _remember(cursor, "lamination_supplier_name", body.supplier_name)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_inward_detail(inward_id)


@lamination_router.put("/{inward_id}")
def update_inward(
    inward_id: int,
    body: LaminationInwardCreate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT inward_date, inward_time, created_by FROM laminationfilminward WHERE id = %s",
        (inward_id,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[0]), row[1], row[2], current_user)

    if body.film_type == "OTHER" and not body.custom_type:
        conn.close()
        raise HTTPException(status_code=400, detail="custom_type is required when film_type is OTHER")

    try:
        cursor.execute(
            """
            UPDATE laminationfilminward
            SET supplier_name=%s, invoice_number=%s, received_by=%s, remarks=%s,
                inward_date=%s, inward_time=%s, film_type=%s, custom_type=%s,
                roll_size=%s
            WHERE id=%s
            """,
            (
                body.supplier_name.strip(),
                body.invoice_number.strip() if body.invoice_number else None,
                body.received_by.strip(),
                body.remarks.strip() if body.remarks else None,
                body.inward_date,
                body.inward_time,
                body.film_type.strip(),
                body.custom_type.strip() if body.custom_type else None,
                body.roll_size.strip() if body.roll_size else None,
                inward_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_inward_detail(inward_id)


@lamination_router.delete("/{inward_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inward(
    inward_id: int,
    body: DeleteRequest,
    current_user: dict = Depends(require_admin),
):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=403, detail="Incorrect password")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM laminationfilminward WHERE id = %s", (inward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    try:
        cursor.execute("DELETE FROM laminationfilminward WHERE id = %s", (inward_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()


# ─── Lamination Outward Router ────────────────────────────────────────────────

lamination_outward_router = APIRouter(prefix="/api/lamination-outward", tags=["lamination-outward"])


@lamination_outward_router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT i.film_type, i.custom_type, i.roll_size,
                   COUNT(r.id) FILTER (WHERE r.is_consumed = FALSE) AS roll_count,
                   COALESCE(SUM(r.remaining_weight) FILTER (WHERE r.is_consumed = FALSE), 0) AS total_weight
            FROM laminationfilmroll r
            JOIN laminationfilminward i ON i.id = r.inward_id
            GROUP BY i.film_type, i.custom_type, i.roll_size
            HAVING COALESCE(SUM(r.remaining_weight) FILTER (WHERE r.is_consumed = FALSE), 0) > 0
               OR COUNT(r.id) FILTER (WHERE r.is_consumed = FALSE) > 0
            ORDER BY i.film_type, i.roll_size NULLS LAST
            """
        )
        rows = cursor.fetchall()
        return [
            {
                "film_type": row[0],
                "custom_type": row[1],
                "roll_size": row[2],
                "roll_count": row[3] or 0,
                "total_weight": float(row[4] or 0),
            }
            for row in rows
        ]
    finally:
        conn.close()


@lamination_outward_router.get("")
def list_outward(
    search: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conditions = []
    params = []

    if search:
        like = f"%{search}%"
        conditions.append(
            "(receiver_name ILIKE %s OR issued_by ILIKE %s OR film_type ILIKE %s"
            " OR custom_type ILIKE %s OR remarks ILIKE %s)"
        )
        params.extend([like, like, like, like, like])
    if date_from:
        conditions.append("outward_date >= %s")
        params.append(date_from)
    if date_to:
        conditions.append("outward_date <= %s")
        params.append(date_to)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT id, outward_date, outward_time, receiver_name, issued_by,
                   film_type, custom_type, roll_size, quantity_issued, remarks
            FROM laminationfilmoutward
            {where}
            ORDER BY outward_date DESC, outward_time DESC, id DESC
            """,
            params,
        )
        rows = cursor.fetchall()
        return [
            {
                "id": row[0],
                "outward_date": str(row[1]) if row[1] else None,
                "outward_time": str(row[2]) if row[2] else None,
                "receiver_name": row[3],
                "issued_by": row[4],
                "film_type": row[5],
                "custom_type": row[6],
                "roll_size": row[7],
                "quantity_issued": float(row[8]) if row[8] is not None else None,
                "remarks": row[9],
            }
            for row in rows
        ]
    finally:
        conn.close()


@lamination_outward_router.get("/{outward_id}")
def get_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_outward_detail(outward_id)


@lamination_outward_router.post("", status_code=status.HTTP_201_CREATED)
def create_outward(
    body: LaminationOutwardCreate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 1. Find available rolls FIFO (oldest inward first, roll_number asc)
        cursor.execute(
            """
            SELECT r.id, r.remaining_weight
            FROM laminationfilmroll r
            JOIN laminationfilminward i ON i.id = r.inward_id
            WHERE r.is_consumed = FALSE AND r.remaining_weight > 0
              AND i.film_type = %s
              AND (i.custom_type IS NOT DISTINCT FROM %s)
              AND (i.roll_size IS NOT DISTINCT FROM %s)
            ORDER BY i.inward_date ASC, i.id ASC, r.roll_number ASC
            """,
            (body.film_type, body.custom_type, body.roll_size),
        )
        available_rolls = cursor.fetchall()
        total_available = sum(float(r[1]) for r in available_rolls)

        # 2. Check stock shortage
        if body.quantity_issued > total_available and not body.force_adjustment:
            conn.close()
            return {"status": "stock_shortage", "available": round(total_available, 3)}

        # 3. Insert outward record
        cursor.execute(
            """
            INSERT INTO laminationfilmoutward
                (outward_date, outward_time, receiver_name, issued_by, film_type, custom_type,
                 roll_size, quantity_issued, remarks, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                body.outward_date,
                body.outward_time,
                body.receiver_name,
                body.issued_by,
                body.film_type,
                body.custom_type,
                body.roll_size,
                body.quantity_issued,
                body.remarks,
                current_user["id"],
            ),
        )
        outward_id = cursor.fetchone()[0]

        # 4. FIFO consumption
        remaining_to_issue = float(body.quantity_issued)
        for roll_id, roll_remaining in available_rolls:
            if remaining_to_issue <= 0:
                break
            take = min(remaining_to_issue, float(roll_remaining))
            new_remaining = round(float(roll_remaining) - take, 3)
            cursor.execute(
                "INSERT INTO laminationfilmoutwarditem (outward_id, roll_id, weight_taken) VALUES (%s, %s, %s)",
                (outward_id, roll_id, round(take, 3)),
            )
            cursor.execute(
                "UPDATE laminationfilmroll SET remaining_weight=%s, is_consumed=%s WHERE id=%s",
                (new_remaining, new_remaining <= 0, roll_id),
            )
            remaining_to_issue = round(remaining_to_issue - take, 3)

        # 5. If shortfall, create adjustment
        if remaining_to_issue > 0:
            cursor.execute(
                """
                INSERT INTO laminationfilmadjustment
                    (outward_id, film_type, custom_type, roll_size, quantity, reason)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    outward_id,
                    body.film_type,
                    body.custom_type,
                    body.roll_size,
                    round(remaining_to_issue, 3),
                    "Auto-created due to stock shortage",
                ),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_outward_detail(outward_id)


@lamination_outward_router.put("/{outward_id}")
def update_outward(
    outward_id: int,
    body: LaminationOutwardHeaderUpdate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT outward_date, outward_time, created_by FROM laminationfilmoutward WHERE id = %s",
        (outward_id,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    check_edit_authorization(str(row[0]), row[1], row[2], current_user)

    try:
        cursor.execute(
            """
            UPDATE laminationfilmoutward
            SET outward_date=%s, outward_time=%s, receiver_name=%s, issued_by=%s, remarks=%s
            WHERE id=%s
            """,
            (
                body.outward_date,
                body.outward_time,
                body.receiver_name,
                body.issued_by,
                body.remarks,
                outward_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_outward_detail(outward_id)


@lamination_outward_router.delete("/{outward_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_outward(
    outward_id: int,
    body: DeleteRequest,
    current_user: dict = Depends(get_current_user),
):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=403, detail="Incorrect password")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT outward_date, outward_time, created_by FROM laminationfilmoutward WHERE id = %s",
        (outward_id,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    check_edit_authorization(str(row[0]), row[1], row[2], current_user)

    try:
        # Restore roll weights before deleting
        cursor.execute(
            "SELECT roll_id, weight_taken FROM laminationfilmoutwarditem WHERE outward_id = %s",
            (outward_id,),
        )
        items = cursor.fetchall()
        for roll_id, weight_taken in items:
            cursor.execute(
                "UPDATE laminationfilmroll SET remaining_weight = remaining_weight + %s, is_consumed = FALSE WHERE id = %s",
                (float(weight_taken), roll_id),
            )

        cursor.execute("DELETE FROM laminationfilmoutward WHERE id = %s", (outward_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
