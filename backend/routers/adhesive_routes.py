from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/adhesives", tags=["adhesives"])

ADHESIVE_OPTIONS = (
    "Fevicol 282",
    "Fevicol CPW",
    "Fevicol LM 51",
    "Fevicol LM 34",
    "Fevicol 2000 L",
    "Fevicol T-28",
    "Other",
)

CATEGORY_MAP = {
    "supplier_name": "adh_supplier_name",
    "manufacturer": "adh_manufacturer",
    "custom_name": "adh_custom_name",
    "checked_received_by": "adh_checked_received_by",
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


class AdhesiveItemCreate(BaseModel):
    adhesive_name: str
    manufacturer: Optional[str] = None
    quantity_groups: List[QuantityGroupInput]

    @model_validator(mode="after")
    def validate_item(self):
        if not self.adhesive_name or not self.adhesive_name.strip():
            raise ValueError("adhesive_name is required")
        if not self.quantity_groups:
            raise ValueError("At least one quantity group is required")
        return self


class AdhesiveItemOut(BaseModel):
    id: int
    item_number: int
    adhesive_name: str
    manufacturer: Optional[str] = None
    quantity_groups: List[QuantityGroupOut]
    item_total_quantity: float


class AdhesiveInwardCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    items: List[AdhesiveItemCreate]

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.supplier_name or not self.supplier_name.strip():
            raise ValueError("supplier_name is required")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.items:
            raise ValueError("At least one item is required")
        return self


class AdhesiveInwardDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[AdhesiveItemOut]
    grand_total_quantity: float
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class AdhesiveInwardListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    remarks: Optional[str] = None
    item_count: int
    grand_total_quantity: float
    item_summaries: List[str] = []


class AdhesiveSuggestionsOut(BaseModel):
    supplier_names: List[str]
    manufacturers: List[str]
    custom_names: List[str]
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


def _insert_item(cursor, inward_id: int, idx: int, item: AdhesiveItemCreate) -> float:
    item_total = sum(g.number_of_packs * g.quantity_per_pack for g in item.quantity_groups)
    cursor.execute(
        "INSERT INTO AdhesiveItems (inward_id, item_number, adhesive_name, manufacturer, item_total_quantity) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (inward_id, idx, item.adhesive_name.strip(),
         item.manufacturer.strip() if item.manufacturer else None, round(item_total, 3)),
    )
    item_id = cursor.fetchone()[0]
    for g_idx, g in enumerate(item.quantity_groups, start=1):
        cursor.execute(
            "INSERT INTO AdhesiveQuantityGroups (item_id, group_number, number_of_packs, quantity_per_pack, group_quantity, unit) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (item_id, g_idx, g.number_of_packs, g.quantity_per_pack,
             round(g.number_of_packs * g.quantity_per_pack, 3), g.unit.strip()),
        )
    return item_total


def _fetch_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT a.id, a.inward_date, a.inward_time, a.supplier_name, a.invoice_number, "
        "a.checked_received_by, a.remarks, a.grand_total_quantity, "
        "a.created_by, COALESCE(u.full_name, u.username) "
        "FROM AdhesiveInward a LEFT JOIN Users u ON u.id = a.created_by WHERE a.id = %s",
        (inward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute(
        "SELECT ai.id, ai.item_number, ai.adhesive_name, ai.manufacturer, ai.item_total_quantity, "
        "       aqg.group_number, aqg.number_of_packs, aqg.quantity_per_pack, aqg.group_quantity, aqg.unit "
        "FROM AdhesiveItems ai "
        "LEFT JOIN AdhesiveQuantityGroups aqg ON aqg.item_id = ai.id "
        "WHERE ai.inward_id = %s ORDER BY ai.item_number, aqg.group_number",
        (inward_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    items_map: dict = {}
    for r in rows:
        iid, inum, iname, imfr, itotal, gnum, npacks, qperpack, gqty, gunit = r
        if iid not in items_map:
            items_map[iid] = {
                "id": iid, "item_number": inum, "adhesive_name": iname,
                "manufacturer": imfr, "item_total_quantity": float(itotal or 0),
                "quantity_groups": [],
            }
        if gnum is not None:
            items_map[iid]["quantity_groups"].append({
                "group_number": gnum, "number_of_packs": float(npacks),
                "quantity_per_pack": float(qperpack), "group_quantity": float(gqty),
                "unit": gunit or "",
            })

    return {
        "id": header[0], "inward_date": header[1], "inward_time": header[2],
        "supplier_name": header[3], "invoice_number": header[4],
        "checked_received_by": header[5], "remarks": header[6],
        "grand_total_quantity": float(header[7] or 0),
        "created_by_id": header[8], "created_by_name": header[9],
        "items": list(items_map.values()),
    }


@router.get("", response_model=List[AdhesiveInwardListItem])
def list_adhesives(
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
            ai.supplier_name ILIKE %s
            OR ai.invoice_number ILIKE %s
            OR ai.checked_received_by ILIKE %s
            OR ai.remarks ILIKE %s
            OR TO_CHAR(ai.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(ai.inward_time, 'HH24:MI:SS') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM AdhesiveItems aii WHERE aii.inward_id = ai.id
                AND (
                    aii.adhesive_name ILIKE %s
                    OR aii.manufacturer ILIKE %s
                )
            )
        )""")
        params.extend([like] * 8)
    if date_from:
        where.append("ai.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("ai.inward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT ai.id, ai.inward_date, ai.inward_time, ai.supplier_name, ai.remarks, ai.grand_total_quantity, "
        f"(SELECT COUNT(*) FROM AdhesiveItems aii WHERE aii.inward_id = ai.id) AS item_count "
        f"FROM AdhesiveInward ai WHERE {' AND '.join(where)} "
        f"ORDER BY ai.inward_date DESC, ai.inward_time DESC, ai.id DESC",
        params,
    )
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT inward_id, adhesive_name FROM AdhesiveItems WHERE inward_id IN ({ph}) ORDER BY inward_id, item_number",
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


@router.get("/suggestions", response_model=AdhesiveSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def vals(cat):
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (cat,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": vals("adh_supplier_name"),
        "manufacturers": vals("adh_manufacturer"),
        "custom_names": vals("adh_custom_name"),
        "checked_received_by": vals("adh_checked_received_by"),
    }
    conn.close()
    return result


@router.delete("/suggestions/{category}/{value}")
def delete_suggestion(category: str, value: str, current_user: dict = Depends(get_current_user)):
    if category not in CATEGORY_MAP:
        raise HTTPException(status_code=400, detail="Invalid suggestion category")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SuggestionMemory WHERE category = %s AND value = %s", (CATEGORY_MAP[category], value))
    conn.commit()
    conn.close()
    return {"detail": "Removed"}


@router.get("/export")
def export_adhesives(
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
        f"SELECT id FROM AdhesiveInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/{inward_id}", response_model=AdhesiveInwardDetail)
def get_adhesive(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(inward_id)


@router.post("", response_model=AdhesiveInwardDetail, status_code=status.HTTP_201_CREATED)
def create_adhesive(body: AdhesiveInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        grand_total = sum(
            sum(g.number_of_packs * g.quantity_per_pack for g in item.quantity_groups)
            for item in body.items
        )
        cursor.execute(
            "INSERT INTO AdhesiveInward (inward_date, inward_time, supplier_name, invoice_number, "
            "checked_received_by, remarks, grand_total_quantity, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.inward_date, body.inward_time, body.supplier_name.strip(),
             body.invoice_number.strip() if body.invoice_number else None,
             body.checked_received_by.strip(), body.remarks.strip() if body.remarks else None,
             round(grand_total, 3), current_user["id"]),
        )
        inward_id = cursor.fetchone()[0]

        for idx, item in enumerate(body.items, start=1):
            _insert_item(cursor, inward_id, idx, item)
            if item.manufacturer:
                _remember(cursor, "adh_manufacturer", item.manufacturer)
            if not any(item.adhesive_name == opt for opt in ADHESIVE_OPTIONS if opt != "Other"):
                _remember(cursor, "adh_custom_name", item.adhesive_name)

        _remember(cursor, "adh_supplier_name", body.supplier_name)
        _remember(cursor, "adh_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.put("/{inward_id}", response_model=AdhesiveInwardDetail)
def update_adhesive(inward_id: int, body: AdhesiveInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM AdhesiveInward WHERE id = %s", (inward_id,))
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
            "UPDATE AdhesiveInward SET inward_date=%s, inward_time=%s, supplier_name=%s, invoice_number=%s, "
            "checked_received_by=%s, remarks=%s, grand_total_quantity=%s WHERE id=%s",
            (body.inward_date, body.inward_time, body.supplier_name.strip(),
             body.invoice_number.strip() if body.invoice_number else None,
             body.checked_received_by.strip(), body.remarks.strip() if body.remarks else None,
             round(grand_total, 3), inward_id),
        )
        cursor.execute("DELETE FROM AdhesiveItems WHERE inward_id = %s", (inward_id,))
        for idx, item in enumerate(body.items, start=1):
            _insert_item(cursor, inward_id, idx, item)
            if item.manufacturer:
                _remember(cursor, "adh_manufacturer", item.manufacturer)
            if not any(item.adhesive_name == opt for opt in ADHESIVE_OPTIONS if opt != "Other"):
                _remember(cursor, "adh_custom_name", item.adhesive_name)

        _remember(cursor, "adh_supplier_name", body.supplier_name)
        _remember(cursor, "adh_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.delete("/{inward_id}")
def delete_adhesive(inward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM AdhesiveInward WHERE id = %s", (inward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    cursor.execute("DELETE FROM AdhesiveInward WHERE id = %s", (inward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
