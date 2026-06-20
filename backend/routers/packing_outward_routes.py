from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection

router = APIRouter(prefix="/api/packing-outward", tags=["packing-outward"])


class PackingOutwardItemInput(BaseModel):
    material_type: str
    box_size: Optional[str] = None
    quantity_issued: float
    unit: str


class PackingOutwardCreate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PackingOutwardItemInput]
    force_adjustment: bool = False


class PackingOutwardUpdate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class DeleteRequest(BaseModel):
    password: str


def _fmt_box(length, width, height) -> str:
    def _n(v):
        return str(int(v)) if float(v) == int(float(v)) else str(float(v))
    return f"{_n(length)}x{_n(width)}x{_n(height)}"


def _available(cursor, material_type: str, box_size: Optional[str], unit: str) -> float:
    if material_type == "Printed Corrugated Boxes":
        cursor.execute("""
            SELECT COALESCE(SUM(bs.num_boxes), 0)
            FROM PMBoxSizes bs
            JOIN PackingMaterialItems pmi ON pmi.id = bs.item_id
            WHERE pmi.material_type = 'Printed Corrugated Boxes'
        """)
        total_inward = float(cursor.fetchone()[0] or 0)

        if box_size:
            parts = box_size.split("x")
            if len(parts) == 3:
                try:
                    l, w, h = float(parts[0]), float(parts[1]), float(parts[2])
                    cursor.execute("""
                        SELECT COALESCE(SUM(bs.num_boxes), 0)
                        FROM PMBoxSizes bs
                        JOIN PackingMaterialItems pmi ON pmi.id = bs.item_id
                        WHERE pmi.material_type = 'Printed Corrugated Boxes'
                        AND ABS(bs.length - %s) < 0.001 AND ABS(bs.width - %s) < 0.001 AND ABS(bs.height - %s) < 0.001
                    """, (l, w, h))
                    total_inward = float(cursor.fetchone()[0] or 0)
                except ValueError:
                    pass

        cursor.execute(
            "SELECT COALESCE(SUM(quantity_issued), 0) FROM PackingOutwardItems WHERE material_type = %s AND (box_size = %s OR (box_size IS NULL AND %s IS NULL))",
            (material_type, box_size, box_size),
        )
        outward = float(cursor.fetchone()[0] or 0)
        cursor.execute(
            "SELECT COALESCE(SUM(quantity), 0) FROM PackingAdjustmentEntries WHERE material_type = %s AND (box_size = %s OR (box_size IS NULL AND %s IS NULL))",
            (material_type, box_size, box_size),
        )
        adj = float(cursor.fetchone()[0] or 0)
        return total_inward + adj - outward

    elif material_type == "Plastic Roll":
        cursor.execute("""
            SELECT COALESCE(SUM(prw.weight), 0)
            FROM PMRollWeights prw
            JOIN PackingMaterialItems pmi ON pmi.id = prw.item_id
            WHERE pmi.material_type = 'Plastic Roll'
        """)
        inward = float(cursor.fetchone()[0] or 0)

    elif material_type == "Shrink Wrap Film":
        cursor.execute("""
            SELECT COALESCE(SUM(prw.weight), 0)
            FROM PMRollWeights prw
            JOIN PackingMaterialItems pmi ON pmi.id = prw.item_id
            WHERE pmi.material_type = 'Shrink Wrap Film'
        """)
        inward = float(cursor.fetchone()[0] or 0)

    elif material_type == "Sutli":
        cursor.execute("""
            SELECT COALESCE(SUM(sg.bundle_quantity), 0)
            FROM PMSutliGroups sg
            JOIN PackingMaterialItems pmi ON pmi.id = sg.item_id
            WHERE pmi.material_type = 'Sutli'
        """)
        inward = float(cursor.fetchone()[0] or 0)

    else:
        return 0.0

    cursor.execute(
        "SELECT COALESCE(SUM(quantity_issued), 0) FROM PackingOutwardItems WHERE material_type = %s",
        (material_type,),
    )
    outward = float(cursor.fetchone()[0] or 0)
    cursor.execute(
        "SELECT COALESCE(SUM(quantity), 0) FROM PackingAdjustmentEntries WHERE material_type = %s",
        (material_type,),
    )
    adj = float(cursor.fetchone()[0] or 0)
    return inward + adj - outward


def _fetch_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT o.id, o.outward_date, o.outward_time, o.issued_by, o.received_by, o.remarks, "
        "o.created_by, u.username "
        "FROM PackingOutward o LEFT JOIN Users u ON o.created_by = u.id WHERE o.id = %s",
        (outward_id,),
    )
    h = cursor.fetchone()
    if not h:
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")

    cursor.execute(
        "SELECT id, material_type, box_size, quantity_issued, unit FROM PackingOutwardItems WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    items = [{"id": r[0], "material_type": r[1], "box_size": r[2], "quantity_issued": float(r[3]), "unit": r[4]} for r in cursor.fetchall()]

    cursor.execute(
        "SELECT id, material_type, box_size, quantity, unit, reason FROM PackingAdjustmentEntries WHERE outward_id = %s ORDER BY id",
        (outward_id,),
    )
    adjustments = [{"id": r[0], "material_type": r[1], "box_size": r[2], "quantity": float(r[3]), "unit": r[4], "reason": r[5]} for r in cursor.fetchall()]

    conn.close()
    return {
        "id": h[0], "outward_date": h[1], "outward_time": h[2],
        "issued_by": h[3], "received_by": h[4], "remarks": h[5],
        "created_by_id": h[6], "created_by_name": h[7],
        "items": items, "adjustments": adjustments,
    }


@router.get("/stock-containers")
def get_stock_containers(
    material_type: str = Query(...),
    box_size: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    groups = []
    if material_type == "Printed Corrugated Boxes" and box_size:
        parts = box_size.split("x")
        try:
            l, w, h = float(parts[0]), float(parts[1]), float(parts[2])
            cursor.execute("""
                SELECT bs.num_boxes
                FROM PMBoxSizes bs
                JOIN PackingMaterialItems pmi ON pmi.id = bs.item_id
                WHERE pmi.material_type = 'Printed Corrugated Boxes'
                  AND ABS(bs.length - %s) < 0.001 AND ABS(bs.width - %s) < 0.001 AND ABS(bs.height - %s) < 0.001
                ORDER BY bs.id ASC
            """, (l, w, h))
            groups = [{"number_of_packs": 1, "quantity_per_pack": float(r[0]), "group_quantity": float(r[0])} for r in cursor.fetchall()]
        except (ValueError, IndexError):
            pass

    elif material_type in ("Plastic Roll", "Shrink Wrap Film"):
        cursor.execute("""
            SELECT prw.weight
            FROM PMRollWeights prw
            JOIN PackingMaterialItems pmi ON pmi.id = prw.item_id
            WHERE pmi.material_type = %s
            ORDER BY prw.id ASC
        """, (material_type,))
        groups = [{"number_of_packs": 1, "quantity_per_pack": float(r[0]), "group_quantity": float(r[0])} for r in cursor.fetchall()]

    elif material_type == "Sutli":
        cursor.execute("""
            SELECT sg.bundle_quantity
            FROM PMSutliGroups sg
            JOIN PackingMaterialItems pmi ON pmi.id = sg.item_id
            WHERE pmi.material_type = 'Sutli'
            ORDER BY sg.id ASC
        """)
        groups = [{"number_of_packs": 1, "quantity_per_pack": float(r[0]), "group_quantity": float(r[0])} for r in cursor.fetchall()]

    conn.close()
    return {"groups": groups}


@router.get("/stock")
def get_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    result = []

    cursor.execute("""
        SELECT bs.length, bs.width, bs.height, SUM(bs.num_boxes) as total
        FROM PMBoxSizes bs
        JOIN PackingMaterialItems pmi ON pmi.id = bs.item_id
        WHERE pmi.material_type = 'Printed Corrugated Boxes'
        GROUP BY bs.length, bs.width, bs.height
        ORDER BY bs.length, bs.width, bs.height
    """)
    for length, width, height, total_inward in cursor.fetchall():
        box_size = _fmt_box(length, width, height)
        cursor.execute(
            "SELECT COALESCE(SUM(quantity_issued), 0) FROM PackingOutwardItems WHERE material_type = 'Printed Corrugated Boxes' AND box_size = %s",
            (box_size,),
        )
        outward = float(cursor.fetchone()[0] or 0)
        cursor.execute(
            "SELECT COALESCE(SUM(quantity), 0) FROM PackingAdjustmentEntries WHERE material_type = 'Printed Corrugated Boxes' AND box_size = %s",
            (box_size,),
        )
        adj = float(cursor.fetchone()[0] or 0)
        result.append({
            "material_type": "Printed Corrugated Boxes",
            "box_size": box_size,
            "display_label": f"{int(length) if length == int(length) else length} × {int(width) if width == int(width) else width} × {int(height) if height == int(height) else height}",
            "unit": "Boxes",
            "available_qty": round(float(total_inward) + adj - outward, 0),
        })

    cursor.execute("""
        SELECT COALESCE(SUM(prw.weight), 0) FROM PMRollWeights prw
        JOIN PackingMaterialItems pmi ON pmi.id = prw.item_id WHERE pmi.material_type = 'Plastic Roll'
    """)
    plastic_inward = float(cursor.fetchone()[0] or 0)
    if plastic_inward > 0:
        cursor.execute("SELECT COALESCE(SUM(quantity_issued), 0) FROM PackingOutwardItems WHERE material_type = 'Plastic Roll'")
        plastic_out = float(cursor.fetchone()[0] or 0)
        cursor.execute("SELECT COALESCE(SUM(quantity), 0) FROM PackingAdjustmentEntries WHERE material_type = 'Plastic Roll'")
        plastic_adj = float(cursor.fetchone()[0] or 0)
        result.append({"material_type": "Plastic Roll", "box_size": None, "display_label": "Plastic Roll", "unit": "Kg", "available_qty": round(plastic_inward + plastic_adj - plastic_out, 3)})

    cursor.execute("""
        SELECT COALESCE(SUM(prw.weight), 0) FROM PMRollWeights prw
        JOIN PackingMaterialItems pmi ON pmi.id = prw.item_id WHERE pmi.material_type = 'Shrink Wrap Film'
    """)
    shrink_inward = float(cursor.fetchone()[0] or 0)
    if shrink_inward > 0:
        cursor.execute("SELECT COALESCE(SUM(quantity_issued), 0) FROM PackingOutwardItems WHERE material_type = 'Shrink Wrap Film'")
        shrink_out = float(cursor.fetchone()[0] or 0)
        cursor.execute("SELECT COALESCE(SUM(quantity), 0) FROM PackingAdjustmentEntries WHERE material_type = 'Shrink Wrap Film'")
        shrink_adj = float(cursor.fetchone()[0] or 0)
        result.append({"material_type": "Shrink Wrap Film", "box_size": None, "display_label": "Shrink Wrap Film", "unit": "Kg", "available_qty": round(shrink_inward + shrink_adj - shrink_out, 3)})

    cursor.execute("""
        SELECT COALESCE(SUM(sg.bundle_quantity), 0) FROM PMSutliGroups sg
        JOIN PackingMaterialItems pmi ON pmi.id = sg.item_id WHERE pmi.material_type = 'Sutli'
    """)
    sutli_inward = float(cursor.fetchone()[0] or 0)
    if sutli_inward > 0:
        cursor.execute("SELECT COALESCE(SUM(quantity_issued), 0) FROM PackingOutwardItems WHERE material_type = 'Sutli'")
        sutli_out = float(cursor.fetchone()[0] or 0)
        cursor.execute("SELECT COALESCE(SUM(quantity), 0) FROM PackingAdjustmentEntries WHERE material_type = 'Sutli'")
        sutli_adj = float(cursor.fetchone()[0] or 0)
        result.append({"material_type": "Sutli", "box_size": None, "display_label": "Sutli", "unit": "Bundles", "available_qty": round(sutli_inward + sutli_adj - sutli_out, 0)})

    conn.close()
    return result


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def _today_qty(mat_type):
        cursor.execute(
            "SELECT COALESCE(SUM(poi.quantity_issued), 0) FROM PackingOutwardItems poi "
            "JOIN PackingOutward po ON po.id = poi.outward_id "
            "WHERE poi.material_type = %s AND po.outward_date::date = CURRENT_DATE",
            (mat_type,),
        )
        return round(float(cursor.fetchone()[0] or 0), 3)

    def _month_qty(mat_type):
        cursor.execute(
            "SELECT COALESCE(SUM(poi.quantity_issued), 0) FROM PackingOutwardItems poi "
            "JOIN PackingOutward po ON po.id = poi.outward_id "
            "WHERE poi.material_type = %s AND DATE_TRUNC('month', po.outward_date) = DATE_TRUNC('month', CURRENT_DATE)",
            (mat_type,),
        )
        return round(float(cursor.fetchone()[0] or 0), 3)

    cursor.execute("SELECT COUNT(*) FROM PackingOutward WHERE outward_date::date = CURRENT_DATE")
    today_entries = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM PackingOutward WHERE DATE_TRUNC('month', outward_date) = DATE_TRUNC('month', CURRENT_DATE)")
    month_entries = cursor.fetchone()[0]

    conn.close()
    return {
        "today": {
            "total_entries": today_entries,
            "boxes_issued": _today_qty("Printed Corrugated Boxes"),
            "plastic_kg": _today_qty("Plastic Roll"),
            "shrink_wrap_kg": _today_qty("Shrink Wrap Film"),
            "sutli_bundles": _today_qty("Sutli"),
        },
        "month": {
            "total_entries": month_entries,
            "boxes_issued": _month_qty("Printed Corrugated Boxes"),
            "plastic_kg": _month_qty("Plastic Roll"),
            "shrink_wrap_kg": _month_qty("Shrink Wrap Film"),
            "sutli_bundles": _month_qty("Sutli"),
        },
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
        where.append("outward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("outward_date <= %s")
        params.append(date_to)
    cursor.execute(f"SELECT id FROM PackingOutward WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id", params)
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
            "(po.issued_by ILIKE %s OR po.received_by ILIKE %s OR po.remarks ILIKE %s "
            "OR TO_CHAR(po.outward_date, 'YYYY-MM-DD') ILIKE %s "
            "OR TO_CHAR(po.outward_time, 'HH24:MI:SS') ILIKE %s "
            "OR EXISTS (SELECT 1 FROM PackingOutwardItems poi WHERE poi.outward_id = po.id "
            "AND (poi.material_type ILIKE %s OR COALESCE(poi.box_size,'') ILIKE %s OR poi.unit ILIKE %s OR poi.quantity_issued::text ILIKE %s)))"
        )
        params.extend([like] * 9)
    if date_from:
        where.append("po.outward_date >= %s"); params.append(date_from)
    if date_to:
        where.append("po.outward_date <= %s"); params.append(date_to)

    cursor.execute(
        f"SELECT po.id, po.outward_date, po.outward_time, po.issued_by, po.received_by, po.remarks "
        f"FROM PackingOutward po WHERE {' AND '.join(where)} ORDER BY po.outward_date DESC, po.outward_time DESC, po.id DESC",
        params,
    )
    rows = cursor.fetchall()
    if not rows:
        conn.close()
        return []

    ids = [r[0] for r in rows]
    ph = ",".join(["%s"] * len(ids))
    cursor.execute(
        f"SELECT outward_id, material_type, box_size, quantity_issued, unit FROM PackingOutwardItems WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
        ids,
    )
    items_map: dict = {}
    for ir in cursor.fetchall():
        items_map.setdefault(ir[0], []).append({"material_type": ir[1], "box_size": ir[2], "quantity_issued": float(ir[3]), "unit": ir[4]})

    conn.close()
    return [
        {"id": r[0], "outward_date": r[1], "outward_time": r[2], "issued_by": r[3], "received_by": r[4], "remarks": r[5], "items": items_map.get(r[0], [])}
        for r in rows
    ]


@router.get("/{outward_id}")
def get_entry(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(outward_id)


@router.post("")
def create_entry(body: PackingOutwardCreate, current_user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    conn = get_connection()
    cursor = conn.cursor()

    if not body.force_adjustment:
        shortages = []
        for item in body.items:
            avail = _available(cursor, item.material_type, item.box_size, item.unit)
            if item.quantity_issued > avail:
                label = f"{item.material_type} ({item.box_size})" if item.box_size else item.material_type
                shortages.append({
                    "item_name": label, "unit": item.unit,
                    "available_qty": round(avail, 3),
                    "requested_qty": round(item.quantity_issued, 3),
                    "shortage_qty": round(item.quantity_issued - avail, 3),
                })
        if shortages:
            conn.close()
            return {"status": "stock_shortage", "shortages": shortages}

    try:
        cursor.execute(
            "INSERT INTO PackingOutward (outward_date, outward_time, issued_by, received_by, remarks, created_by) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (body.outward_date, body.outward_time or None,
             body.issued_by.strip() if body.issued_by else None,
             body.received_by.strip() if body.received_by else None,
             body.remarks.strip() if body.remarks else None, current_user["id"]),
        )
        outward_id = cursor.fetchone()[0]

        for item in body.items:
            avail = _available(cursor, item.material_type, item.box_size, item.unit)
            if item.quantity_issued > avail:
                shortage = round(item.quantity_issued - avail, 3)
                cursor.execute(
                    "INSERT INTO PackingAdjustmentEntries (outward_id, material_type, box_size, quantity, unit, reason) VALUES (%s, %s, %s, %s, %s, %s)",
                    (outward_id, item.material_type, item.box_size, shortage, item.unit,
                     f"Auto-created due to outward stock shortage (Outward #{outward_id})"),
                )
            cursor.execute(
                "INSERT INTO PackingOutwardItems (outward_id, material_type, box_size, quantity_issued, unit) VALUES (%s, %s, %s, %s, %s)",
                (outward_id, item.material_type, item.box_size, round(item.quantity_issued, 3), item.unit),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(outward_id)


@router.put("/{outward_id}")
def update_entry(outward_id: int, body: PackingOutwardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT outward_date, outward_time, created_by FROM PackingOutward WHERE id = %s", (outward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE PackingOutward SET outward_date=%s, outward_time=%s, issued_by=%s, received_by=%s, remarks=%s WHERE id=%s",
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
def delete_entry(outward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM PackingOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    cursor.execute("DELETE FROM PackingOutward WHERE id = %s", (outward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
