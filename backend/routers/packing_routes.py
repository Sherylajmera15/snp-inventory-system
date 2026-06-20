from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/packing", tags=["packing"])

PACKING_OPTIONS = (
    "Printed Corrugated Boxes",
    "Sutli",
    "Plastic Roll",
    "Shrink Wrap Film",
    "Other",
)

CATEGORY_MAP = {
    "supplier_name": "pm_supplier_name",
    "custom_name": "pm_custom_name",
    "checked_received_by": "pm_checked_received_by",
}


# ---------- Schemas ----------

class BoxSizeInput(BaseModel):
    length: float
    width: float
    height: float
    num_boxes: int

    @model_validator(mode="after")
    def validate_box(self):
        if self.length <= 0:
            raise ValueError("length must be greater than zero")
        if self.width <= 0:
            raise ValueError("width must be greater than zero")
        if self.height <= 0:
            raise ValueError("height must be greater than zero")
        if self.num_boxes <= 0:
            raise ValueError("num_boxes must be greater than zero")
        return self


class BoxSizeOut(BaseModel):
    size_number: int
    length: float
    width: float
    height: float
    num_boxes: int


class SutliGroupInput(BaseModel):
    bundle_quantity: int

    @model_validator(mode="after")
    def validate_sutli(self):
        if self.bundle_quantity <= 0:
            raise ValueError("bundle_quantity must be greater than zero")
        return self


class SutliGroupOut(BaseModel):
    group_number: int
    bundle_quantity: int


class RollWeightInput(BaseModel):
    weight: float

    @model_validator(mode="after")
    def validate_roll(self):
        if self.weight <= 0:
            raise ValueError("weight must be greater than zero")
        return self


class RollWeightOut(BaseModel):
    roll_number: int
    weight: float


class PMQuantityGroupInput(BaseModel):
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


class PMQuantityGroupOut(BaseModel):
    group_number: int
    number_of_packs: float
    quantity_per_pack: float
    group_quantity: float
    unit: str


class PackingMaterialItemCreate(BaseModel):
    material_type: str
    custom_name: Optional[str] = None
    box_sizes: Optional[List[BoxSizeInput]] = None
    sutli_groups: Optional[List[SutliGroupInput]] = None
    roll_weights: Optional[List[RollWeightInput]] = None
    quantity_groups: Optional[List[PMQuantityGroupInput]] = None

    @model_validator(mode="after")
    def validate_item(self):
        t = (self.material_type or "").strip()
        if t not in PACKING_OPTIONS:
            raise ValueError(f"material_type must be one of {PACKING_OPTIONS}")
        if t == "Printed Corrugated Boxes":
            if not self.box_sizes:
                raise ValueError("box_sizes is required for Printed Corrugated Boxes")
        elif t == "Sutli":
            if not self.sutli_groups:
                raise ValueError("sutli_groups is required for Sutli")
        elif t in ("Plastic Roll", "Shrink Wrap Film"):
            if not self.roll_weights:
                raise ValueError("roll_weights is required")
        elif t == "Other":
            if not self.custom_name or not self.custom_name.strip():
                raise ValueError("custom_name is required for Other material type")
            if not self.quantity_groups:
                raise ValueError("quantity_groups is required for Other material type")
        return self


class PackingMaterialItemOut(BaseModel):
    id: int
    item_number: int
    material_type: str
    custom_name: Optional[str] = None
    box_sizes: Optional[List[BoxSizeOut]] = None
    sutli_groups: Optional[List[SutliGroupOut]] = None
    roll_weights: Optional[List[RollWeightOut]] = None
    quantity_groups: Optional[List[PMQuantityGroupOut]] = None
    item_total_quantity: float


class PackingMaterialCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    items: List[PackingMaterialItemCreate]

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.supplier_name or not self.supplier_name.strip():
            raise ValueError("supplier_name is required")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.items:
            raise ValueError("At least one item is required")
        return self


class PackingMaterialDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PackingMaterialItemOut]
    grand_total_quantity: float
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class PackingMaterialListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    remarks: Optional[str] = None
    item_count: int
    item_summaries: List[str] = []


class PackingSuggestionsOut(BaseModel):
    supplier_names: List[str]
    custom_names: List[str]
    checked_received_by: List[str]


class DeleteRequest(BaseModel):
    password: str


# ---------- Helpers ----------

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


def _compute_item_total(item: PackingMaterialItemCreate) -> float:
    t = item.material_type.strip()
    if t == "Printed Corrugated Boxes":
        return float(sum(s.num_boxes for s in (item.box_sizes or [])))
    elif t == "Sutli":
        return float(sum(g.bundle_quantity for g in (item.sutli_groups or [])))
    elif t in ("Plastic Roll", "Shrink Wrap Film"):
        return round(sum(r.weight for r in (item.roll_weights or [])), 2)
    elif t == "Other":
        return round(sum(g.number_of_packs * g.quantity_per_pack for g in (item.quantity_groups or [])), 3)
    return 0.0


def _insert_item(cursor, inward_id: int, idx: int, item: PackingMaterialItemCreate) -> float:
    item_total = _compute_item_total(item)
    t = item.material_type.strip()
    cursor.execute(
        "INSERT INTO PackingMaterialItems (inward_id, item_number, material_type, custom_name, item_total_quantity) "
        "VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (inward_id, idx, t,
         item.custom_name.strip() if item.custom_name else None,
         item_total),
    )
    item_id = cursor.fetchone()[0]

    if t == "Printed Corrugated Boxes":
        for s_idx, s in enumerate(item.box_sizes or [], start=1):
            cursor.execute(
                "INSERT INTO PMBoxSizes (item_id, size_number, length, width, height, num_boxes) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (item_id, s_idx, s.length, s.width, s.height, s.num_boxes),
            )
    elif t == "Sutli":
        for g_idx, g in enumerate(item.sutli_groups or [], start=1):
            cursor.execute(
                "INSERT INTO PMSutliGroups (item_id, group_number, bundle_quantity) VALUES (%s, %s, %s)",
                (item_id, g_idx, g.bundle_quantity),
            )
    elif t in ("Plastic Roll", "Shrink Wrap Film"):
        for r_idx, r in enumerate(item.roll_weights or [], start=1):
            cursor.execute(
                "INSERT INTO PMRollWeights (item_id, roll_number, weight) VALUES (%s, %s, %s)",
                (item_id, r_idx, round(r.weight, 2)),
            )
    elif t == "Other":
        for g_idx, g in enumerate(item.quantity_groups or [], start=1):
            group_qty = round(g.number_of_packs * g.quantity_per_pack, 3)
            cursor.execute(
                "INSERT INTO PMQuantityGroups (item_id, group_number, number_of_packs, quantity_per_pack, group_quantity, unit) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (item_id, g_idx, g.number_of_packs, g.quantity_per_pack, group_qty, g.unit.strip()),
            )
    return item_total


def _fetch_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT p.id, p.inward_date, p.inward_time, p.supplier_name, p.invoice_number, "
        "p.checked_received_by, p.remarks, p.grand_total_quantity, "
        "p.created_by, COALESCE(u.full_name, u.username) "
        "FROM PackingMaterialInward p LEFT JOIN Users u ON u.id = p.created_by WHERE p.id = %s",
        (inward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute(
        "SELECT id, item_number, material_type, custom_name, item_total_quantity "
        "FROM PackingMaterialItems WHERE inward_id = %s ORDER BY item_number",
        (inward_id,),
    )
    item_rows = cursor.fetchall()

    items = []
    for item_row in item_rows:
        item_id, inum, mtype, cname, itotal = item_row
        item: dict = {
            "id": item_id,
            "item_number": inum,
            "material_type": mtype,
            "custom_name": cname,
            "item_total_quantity": float(itotal or 0),
            "box_sizes": None,
            "sutli_groups": None,
            "roll_weights": None,
            "quantity_groups": None,
        }

        if mtype == "Printed Corrugated Boxes":
            cursor.execute(
                "SELECT size_number, length, width, height, num_boxes FROM PMBoxSizes "
                "WHERE item_id = %s ORDER BY size_number",
                (item_id,),
            )
            item["box_sizes"] = [
                {"size_number": r[0], "length": float(r[1]), "width": float(r[2]),
                 "height": float(r[3]), "num_boxes": int(r[4])}
                for r in cursor.fetchall()
            ]
        elif mtype == "Sutli":
            cursor.execute(
                "SELECT group_number, bundle_quantity FROM PMSutliGroups "
                "WHERE item_id = %s ORDER BY group_number",
                (item_id,),
            )
            item["sutli_groups"] = [
                {"group_number": r[0], "bundle_quantity": int(r[1])}
                for r in cursor.fetchall()
            ]
        elif mtype in ("Plastic Roll", "Shrink Wrap Film"):
            cursor.execute(
                "SELECT roll_number, weight FROM PMRollWeights "
                "WHERE item_id = %s ORDER BY roll_number",
                (item_id,),
            )
            item["roll_weights"] = [
                {"roll_number": r[0], "weight": float(r[1])}
                for r in cursor.fetchall()
            ]
        elif mtype == "Other":
            cursor.execute(
                "SELECT group_number, number_of_packs, quantity_per_pack, group_quantity, unit "
                "FROM PMQuantityGroups WHERE item_id = %s ORDER BY group_number",
                (item_id,),
            )
            item["quantity_groups"] = [
                {"group_number": r[0], "number_of_packs": float(r[1]), "quantity_per_pack": float(r[2]),
                 "group_quantity": float(r[3]), "unit": r[4] or ""}
                for r in cursor.fetchall()
            ]

        items.append(item)

    conn.close()
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
        "items": items,
    }


# ---------- Routes ----------

@router.get("", response_model=List[PackingMaterialListItem])
def list_packing(
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
            pmi.supplier_name ILIKE %s
            OR pmi.invoice_number ILIKE %s
            OR pmi.checked_received_by ILIKE %s
            OR pmi.remarks ILIKE %s
            OR TO_CHAR(pmi.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(pmi.inward_time, 'HH24:MI:SS') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM PackingMaterialItems pm WHERE pm.inward_id = pmi.id
                AND (
                    pm.material_type ILIKE %s
                    OR pm.custom_name ILIKE %s
                )
            )
        )""")
        params.extend([like] * 8)
    if date_from:
        where.append("pmi.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("pmi.inward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT pmi.id, pmi.inward_date, pmi.inward_time, pmi.supplier_name, pmi.remarks, "
        f"(SELECT COUNT(*) FROM PackingMaterialItems pm WHERE pm.inward_id = pmi.id) AS item_count "
        f"FROM PackingMaterialInward pmi WHERE {' AND '.join(where)} "
        f"ORDER BY pmi.inward_date DESC, pmi.inward_time DESC, pmi.id DESC",
        params,
    )
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT inward_id, material_type, custom_name FROM PackingMaterialItems WHERE inward_id IN ({ph}) ORDER BY inward_id, item_number",
            ids,
        )
        for item_row in cursor.fetchall():
            iid, mtype, cname = item_row
            label = cname if mtype == "Other" and cname else mtype
            summaries.setdefault(iid, []).append(label)

    conn.close()
    return [
        {"id": r[0], "inward_date": r[1], "inward_time": r[2],
         "supplier_name": r[3], "remarks": r[4], "item_count": r[5],
         "item_summaries": summaries.get(r[0], [])}
        for r in rows
    ]


@router.get("/suggestions", response_model=PackingSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def vals(cat):
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (cat,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": vals("pm_supplier_name"),
        "custom_names": vals("pm_custom_name"),
        "checked_received_by": vals("pm_checked_received_by"),
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
def export_packing(
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
        f"SELECT id FROM PackingMaterialInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/{inward_id}", response_model=PackingMaterialDetail)
def get_packing(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(inward_id)


@router.post("", response_model=PackingMaterialDetail, status_code=status.HTTP_201_CREATED)
def create_packing(body: PackingMaterialCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        grand_total = round(sum(_compute_item_total(item) for item in body.items), 3)
        cursor.execute(
            "INSERT INTO PackingMaterialInward (inward_date, inward_time, supplier_name, invoice_number, "
            "checked_received_by, remarks, grand_total_quantity, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.inward_date, body.inward_time, body.supplier_name.strip(),
             body.invoice_number.strip() if body.invoice_number else None,
             body.checked_received_by.strip(),
             body.remarks.strip() if body.remarks else None,
             grand_total, current_user["id"]),
        )
        inward_id = cursor.fetchone()[0]

        for idx, item in enumerate(body.items, start=1):
            _insert_item(cursor, inward_id, idx, item)
            if item.material_type.strip() == "Other" and item.custom_name:
                _remember(cursor, "pm_custom_name", item.custom_name)

        _remember(cursor, "pm_supplier_name", body.supplier_name)
        _remember(cursor, "pm_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.put("/{inward_id}", response_model=PackingMaterialDetail)
def update_packing(inward_id: int, body: PackingMaterialCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM PackingMaterialInward WHERE id = %s", (inward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)
    try:
        grand_total = round(sum(_compute_item_total(item) for item in body.items), 3)
        cursor.execute(
            "UPDATE PackingMaterialInward SET inward_date=%s, inward_time=%s, supplier_name=%s, invoice_number=%s, "
            "checked_received_by=%s, remarks=%s, grand_total_quantity=%s WHERE id=%s",
            (body.inward_date, body.inward_time, body.supplier_name.strip(),
             body.invoice_number.strip() if body.invoice_number else None,
             body.checked_received_by.strip(),
             body.remarks.strip() if body.remarks else None,
             grand_total, inward_id),
        )
        cursor.execute("DELETE FROM PackingMaterialItems WHERE inward_id = %s", (inward_id,))
        for idx, item in enumerate(body.items, start=1):
            _insert_item(cursor, inward_id, idx, item)
            if item.material_type.strip() == "Other" and item.custom_name:
                _remember(cursor, "pm_custom_name", item.custom_name)

        _remember(cursor, "pm_supplier_name", body.supplier_name)
        _remember(cursor, "pm_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.delete("/{inward_id}")
def delete_packing(inward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM PackingMaterialInward WHERE id = %s", (inward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    cursor.execute("DELETE FROM PackingMaterialInward WHERE id = %s", (inward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
