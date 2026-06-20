from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/ink", tags=["ink"])


ITEM_TYPE_OPTIONS = ("UV Ink", "Conventional Ink")
CATEGORY_OPTIONS = ("Ink", "Varnish")

UV_INK_COLORS = ("Cyan", "Magenta", "Yellow", "Black", "White", "Spot/Pantone")
CONVENTIONAL_INK_COLORS = ("Cyan", "Magenta", "Yellow", "Black", "Spot/Pantone")

UV_VARNISH_PRESETS = ("Full UV", "Texture UV", "Matte Ink", "Matte UV")
CONVENTIONAL_VARNISH_PRESETS = ("Waterbase Gloss", "Waterbase Matte", "Waterbase Primer", "Matpet Primer")

INK_CHECKED_RECEIVED_BY_OPTIONS = ("NAVNEET MAHAJAN", "Other")

INK_CATEGORY_MAP = {
    "supplier_name": "ink_supplier_name",
    "pantone_number": "ink_pantone_number",
    "varnish_type": "ink_varnish_custom",
    "checked_received_by": "ink_checked_received_by",
}


class BoxGroupInput(BaseModel):
    number_of_boxes: int
    containers_per_box: int
    weight_per_container: float

    @model_validator(mode="after")
    def validate_positive(self):
        if self.number_of_boxes <= 0 or self.containers_per_box <= 0 or self.weight_per_container <= 0:
            raise ValueError("Box group values must be greater than zero")
        return self


class BoxGroupOut(BoxGroupInput):
    group_number: int
    group_weight: float


class InkItemCreate(BaseModel):
    item_type: str
    category: str
    color: Optional[str] = None
    pantone_number: Optional[str] = None
    varnish_type: Optional[str] = None
    box_groups: List[BoxGroupInput]

    @model_validator(mode="after")
    def validate_item(self):
        if self.item_type not in ITEM_TYPE_OPTIONS:
            raise ValueError("Invalid item_type")
        if self.category not in CATEGORY_OPTIONS:
            raise ValueError("Invalid category")

        if self.category == "Ink":
            valid_colors = UV_INK_COLORS if self.item_type == "UV Ink" else CONVENTIONAL_INK_COLORS
            if not self.color or self.color not in valid_colors:
                raise ValueError("Invalid color for item_type")
            if self.color == "Spot/Pantone" and not (self.pantone_number and self.pantone_number.strip()):
                raise ValueError("pantone_number is required for Spot/Pantone")
        else:
            if not self.varnish_type or not self.varnish_type.strip():
                raise ValueError("varnish_type is required for Varnish")

        if not self.box_groups:
            raise ValueError("At least one box group is required")
        return self


class InkItemOut(BaseModel):
    id: int
    item_number: int
    item_type: str
    category: str
    color: Optional[str] = None
    pantone_number: Optional[str] = None
    varnish_type: Optional[str] = None
    box_groups: List[BoxGroupOut]
    item_total_weight: float


class InkInwardCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    items: List[InkItemCreate]

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.supplier_name or not self.supplier_name.strip():
            raise ValueError("supplier_name is required")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.items:
            raise ValueError("At least one item is required")
        return self


class InkInwardDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[InkItemOut]
    grand_total_weight: float
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class InkInwardListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    remarks: Optional[str] = None
    item_count: int
    grand_total_weight: float
    item_summaries: List[str] = []


class InkSuggestionsOut(BaseModel):
    supplier_names: List[str]
    pantone_numbers: List[str]
    varnish_types: List[str]
    checked_received_by: List[str]


class DeleteRequest(BaseModel):
    password: str


def _remember(cursor, category: str, value):
    if value is None:
        return
    value_str = str(value).strip()
    if not value_str:
        return
    cursor.execute(
        "INSERT INTO SuggestionMemory (category, value) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (category, value_str),
    )


def _insert_item(cursor, inward_id: int, item_number: int, item: InkItemCreate, checked_received_by: str) -> float:
    group_rows = []
    item_total_weight = 0.0
    for idx, group in enumerate(item.box_groups, start=1):
        group_weight = round(group.number_of_boxes * group.containers_per_box * group.weight_per_container, 2)
        item_total_weight += group_weight
        group_rows.append((idx, group, group_weight))
    item_total_weight = round(item_total_weight, 2)

    cursor.execute("""
        INSERT INTO InkVarnishItems (
            inward_id, item_number, item_type, category, color, pantone_number, varnish_type,
            checked_received_by, item_total_weight
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (
        inward_id, item_number, item.item_type, item.category, item.color, item.pantone_number,
        item.varnish_type, checked_received_by, item_total_weight,
    ))
    item_id = cursor.fetchone()[0]

    for idx, group, group_weight in group_rows:
        cursor.execute("""
            INSERT INTO InkVarnishBoxGroups (
                item_id, group_number, number_of_boxes, containers_per_box, weight_per_container, group_weight
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """, (item_id, idx, group.number_of_boxes, group.containers_per_box, group.weight_per_container, group_weight))

    if item.pantone_number:
        _remember(cursor, "ink_pantone_number", item.pantone_number)
    if item.varnish_type:
        presets = UV_VARNISH_PRESETS if item.item_type == "UV Ink" else CONVENTIONAL_VARNISH_PRESETS
        if item.varnish_type not in presets:
            _remember(cursor, "ink_varnish_custom", item.varnish_type)

    return item_total_weight


def _fetch_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT i.id, i.inward_date, i.inward_time, i.supplier_name, i.invoice_number,
               i.checked_received_by, i.remarks, i.grand_total_weight,
               i.created_by, COALESCE(u.full_name, u.username)
        FROM InkVarnishInward i LEFT JOIN Users u ON u.id = i.created_by WHERE i.id = %s
    """, (inward_id,))
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute("""
        SELECT id, item_number, item_type, category, color, pantone_number, varnish_type, item_total_weight
        FROM InkVarnishItems WHERE inward_id = %s ORDER BY item_number
    """, (inward_id,))
    items = cursor.fetchall()

    result_items = []
    for item in items:
        item_id = item[0]
        cursor.execute("""
            SELECT group_number, number_of_boxes, containers_per_box, weight_per_container, group_weight
            FROM InkVarnishBoxGroups WHERE item_id = %s ORDER BY group_number
        """, (item_id,))
        box_groups = [
            {
                "group_number": g[0],
                "number_of_boxes": g[1],
                "containers_per_box": g[2],
                "weight_per_container": float(g[3]),
                "group_weight": float(g[4]),
            }
            for g in cursor.fetchall()
        ]
        result_items.append({
            "id": item_id,
            "item_number": item[1],
            "item_type": item[2],
            "category": item[3],
            "color": item[4],
            "pantone_number": item[5],
            "varnish_type": item[6],
            "item_total_weight": float(item[7]),
            "box_groups": box_groups,
        })

    conn.close()
    return {
        "id": header[0],
        "inward_date": header[1],
        "inward_time": header[2],
        "supplier_name": header[3],
        "invoice_number": header[4],
        "checked_received_by": header[5],
        "remarks": header[6],
        "grand_total_weight": float(header[7]),
        "created_by_id": header[8],
        "created_by_name": header[9],
        "items": result_items,
    }


@router.get("", response_model=List[InkInwardListItem])
def list_ink(
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
            iv.supplier_name ILIKE %s
            OR iv.invoice_number ILIKE %s
            OR iv.checked_received_by ILIKE %s
            OR iv.remarks ILIKE %s
            OR TO_CHAR(iv.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(iv.inward_time, 'HH24:MI:SS') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM InkVarnishItems ivi WHERE ivi.inward_id = iv.id
                AND (
                    ivi.color ILIKE %s
                    OR ivi.varnish_type ILIKE %s
                    OR ivi.item_type ILIKE %s
                    OR ivi.category ILIKE %s
                    OR ivi.pantone_number ILIKE %s
                )
            )
        )""")
        params.extend([like] * 11)
    if date_from:
        where.append("iv.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("iv.inward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT iv.id, iv.inward_date, iv.inward_time, iv.supplier_name, iv.invoice_number, iv.remarks, iv.grand_total_weight, "
        f"(SELECT COUNT(*) FROM InkVarnishItems ivi WHERE ivi.inward_id = iv.id) AS item_count "
        f"FROM InkVarnishInward iv WHERE {' AND '.join(where)} "
        f"ORDER BY iv.inward_date DESC, iv.inward_time DESC, iv.id DESC",
        params,
    )
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT inward_id, category, color, varnish_type, item_type "
            f"FROM InkVarnishItems WHERE inward_id IN ({ph}) ORDER BY inward_id, item_number",
            ids,
        )
        for item_row in cursor.fetchall():
            iid, cat, color, varnish, itype = item_row
            if cat == "Ink":
                label = f"{color} ({itype})"
            else:
                label = f"{varnish} (Varnish)"
            summaries.setdefault(iid, []).append(label)

    conn.close()
    return [
        {
            "id": r[0],
            "inward_date": r[1],
            "inward_time": r[2],
            "supplier_name": r[3],
            "invoice_number": r[4],
            "remarks": r[5],
            "grand_total_weight": float(r[6]),
            "item_count": r[7],
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/suggestions", response_model=InkSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def get_values(category: str) -> List[str]:
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (category,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": get_values("ink_supplier_name"),
        "pantone_numbers": get_values("ink_pantone_number"),
        "varnish_types": get_values("ink_varnish_custom"),
        "checked_received_by": get_values("ink_checked_received_by"),
    }
    conn.close()
    return result


@router.delete("/suggestions/{category}/{value}")
def delete_suggestion(category: str, value: str, current_user: dict = Depends(get_current_user)):
    if category not in INK_CATEGORY_MAP:
        raise HTTPException(status_code=400, detail="Invalid suggestion category")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SuggestionMemory WHERE category = %s AND value = %s", (INK_CATEGORY_MAP[category], value))
    conn.commit()
    conn.close()
    return {"detail": "Removed"}


@router.get("/export")
def export_ink(
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
        f"SELECT id FROM InkVarnishInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/{ink_id}", response_model=InkInwardDetail)
def get_ink(ink_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(ink_id)


@router.post("", response_model=InkInwardDetail, status_code=status.HTTP_201_CREATED)
def create_ink(body: InkInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO InkVarnishInward (inward_date, inward_time, supplier_name, invoice_number, checked_received_by, remarks, grand_total_weight, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (body.inward_date, body.inward_time, body.supplier_name, body.invoice_number, body.checked_received_by, body.remarks, 0, current_user["id"]))
        ink_id = cursor.fetchone()[0]

        grand_total = 0.0
        for idx, item in enumerate(body.items, start=1):
            grand_total += _insert_item(cursor, ink_id, idx, item, body.checked_received_by)
        grand_total = round(grand_total, 2)

        cursor.execute("UPDATE InkVarnishInward SET grand_total_weight = %s WHERE id = %s", (grand_total, ink_id))

        _remember(cursor, "ink_supplier_name", body.supplier_name)
        _remember(cursor, "ink_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(ink_id)


@router.put("/{ink_id}", response_model=InkInwardDetail)
def update_ink(ink_id: int, body: InkInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM InkVarnishInward WHERE id = %s", (ink_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)

    try:
        grand_total = 0.0
        cursor.execute("""
            UPDATE InkVarnishInward
            SET inward_date = %s, inward_time = %s, supplier_name = %s, invoice_number = %s, checked_received_by = %s, remarks = %s
            WHERE id = %s
        """, (body.inward_date, body.inward_time, body.supplier_name, body.invoice_number, body.checked_received_by, body.remarks, ink_id))

        cursor.execute("DELETE FROM InkVarnishItems WHERE inward_id = %s", (ink_id,))
        for idx, item in enumerate(body.items, start=1):
            grand_total += _insert_item(cursor, ink_id, idx, item, body.checked_received_by)
        grand_total = round(grand_total, 2)

        cursor.execute("UPDATE InkVarnishInward SET grand_total_weight = %s WHERE id = %s", (grand_total, ink_id))

        _remember(cursor, "ink_supplier_name", body.supplier_name)
        _remember(cursor, "ink_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(ink_id)


@router.delete("/{ink_id}")
def delete_ink(ink_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM InkVarnishInward WHERE id = %s", (ink_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute("DELETE FROM InkVarnishInward WHERE id = %s", (ink_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
