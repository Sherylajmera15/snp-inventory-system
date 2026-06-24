from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/oil", tags=["oil"])

OIL_OPTIONS = (
    "Servo 68", "Servo 150", "Servo 20W-40", "Hydraulic Oil", "Gear Oil",
    "Compressor Oil", "Engine Oil", "Grease", "Lithium Grease", "Bearing Grease",
    "High Temperature Grease", "Other",
)

CATEGORY_MAP = {
    "supplier_name": "oil_supplier_name",
    "manufacturer": "oil_manufacturer",
    "custom_name": "oil_custom_name",
    "machine_name": "oil_machine_name",
    "checked_received_by": "oil_checked_received_by",
}


class QuantityGroupInput(BaseModel):
    number_of_packs: float
    quantity_per_pack: float
    unit: str

    @model_validator(mode="after")
    def validate_group(self):
        if self.number_of_packs <= 0:
            raise ValueError("number_of_packs must be greater than zero")
        if self.quantity_per_pack <= 0:
            raise ValueError("quantity_per_pack must be greater than zero")
        if not self.unit or not self.unit.strip():
            raise ValueError("unit is required for each quantity group")
        return self


class QuantityGroupOut(BaseModel):
    group_number: int
    number_of_packs: float
    quantity_per_pack: float
    group_quantity: float
    unit: str


class OilItemCreate(BaseModel):
    oil_name: str
    manufacturer: Optional[str] = None
    machine_name: Optional[str] = None
    quantity_groups: List[QuantityGroupInput]

    @model_validator(mode="after")
    def validate_item(self):
        if not self.oil_name or not self.oil_name.strip():
            raise ValueError("oil_name is required")
        if not self.quantity_groups:
            raise ValueError("At least one quantity group is required")
        return self


class OilItemOut(BaseModel):
    id: int
    item_number: int
    oil_name: str
    manufacturer: Optional[str] = None
    machine_name: Optional[str] = None
    quantity_groups: List[QuantityGroupOut]
    item_total_quantity: float


class OilInwardCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    items: List[OilItemCreate]

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.supplier_name or not self.supplier_name.strip():
            raise ValueError("supplier_name is required")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.items:
            raise ValueError("At least one item is required")
        return self


class OilInwardDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[OilItemOut]
    grand_total_quantity: float
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class OilInwardListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    remarks: Optional[str] = None
    item_count: int
    grand_total_quantity: float
    item_summaries: List[str] = []


class OilSuggestionsOut(BaseModel):
    supplier_names: List[str]
    manufacturers: List[str]
    custom_names: List[str]
    machine_names: List[str]
    checked_received_by: List[str]


class DeleteRequest(BaseModel):
    password: str


def _remember(cursor, category: str, value):
    if not value:
        return
    value_str = str(value).strip()
    if not value_str:
        return
    cursor.execute(
        "INSERT INTO SuggestionMemory (category, value) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (category, value_str),
    )


def _insert_item(cursor, inward_id: int, idx: int, item: OilItemCreate) -> float:
    item_total = sum(g.number_of_packs * g.quantity_per_pack for g in item.quantity_groups)
    cursor.execute(
        "INSERT INTO OilItems (inward_id, item_number, oil_name, manufacturer, machine_name, item_total_quantity) "
        "VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (inward_id, idx, item.oil_name.strip(),
         item.manufacturer.strip() if item.manufacturer else None,
         item.machine_name.strip() if item.machine_name else None,
         round(item_total, 3)),
    )
    item_id = cursor.fetchone()[0]

    for g_idx, g in enumerate(item.quantity_groups, start=1):
        group_qty = round(g.number_of_packs * g.quantity_per_pack, 3)
        cursor.execute(
            "INSERT INTO OilQuantityGroups (item_id, group_number, number_of_packs, quantity_per_pack, group_quantity, unit) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (item_id, g_idx, g.number_of_packs, g.quantity_per_pack, group_qty, g.unit.strip()),
        )
    return item_total


def _fetch_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT o.id, o.inward_date, o.inward_time, o.supplier_name, o.invoice_number, "
        "o.checked_received_by, o.remarks, o.grand_total_quantity, "
        "o.created_by, COALESCE(u.full_name, u.username) "
        "FROM OilInward o LEFT JOIN Users u ON u.id = o.created_by WHERE o.id = %s",
        (inward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute(
        "SELECT oi.id, oi.item_number, oi.oil_name, oi.manufacturer, oi.machine_name, oi.item_total_quantity, "
        "       oqg.group_number, oqg.number_of_packs, oqg.quantity_per_pack, oqg.group_quantity, oqg.unit "
        "FROM OilItems oi "
        "LEFT JOIN OilQuantityGroups oqg ON oqg.item_id = oi.id "
        "WHERE oi.inward_id = %s "
        "ORDER BY oi.item_number, oqg.group_number",
        (inward_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    items_map: dict = {}
    for r in rows:
        iid, inum, iname, imfr, imachine, itotal, gnum, npacks, qperpack, gqty, gunit = r
        if iid not in items_map:
            items_map[iid] = {
                "id": iid, "item_number": inum, "oil_name": iname,
                "manufacturer": imfr, "machine_name": imachine,
                "item_total_quantity": float(itotal or 0),
                "quantity_groups": [],
            }
        if gnum is not None:
            items_map[iid]["quantity_groups"].append({
                "group_number": gnum,
                "number_of_packs": float(npacks),
                "quantity_per_pack": float(qperpack),
                "group_quantity": float(gqty),
                "unit": gunit or "",
            })

    return {
        "id": header[0],
        "inward_date": header[1],
        "inward_time": header[2],
        "supplier_name": header[3],
        "invoice_number": header[4],
        "checked_received_by": header[5],
        "remarks": header[6],
        "grand_total_quantity": float(header[7] or 0),
        "created_by_id": header[8],
        "created_by_name": header[9],
        "items": list(items_map.values()),
    }


@router.get("", response_model=List[OilInwardListItem])
def list_oil(
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
        where.append("""(
            oi.supplier_name ILIKE %s
            OR oi.invoice_number ILIKE %s
            OR oi.checked_received_by ILIKE %s
            OR oi.remarks ILIKE %s
            OR TO_CHAR(oi.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(oi.inward_time, 'HH24:MI:SS') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM OilItems oii WHERE oii.inward_id = oi.id
                AND (
                    oii.oil_name ILIKE %s
                    OR oii.manufacturer ILIKE %s
                    OR oii.machine_name ILIKE %s
                )
            )
        )""")
        params.extend([like] * 9)
    if date_from:
        where.append("oi.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("oi.inward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT oi.id, oi.inward_date, oi.inward_time, oi.supplier_name, oi.remarks, oi.grand_total_quantity, "
        f"(SELECT COUNT(*) FROM OilItems oii WHERE oii.inward_id = oi.id) AS item_count "
        f"FROM OilInward oi WHERE {' AND '.join(where)} "
        f"ORDER BY oi.inward_date DESC, oi.inward_time DESC, oi.id DESC",
        params,
    )
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT inward_id, oil_name FROM OilItems WHERE inward_id IN ({ph}) ORDER BY inward_id, item_number",
            ids,
        )
        for item_row in cursor.fetchall():
            summaries.setdefault(item_row[0], []).append(item_row[1])

    conn.close()
    return [
        {"id": r[0], "inward_date": r[1], "inward_time": r[2], "supplier_name": r[3],
         "remarks": r[4], "grand_total_quantity": float(r[5] or 0), "item_count": r[6],
         "item_summaries": summaries.get(r[0], [])}
        for r in rows
    ]


@router.get("/suggestions", response_model=OilSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def vals(cat):
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (cat,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": vals("oil_supplier_name"),
        "manufacturers": vals("oil_manufacturer"),
        "custom_names": vals("oil_custom_name"),
        "machine_names": vals("oil_machine_name"),
        "checked_received_by": vals("oil_checked_received_by"),
    }
    conn.close()
    return result


@router.delete("/suggestions/{category}/{value}")
def delete_suggestion(category: str, value: str, current_user: dict = Depends(get_current_user)):
    if category not in CATEGORY_MAP:
        raise HTTPException(status_code=400, detail="Invalid suggestion category")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM SuggestionMemory WHERE category = %s AND value = %s",
        (CATEGORY_MAP[category], value),
    )
    conn.commit()
    conn.close()
    return {"detail": "Removed"}


@router.get("/export")
def export_oil(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["1=1"]
    params: list = []
    if date_from:
        where.append("inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("inward_date <= %s")
        params.append(date_to)
    cursor.execute(
        f"SELECT id FROM OilInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/stock")
def get_oil_stock(current_user: dict = Depends(get_current_user)):
    """Live oil stock grouped by oil_name and unit."""
    conn = get_connection()
    try:
        c = conn.cursor()
        c.execute("""
            SELECT
                i.oil_name,
                qg.unit,
                COALESCE(SUM(qg.group_quantity), 0)
                + COALESCE((
                    SELECT SUM(adj.quantity)
                    FROM OilAdjustmentEntries adj
                    WHERE adj.item_name = i.oil_name AND adj.unit = qg.unit
                ), 0)
                - COALESCE((
                    SELECT SUM(oi.quantity_issued)
                    FROM OilOutwardItems oi
                    WHERE oi.item_name = i.oil_name AND oi.unit = qg.unit
                ), 0)
                AS available_qty
            FROM OilItems i
            JOIN OilQuantityGroups qg ON qg.item_id = i.id
            GROUP BY i.oil_name, qg.unit
            ORDER BY i.oil_name, qg.unit
        """)
        rows = c.fetchall()
        return [
            {"item_name": r[0], "unit": r[1], "available_qty": round(float(r[2]), 2)}
            for r in rows
            if float(r[2]) > 0
        ]
    finally:
        conn.close()


@router.get("/{inward_id}", response_model=OilInwardDetail)
def get_oil(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(inward_id)


@router.post("", response_model=OilInwardDetail, status_code=status.HTTP_201_CREATED)
def create_oil(body: OilInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        grand_total = sum(
            sum(g.number_of_packs * g.quantity_per_pack for g in item.quantity_groups)
            for item in body.items
        )
        cursor.execute(
            "INSERT INTO OilInward (inward_date, inward_time, supplier_name, invoice_number, "
            "checked_received_by, remarks, grand_total_quantity, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.inward_date, body.inward_time, body.supplier_name.strip(),
             body.invoice_number.strip() if body.invoice_number else None,
             body.checked_received_by.strip(),
             body.remarks.strip() if body.remarks else None,
             round(grand_total, 3), current_user["id"]),
        )
        inward_id = cursor.fetchone()[0]

        for idx, item in enumerate(body.items, start=1):
            _insert_item(cursor, inward_id, idx, item)
            if item.manufacturer:
                _remember(cursor, "oil_manufacturer", item.manufacturer)
            if item.machine_name:
                _remember(cursor, "oil_machine_name", item.machine_name)
            if not any(item.oil_name == opt for opt in OIL_OPTIONS if opt != "Other"):
                _remember(cursor, "oil_custom_name", item.oil_name)

        _remember(cursor, "oil_supplier_name", body.supplier_name)
        _remember(cursor, "oil_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.put("/{inward_id}", response_model=OilInwardDetail)
def update_oil(inward_id: int, body: OilInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM OilInward WHERE id = %s", (inward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)
    try:
        grand_total = sum(
            sum(g.number_of_packs * g.quantity_per_pack for g in item.quantity_groups)
            for item in body.items
        )
        cursor.execute(
            "UPDATE OilInward SET inward_date=%s, inward_time=%s, supplier_name=%s, invoice_number=%s, "
            "checked_received_by=%s, remarks=%s, grand_total_quantity=%s WHERE id=%s",
            (body.inward_date, body.inward_time, body.supplier_name.strip(),
             body.invoice_number.strip() if body.invoice_number else None,
             body.checked_received_by.strip(),
             body.remarks.strip() if body.remarks else None,
             round(grand_total, 3), inward_id),
        )
        cursor.execute("DELETE FROM OilItems WHERE inward_id = %s", (inward_id,))
        for idx, item in enumerate(body.items, start=1):
            _insert_item(cursor, inward_id, idx, item)
            if item.manufacturer:
                _remember(cursor, "oil_manufacturer", item.manufacturer)
            if item.machine_name:
                _remember(cursor, "oil_machine_name", item.machine_name)
            if not any(item.oil_name == opt for opt in OIL_OPTIONS if opt != "Other"):
                _remember(cursor, "oil_custom_name", item.oil_name)

        _remember(cursor, "oil_supplier_name", body.supplier_name)
        _remember(cursor, "oil_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.delete("/{inward_id}")
def delete_oil(inward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM OilInward WHERE id = %s", (inward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    cursor.execute("DELETE FROM OilInward WHERE id = %s", (inward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
