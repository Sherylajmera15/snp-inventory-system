from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection

router = APIRouter(prefix="/api/oil-outward", tags=["oil-outward"])


class OilOutwardItemInput(BaseModel):
    item_name: str
    unit: str
    quantity_issued: float


class OilOutwardCreate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    machine_name: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[OilOutwardItemInput]
    force_adjustment: bool = False


class OilOutwardUpdate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    machine_name: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class DeleteRequest(BaseModel):
    password: str


def _available(cursor, item_name: str, unit: str) -> float:
    cursor.execute(
        """
        SELECT
            COALESCE((SELECT SUM(qg.group_quantity) FROM OilItems i JOIN OilQuantityGroups qg ON qg.item_id = i.id WHERE i.oil_name = %s AND qg.unit = %s), 0)
            + COALESCE((SELECT SUM(quantity) FROM OilAdjustmentEntries WHERE item_name = %s AND unit = %s), 0)
            - COALESCE((SELECT SUM(quantity_issued) FROM OilOutwardItems WHERE item_name = %s AND unit = %s), 0)
        """,
        (item_name, unit, item_name, unit, item_name, unit),
    )
    row = cursor.fetchone()
    return float(row[0]) if row else 0.0


def _fetch_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT o.id, o.outward_date, o.outward_time, o.machine_name, o.issued_by, o.received_by, o.remarks, "
        "o.created_by, u.username "
        "FROM OilOutward o LEFT JOIN Users u ON o.created_by = u.id WHERE o.id = %s",
        (outward_id,),
    )
    h = cursor.fetchone()
    if not h:
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")

    cursor.execute(
        "SELECT id, item_name, quantity_issued, unit FROM OilOutwardItems WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    items = [{"id": r[0], "item_name": r[1], "quantity_issued": float(r[2]), "unit": r[3]} for r in cursor.fetchall()]

    cursor.execute(
        "SELECT id, item_name, quantity, unit, reason FROM OilAdjustmentEntries WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    adjustments = [{"id": r[0], "item_name": r[1], "quantity": float(r[2]), "unit": r[3], "reason": r[4]} for r in cursor.fetchall()]

    conn.close()
    return {
        "id": h[0], "outward_date": h[1], "outward_time": h[2], "machine_name": h[3],
        "issued_by": h[4], "received_by": h[5], "remarks": h[6],
        "created_by_id": h[7], "created_by_name": h[8],
        "items": items, "adjustments": adjustments,
    }


@router.get("/stock-containers")
def get_stock_containers(
    item_name: str = Query(...),
    unit: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT qg.number_of_packs, qg.quantity_per_pack, qg.group_quantity
        FROM OilItems i
        JOIN OilQuantityGroups qg ON qg.item_id = i.id
        WHERE i.oil_name = %s AND qg.unit = %s
        ORDER BY i.id ASC, qg.group_number ASC
    """, (item_name, unit))
    rows = cursor.fetchall()
    conn.close()
    return {
        "groups": [
            {"number_of_packs": float(r[0]), "quantity_per_pack": float(r[1]), "group_quantity": float(r[2])}
            for r in rows
        ]
    }


@router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.oil_name, qg.unit,
            COALESCE(SUM(qg.group_quantity), 0)
            + COALESCE((SELECT SUM(adj.quantity) FROM OilAdjustmentEntries adj WHERE adj.item_name = i.oil_name AND adj.unit = qg.unit), 0)
            - COALESCE((SELECT SUM(oi.quantity_issued) FROM OilOutwardItems oi WHERE oi.item_name = i.oil_name AND oi.unit = qg.unit), 0)
            AS available_qty
        FROM OilItems i
        JOIN OilQuantityGroups qg ON qg.item_id = i.id
        GROUP BY i.oil_name, qg.unit
        ORDER BY i.oil_name, qg.unit
    """)
    rows = cursor.fetchall()
    conn.close()
    return [{"item_name": r[0], "unit": r[1], "available_qty": round(float(r[2]), 3)} for r in rows]


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM OilOutward WHERE outward_date::date = CURRENT_DATE")
    today_entries = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM OilOutward WHERE DATE_TRUNC('month', outward_date) = DATE_TRUNC('month', CURRENT_DATE)")
    month_entries = cursor.fetchone()[0]

    cursor.execute(
        "SELECT oi.item_name, oi.unit, SUM(oi.quantity_issued) AS total FROM OilOutwardItems oi "
        "JOIN OilOutward o ON o.id = oi.outward_id WHERE o.outward_date::date = CURRENT_DATE "
        "GROUP BY oi.item_name, oi.unit ORDER BY total DESC LIMIT 5"
    )
    today_top = [{"item_name": r[0], "unit": r[1], "total_qty": round(float(r[2]), 3)} for r in cursor.fetchall()]

    cursor.execute(
        "SELECT oi.item_name, oi.unit, SUM(oi.quantity_issued) AS total FROM OilOutwardItems oi "
        "JOIN OilOutward o ON o.id = oi.outward_id "
        "WHERE DATE_TRUNC('month', o.outward_date) = DATE_TRUNC('month', CURRENT_DATE) "
        "GROUP BY oi.item_name, oi.unit ORDER BY total DESC LIMIT 5"
    )
    month_top = [{"item_name": r[0], "unit": r[1], "total_qty": round(float(r[2]), 3)} for r in cursor.fetchall()]

    cursor.execute(
        "SELECT item_name, unit, SUM(quantity_issued) AS total FROM OilOutwardItems "
        "GROUP BY item_name, unit ORDER BY total DESC LIMIT 10"
    )
    top_consumed = [{"item_name": r[0], "unit": r[1], "total_qty": round(float(r[2]), 3)} for r in cursor.fetchall()]

    cursor.execute(
        "SELECT machine_name, COUNT(*) AS cnt FROM OilOutward WHERE machine_name IS NOT NULL AND machine_name <> '' "
        "GROUP BY machine_name ORDER BY cnt DESC LIMIT 10"
    )
    top_machines = [{"machine_name": r[0], "entry_count": r[1]} for r in cursor.fetchall()]

    conn.close()
    return {
        "today": {"total_entries": today_entries, "top_consumed": today_top},
        "month": {"total_entries": month_entries, "top_consumed": month_top},
        "top_consumed": top_consumed,
        "top_machines": top_machines,
    }


@router.get("/export")
def export_entries(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["1=1"]
    params: list = []
    if date_from:
        where.append("outward_date >= %s"); params.append(date_from)
    if date_to:
        where.append("outward_date <= %s"); params.append(date_to)
    cursor.execute(f"SELECT id FROM OilOutward WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id", params)
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("")
def list_entries(
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["1=1"]
    params: list = []
    if search:
        like = f"%{search}%"
        where.append(
            "(o.machine_name ILIKE %s OR o.issued_by ILIKE %s OR o.received_by ILIKE %s OR o.remarks ILIKE %s "
            "OR TO_CHAR(o.outward_date, 'YYYY-MM-DD') ILIKE %s OR TO_CHAR(o.outward_time, 'HH24:MI:SS') ILIKE %s "
            "OR EXISTS (SELECT 1 FROM OilOutwardItems oi WHERE oi.outward_id = o.id "
            "AND (oi.item_name ILIKE %s OR oi.unit ILIKE %s OR oi.quantity_issued::text ILIKE %s)))"
        )
        params.extend([like] * 9)
    if date_from:
        where.append("o.outward_date >= %s"); params.append(date_from)
    if date_to:
        where.append("o.outward_date <= %s"); params.append(date_to)

    cursor.execute(
        f"SELECT o.id, o.outward_date, o.outward_time, o.machine_name, o.issued_by, o.received_by, o.remarks "
        f"FROM OilOutward o WHERE {' AND '.join(where)} ORDER BY o.outward_date DESC, o.outward_time DESC, o.id DESC",
        params,
    )
    rows = cursor.fetchall()
    if not rows:
        conn.close()
        return []

    ids = [r[0] for r in rows]
    ph = ",".join(["%s"] * len(ids))
    cursor.execute(
        f"SELECT outward_id, item_name, quantity_issued, unit FROM OilOutwardItems WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
        ids,
    )
    items_map: dict = {}
    for ir in cursor.fetchall():
        items_map.setdefault(ir[0], []).append({"item_name": ir[1], "quantity_issued": float(ir[2]), "unit": ir[3]})

    conn.close()
    return [
        {"id": r[0], "outward_date": r[1], "outward_time": r[2], "machine_name": r[3],
         "issued_by": r[4], "received_by": r[5], "remarks": r[6], "items": items_map.get(r[0], [])}
        for r in rows
    ]


@router.get("/{outward_id}")
def get_entry(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(outward_id)


@router.post("")
def create_entry(body: OilOutwardCreate, current_user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="At least one item is required")
    conn = get_connection()
    cursor = conn.cursor()

    if not body.force_adjustment:
        shortages = []
        for item in body.items:
            avail = _available(cursor, item.item_name, item.unit)
            if item.quantity_issued > avail:
                shortages.append({
                    "item_name": item.item_name, "unit": item.unit,
                    "available_qty": round(avail, 3),
                    "requested_qty": round(item.quantity_issued, 3),
                    "shortage_qty": round(item.quantity_issued - avail, 3),
                })
        if shortages:
            conn.close()
            return {"status": "stock_shortage", "shortages": shortages}

    try:
        cursor.execute(
            "INSERT INTO OilOutward (outward_date, outward_time, machine_name, issued_by, received_by, remarks, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.outward_date, body.outward_time or None,
             body.machine_name.strip() if body.machine_name else None,
             body.issued_by.strip() if body.issued_by else None,
             body.received_by.strip() if body.received_by else None,
             body.remarks.strip() if body.remarks else None, current_user["id"]),
        )
        outward_id = cursor.fetchone()[0]

        for item in body.items:
            avail = _available(cursor, item.item_name, item.unit)
            if item.quantity_issued > avail:
                shortage = round(item.quantity_issued - avail, 3)
                cursor.execute(
                    "INSERT INTO OilAdjustmentEntries (outward_id, item_name, quantity, unit, reason) VALUES (%s, %s, %s, %s, %s)",
                    (outward_id, item.item_name, shortage, item.unit,
                     f"Auto-created due to outward stock shortage (Outward #{outward_id})"),
                )
            cursor.execute(
                "INSERT INTO OilOutwardItems (outward_id, item_name, quantity_issued, unit) VALUES (%s, %s, %s, %s)",
                (outward_id, item.item_name, round(item.quantity_issued, 3), item.unit),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(outward_id)


@router.put("/{outward_id}")
def update_entry(outward_id: int, body: OilOutwardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT outward_date, outward_time, created_by FROM OilOutward WHERE id = %s", (outward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE OilOutward SET outward_date=%s, outward_time=%s, machine_name=%s, "
        "issued_by=%s, received_by=%s, remarks=%s WHERE id=%s",
        (body.outward_date, body.outward_time or None,
         body.machine_name.strip() if body.machine_name else None,
         body.issued_by.strip() if body.issued_by else None,
         body.received_by.strip() if body.received_by else None,
         body.remarks.strip() if body.remarks else None,
         outward_id),
    )
    conn.commit()
    conn.close()
    return _fetch_detail(outward_id)


@router.delete("/{outward_id}")
def delete_entry(outward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM OilOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    cursor.execute("DELETE FROM OilOutward WHERE id = %s", (outward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
