"""
Factory that creates identical outward routers for Chemicals, Adhesives, and Consumables.
Each module shares the same API shape; only the table names differ.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection


class SimpleOutwardItemInput(BaseModel):
    item_name: str
    unit: str
    quantity_issued: float


class SimpleOutwardCreate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[SimpleOutwardItemInput]
    force_adjustment: bool = False


class DeleteRequest(BaseModel):
    password: str


class SimpleOutwardUpdate(BaseModel):
    outward_date: str
    outward_time: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


def make_outward_router(
    prefix: str,
    tag: str,
    inward_items_table: str,
    item_name_col: str,
    qty_groups_table: str,
    outward_table: str,
    outward_items_table: str,
    adj_table: str,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    def _available(cursor, item_name: str, unit: str) -> float:
        cursor.execute(
            f"""
            SELECT
                COALESCE((
                    SELECT SUM(qg.group_quantity)
                    FROM {inward_items_table} i
                    JOIN {qty_groups_table} qg ON qg.item_id = i.id
                    WHERE i.{item_name_col} = %s AND qg.unit = %s
                ), 0)
                + COALESCE((
                    SELECT SUM(quantity) FROM {adj_table} WHERE item_name = %s AND unit = %s
                ), 0)
                - COALESCE((
                    SELECT SUM(quantity_issued) FROM {outward_items_table} WHERE item_name = %s AND unit = %s
                ), 0)
            """,
            (item_name, unit, item_name, unit, item_name, unit),
        )
        row = cursor.fetchone()
        return float(row[0]) if row else 0.0

    def _fetch_detail(outward_id: int) -> dict:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            f"SELECT o.id, o.outward_date, o.outward_time, o.issued_by, o.received_by, o.remarks, "
            f"o.created_by, u.username "
            f"FROM {outward_table} o LEFT JOIN Users u ON o.created_by = u.id WHERE o.id = %s",
            (outward_id,),
        )
        h = cursor.fetchone()
        if not h:
            conn.close()
            raise HTTPException(status_code=404, detail="Entry not found")

        cursor.execute(
            f"SELECT id, item_name, quantity_issued, unit "
            f"FROM {outward_items_table} WHERE outward_id = %s ORDER BY id",
            (outward_id,),
        )
        items = [
            {"id": r[0], "item_name": r[1], "quantity_issued": float(r[2]), "unit": r[3]}
            for r in cursor.fetchall()
        ]

        cursor.execute(
            f"SELECT id, item_name, quantity, unit, reason "
            f"FROM {adj_table} WHERE outward_id = %s ORDER BY id",
            (outward_id,),
        )
        adjustments = [
            {"id": r[0], "item_name": r[1], "quantity": float(r[2]), "unit": r[3], "reason": r[4]}
            for r in cursor.fetchall()
        ]

        conn.close()
        return {
            "id": h[0],
            "outward_date": h[1],
            "outward_time": h[2],
            "issued_by": h[3],
            "received_by": h[4],
            "remarks": h[5],
            "created_by_id": h[6],
            "created_by_name": h[7],
            "items": items,
            "adjustments": adjustments,
        }

    @router.get("/stock-containers")
    def get_stock_containers(
        item_name: str = Query(...),
        unit: str = Query(...),
        current_user: dict = Depends(get_current_user),
    ):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT qg.number_of_packs, qg.quantity_per_pack, qg.group_quantity
            FROM {inward_items_table} i
            JOIN {qty_groups_table} qg ON qg.item_id = i.id
            WHERE i.{item_name_col} = %s AND qg.unit = %s
            ORDER BY i.id ASC, qg.group_number ASC
            """,
            (item_name, unit),
        )
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
        cursor.execute(
            f"""
            SELECT
                i.{item_name_col} AS item_name,
                qg.unit,
                COALESCE(SUM(qg.group_quantity), 0)
                + COALESCE((SELECT SUM(adj.quantity) FROM {adj_table} adj
                            WHERE adj.item_name = i.{item_name_col} AND adj.unit = qg.unit), 0)
                - COALESCE((SELECT SUM(oi.quantity_issued) FROM {outward_items_table} oi
                            WHERE oi.item_name = i.{item_name_col} AND oi.unit = qg.unit), 0)
                AS available_qty
            FROM {inward_items_table} i
            JOIN {qty_groups_table} qg ON qg.item_id = i.id
            GROUP BY i.{item_name_col}, qg.unit
            ORDER BY i.{item_name_col}, qg.unit
            """
        )
        rows = cursor.fetchall()
        conn.close()
        return [
            {"item_name": r[0], "unit": r[1], "available_qty": round(float(r[2]), 3)}
            for r in rows
        ]

    @router.get("/analytics")
    def get_analytics(current_user: dict = Depends(get_current_user)):
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(f"SELECT COUNT(*) FROM {outward_table} WHERE outward_date::date = CURRENT_DATE")
        today_entries = cursor.fetchone()[0]

        cursor.execute(
            f"SELECT COUNT(*) FROM {outward_items_table} oi "
            f"JOIN {outward_table} o ON o.id = oi.outward_id "
            f"WHERE o.outward_date::date = CURRENT_DATE"
        )
        today_items = cursor.fetchone()[0]

        cursor.execute(
            f"SELECT oi.item_name, oi.unit, SUM(oi.quantity_issued) AS total "
            f"FROM {outward_items_table} oi JOIN {outward_table} o ON o.id = oi.outward_id "
            f"WHERE o.outward_date::date = CURRENT_DATE "
            f"GROUP BY oi.item_name, oi.unit ORDER BY total DESC LIMIT 5"
        )
        today_top = [
            {"item_name": r[0], "unit": r[1], "total_qty": round(float(r[2]), 3)}
            for r in cursor.fetchall()
        ]

        cursor.execute(
            f"SELECT COUNT(*) FROM {outward_table} "
            f"WHERE DATE_TRUNC('month', outward_date) = DATE_TRUNC('month', CURRENT_DATE)"
        )
        month_entries = cursor.fetchone()[0]

        cursor.execute(
            f"SELECT COUNT(*) FROM {outward_items_table} oi "
            f"JOIN {outward_table} o ON o.id = oi.outward_id "
            f"WHERE DATE_TRUNC('month', o.outward_date) = DATE_TRUNC('month', CURRENT_DATE)"
        )
        month_items = cursor.fetchone()[0]

        cursor.execute(
            f"SELECT oi.item_name, oi.unit, SUM(oi.quantity_issued) AS total "
            f"FROM {outward_items_table} oi JOIN {outward_table} o ON o.id = oi.outward_id "
            f"WHERE DATE_TRUNC('month', o.outward_date) = DATE_TRUNC('month', CURRENT_DATE) "
            f"GROUP BY oi.item_name, oi.unit ORDER BY total DESC LIMIT 5"
        )
        month_top = [
            {"item_name": r[0], "unit": r[1], "total_qty": round(float(r[2]), 3)}
            for r in cursor.fetchall()
        ]

        cursor.execute(
            f"SELECT item_name, unit, SUM(quantity_issued) AS total FROM {outward_items_table} "
            f"GROUP BY item_name, unit ORDER BY total DESC LIMIT 10"
        )
        top_consumed = [
            {"item_name": r[0], "unit": r[1], "total_qty": round(float(r[2]), 3)}
            for r in cursor.fetchall()
        ]

        cursor.execute(
            f"SELECT received_by, COUNT(*) AS cnt FROM {outward_table} "
            f"WHERE received_by IS NOT NULL AND received_by <> '' "
            f"GROUP BY received_by ORDER BY cnt DESC LIMIT 10"
        )
        top_receivers = [{"received_by": r[0], "entry_count": r[1]} for r in cursor.fetchall()]

        conn.close()
        return {
            "today": {"total_entries": today_entries, "total_items": today_items, "top_consumed": today_top},
            "month": {"total_entries": month_entries, "total_items": month_items, "top_consumed": month_top},
            "top_consumed": top_consumed,
            "top_receivers": top_receivers,
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
        cursor.execute(
            f"SELECT id FROM {outward_table} WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id",
            params,
        )
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
                f"(o.issued_by ILIKE %s OR o.received_by ILIKE %s OR o.remarks ILIKE %s "
                f"OR TO_CHAR(o.outward_date, 'YYYY-MM-DD') ILIKE %s "
                f"OR TO_CHAR(o.outward_time, 'HH24:MI:SS') ILIKE %s "
                f"OR EXISTS (SELECT 1 FROM {outward_items_table} oi WHERE oi.outward_id = o.id "
                f"AND (oi.item_name ILIKE %s OR oi.unit ILIKE %s OR oi.quantity_issued::text ILIKE %s)))"
            )
            params.extend([like] * 8)
        if date_from:
            where.append("o.outward_date >= %s")
            params.append(date_from)
        if date_to:
            where.append("o.outward_date <= %s")
            params.append(date_to)

        cursor.execute(
            f"SELECT o.id, o.outward_date, o.outward_time, o.issued_by, o.received_by, o.remarks "
            f"FROM {outward_table} o WHERE {' AND '.join(where)} "
            f"ORDER BY o.outward_date DESC, o.outward_time DESC, o.id DESC",
            params,
        )
        rows = cursor.fetchall()
        if not rows:
            conn.close()
            return []

        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT outward_id, item_name, quantity_issued, unit "
            f"FROM {outward_items_table} WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
            ids,
        )
        items_map: dict = {}
        for ir in cursor.fetchall():
            items_map.setdefault(ir[0], []).append(
                {"item_name": ir[1], "quantity_issued": float(ir[2]), "unit": ir[3]}
            )

        conn.close()
        return [
            {
                "id": r[0], "outward_date": r[1], "outward_time": r[2],
                "issued_by": r[3], "received_by": r[4], "remarks": r[5],
                "items": items_map.get(r[0], []),
            }
            for r in rows
        ]

    @router.get("/{outward_id}")
    def get_entry(outward_id: int, current_user: dict = Depends(get_current_user)):
        return _fetch_detail(outward_id)

    @router.post("")
    def create_entry(body: SimpleOutwardCreate, current_user: dict = Depends(get_current_user)):
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
                        "item_name": item.item_name,
                        "unit": item.unit,
                        "available_qty": round(avail, 3),
                        "requested_qty": round(item.quantity_issued, 3),
                        "shortage_qty": round(item.quantity_issued - avail, 3),
                    })
            if shortages:
                conn.close()
                return {"status": "stock_shortage", "shortages": shortages}

        try:
            cursor.execute(
                f"INSERT INTO {outward_table} "
                f"(outward_date, outward_time, issued_by, received_by, remarks, created_by) "
                f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                (
                    body.outward_date, body.outward_time or None,
                    body.issued_by.strip() if body.issued_by else None,
                    body.received_by.strip() if body.received_by else None,
                    body.remarks.strip() if body.remarks else None,
                    current_user["id"],
                ),
            )
            outward_id = cursor.fetchone()[0]

            for item in body.items:
                avail = _available(cursor, item.item_name, item.unit)
                if item.quantity_issued > avail:
                    shortage = round(item.quantity_issued - avail, 3)
                    cursor.execute(
                        f"INSERT INTO {adj_table} (outward_id, item_name, quantity, unit, reason) "
                        f"VALUES (%s, %s, %s, %s, %s)",
                        (outward_id, item.item_name, shortage, item.unit,
                         f"Auto-created due to outward stock shortage (Outward #{outward_id})"),
                    )

                cursor.execute(
                    f"INSERT INTO {outward_items_table} (outward_id, item_name, quantity_issued, unit) "
                    f"VALUES (%s, %s, %s, %s)",
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
    def update_entry(outward_id: int, body: SimpleOutwardUpdate, current_user: dict = Depends(get_current_user)):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"SELECT outward_date, outward_time, created_by FROM {outward_table} WHERE id = %s", (outward_id,)
        )
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Entry not found")
        conn.close()

        check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE {outward_table} SET outward_date=%s, outward_time=%s, issued_by=%s, received_by=%s, remarks=%s "
            f"WHERE id=%s",
            (
                body.outward_date, body.outward_time or None,
                body.issued_by.strip() if body.issued_by else None,
                body.received_by.strip() if body.received_by else None,
                body.remarks.strip() if body.remarks else None,
                outward_id,
            ),
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
        cursor.execute(f"SELECT id FROM {outward_table} WHERE id = %s", (outward_id,))
        if not cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=404, detail="Entry not found")
        cursor.execute(f"DELETE FROM {outward_table} WHERE id = %s", (outward_id,))
        conn.commit()
        conn.close()
        return {"detail": "Deleted successfully"}

    return router


chemical_outward_router = make_outward_router(
    prefix="/api/chemical-outward",
    tag="chemical-outward",
    inward_items_table="ChemicalItems",
    item_name_col="chemical_name",
    qty_groups_table="ChemicalQuantityGroups",
    outward_table="ChemicalOutward",
    outward_items_table="ChemicalOutwardItems",
    adj_table="ChemicalAdjustmentEntries",
)

adhesive_outward_router = make_outward_router(
    prefix="/api/adhesive-outward",
    tag="adhesive-outward",
    inward_items_table="AdhesiveItems",
    item_name_col="adhesive_name",
    qty_groups_table="AdhesiveQuantityGroups",
    outward_table="AdhesiveOutward",
    outward_items_table="AdhesiveOutwardItems",
    adj_table="AdhesiveAdjustmentEntries",
)

consumable_outward_router = make_outward_router(
    prefix="/api/consumable-outward",
    tag="consumable-outward",
    inward_items_table="ConsumableItems",
    item_name_col="consumable_name",
    qty_groups_table="ConsumableQuantityGroups",
    outward_table="ConsumableOutward",
    outward_items_table="ConsumableOutwardItems",
    adj_table="ConsumableAdjustmentEntries",
)
