from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/paper", tags=["paper"])


class BundleGroupInput(BaseModel):
    number_of_bundles: int
    packets_per_bundle: int
    sheets_per_packet: int

    @model_validator(mode="after")
    def validate_positive(self):
        if self.number_of_bundles <= 0 or self.packets_per_bundle <= 0 or self.sheets_per_packet <= 0:
            raise ValueError("Bundle group values must be greater than zero")
        return self


class PaperItemCreate(BaseModel):
    quality: str
    gsm: int
    form_type: str

    reel_width: Optional[float] = None
    reel_weights: Optional[List[float]] = None

    sheet_length: Optional[float] = None
    sheet_width: Optional[float] = None
    bundle_groups: Optional[List[BundleGroupInput]] = None

    @model_validator(mode="after")
    def validate_item(self):
        if self.form_type not in ("Reel Form", "Sheet Form"):
            raise ValueError("form_type must be 'Reel Form' or 'Sheet Form'")
        if self.form_type == "Reel Form":
            if self.reel_width is None or not self.reel_weights:
                raise ValueError("reel_width and reel_weights are required for Reel Form")
        if self.form_type == "Sheet Form":
            if self.sheet_length is None or self.sheet_width is None or not self.bundle_groups:
                raise ValueError(
                    "sheet_length, sheet_width and at least one bundle group are required for Sheet Form"
                )
        return self


class PaperInwardCreate(BaseModel):
    inward_date: date
    inward_time: Optional[time] = None
    supplier_name: str
    invoice_number: Optional[str] = None
    work_type: str
    customer_name: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    items: List[PaperItemCreate]

    @model_validator(mode="after")
    def validate_entry(self):
        if self.work_type not in ("Self Work", "Job Work"):
            raise ValueError("work_type must be 'Self Work' or 'Job Work'")
        if self.work_type == "Job Work" and not self.customer_name:
            raise ValueError("customer_name is required for Job Work")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.items:
            raise ValueError("At least one paper item is required")
        return self


class BundleGroupOut(BundleGroupInput):
    group_number: int
    group_total_sheets: int


class PaperItemOut(BaseModel):
    id: int
    quality: str
    gsm: int
    form_type: str
    reel_width: Optional[float] = None
    number_of_reels: Optional[int] = None
    total_reel_weight: Optional[float] = None
    reel_weights: List[float] = []
    sheet_length: Optional[float] = None
    sheet_width: Optional[float] = None
    bundle_groups: List[BundleGroupOut] = []
    sheet_weight: Optional[float] = None
    total_sheets: Optional[int] = None


class PaperInwardDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: Optional[time] = None
    supplier_name: str
    invoice_number: Optional[str] = None
    work_type: Optional[str] = None
    customer_name: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[PaperItemOut]
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class PaperInwardListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: Optional[time] = None
    supplier_name: str
    invoice_number: Optional[str] = None
    work_type: Optional[str] = None
    customer_name: Optional[str] = None
    checked_received_by: Optional[str] = None
    item_summaries: List[str] = []
    remarks: Optional[str] = None
    item_count: int


class DeleteRequest(BaseModel):
    password: str


class PaperSuggestionsOut(BaseModel):
    supplier_names: List[str]
    customer_names: List[str]
    qualities: List[str]
    gsm_values: List[int]
    checked_received_by: List[str]


SUGGESTION_CATEGORIES = {"supplier_name", "customer_name", "quality", "gsm", "checked_received_by"}


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


def _insert_item(cursor, inward_id: int, item: PaperItemCreate, work_type: str, customer_name: Optional[str], checked_received_by: str):
    total_reel_weight = None
    number_of_reels = None
    total_sheets = None
    sheet_weight = None

    if item.form_type == "Reel Form":
        weights = item.reel_weights or []
        number_of_reels = len(weights)
        total_reel_weight = round(sum(weights), 2)
    else:
        total_sheets = sum(
            g.number_of_bundles * g.packets_per_bundle * g.sheets_per_packet
            for g in item.bundle_groups
        )
        sheet_weight = round(
            (((item.sheet_length * item.sheet_width * item.gsm) / 20000) / 500) * total_sheets, 2
        )

    cursor.execute("""
        INSERT INTO PaperItems (
            inward_id, work_type, customer_name, quality, gsm, form_type, checked_received_by,
            reel_width, number_of_reels, total_reel_weight,
            sheet_length, sheet_width, sheet_weight, total_sheets
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
    """, (
        inward_id, work_type, customer_name, item.quality, item.gsm, item.form_type, checked_received_by,
        item.reel_width, number_of_reels, total_reel_weight,
        item.sheet_length, item.sheet_width, sheet_weight, total_sheets,
    ))
    item_id = cursor.fetchone()[0]

    if item.form_type == "Reel Form":
        for idx, weight in enumerate(item.reel_weights or [], start=1):
            cursor.execute(
                "INSERT INTO PaperItemReelWeights (paper_item_id, reel_number, weight) VALUES (%s, %s, %s)",
                (item_id, idx, weight),
            )
    else:
        for idx, group in enumerate(item.bundle_groups, start=1):
            group_total = group.number_of_bundles * group.packets_per_bundle * group.sheets_per_packet
            cursor.execute("""
                INSERT INTO PaperItemBundleGroups
                    (paper_item_id, group_number, number_of_bundles, packets_per_bundle, sheets_per_packet, group_total_sheets)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (item_id, idx, group.number_of_bundles, group.packets_per_bundle, group.sheets_per_packet, group_total))

    _remember(cursor, "quality", item.quality)
    _remember(cursor, "gsm", item.gsm)


def _fetch_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT pi.id, pi.inward_date, pi.inward_time, pi.supplier_name, pi.invoice_number, "
        "pi.work_type, pi.customer_name, pi.checked_received_by, pi.remarks, "
        "pi.created_by, COALESCE(u.full_name, u.username) "
        "FROM PaperInward pi LEFT JOIN Users u ON u.id = pi.created_by WHERE pi.id = %s",
        (inward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute("""
        SELECT id, quality, gsm, form_type,
               reel_width, number_of_reels, total_reel_weight,
               sheet_length, sheet_width, sheet_weight, total_sheets
        FROM PaperItems WHERE inward_id = %s ORDER BY id
    """, (inward_id,))
    items = cursor.fetchall()

    result_items = []
    for item in items:
        item_id = item[0]
        reel_weights: List[float] = []
        bundle_groups: List[dict] = []
        if item[3] == "Reel Form":
            cursor.execute(
                "SELECT weight FROM PaperItemReelWeights WHERE paper_item_id = %s ORDER BY reel_number",
                (item_id,),
            )
            reel_weights = [float(w[0]) for w in cursor.fetchall()]
        else:
            cursor.execute("""
                SELECT group_number, number_of_bundles, packets_per_bundle, sheets_per_packet, group_total_sheets
                FROM PaperItemBundleGroups WHERE paper_item_id = %s ORDER BY group_number
            """, (item_id,))
            bundle_groups = [
                {
                    "group_number": g[0],
                    "number_of_bundles": g[1],
                    "packets_per_bundle": g[2],
                    "sheets_per_packet": g[3],
                    "group_total_sheets": g[4],
                }
                for g in cursor.fetchall()
            ]

        result_items.append({
            "id": item_id,
            "quality": item[1],
            "gsm": item[2],
            "form_type": item[3],
            "reel_width": float(item[4]) if item[4] is not None else None,
            "number_of_reels": item[5],
            "total_reel_weight": float(item[6]) if item[6] is not None else None,
            "reel_weights": reel_weights,
            "sheet_length": float(item[7]) if item[7] is not None else None,
            "sheet_width": float(item[8]) if item[8] is not None else None,
            "sheet_weight": float(item[9]) if item[9] is not None else None,
            "total_sheets": item[10],
            "bundle_groups": bundle_groups,
        })

    conn.close()
    return {
        "id": header[0],
        "inward_date": header[1],
        "inward_time": header[2],
        "supplier_name": header[3],
        "invoice_number": header[4],
        "work_type": header[5],
        "customer_name": header[6],
        "checked_received_by": header[7],
        "remarks": header[8],
        "created_by_id": header[9],
        "created_by_name": header[10],
        "items": result_items,
    }


@router.get("", response_model=List[PaperInwardListItem])
def list_paper(
    search: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    form_type: Optional[str] = None,
    work_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    where_clauses = []
    params: list = []

    if date_from:
        where_clauses.append("pi.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where_clauses.append("pi.inward_date <= %s")
        params.append(date_to)
    if search:
        like = f"%{search}%"
        where_clauses.append("""(
            pi.supplier_name ILIKE %s
            OR pi.invoice_number ILIKE %s
            OR pi.work_type ILIKE %s
            OR pi.customer_name ILIKE %s
            OR pi.checked_received_by ILIKE %s
            OR pi.remarks ILIKE %s
            OR TO_CHAR(pi.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(pi.inward_time, 'HH24:MI:SS') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM PaperItems pit WHERE pit.inward_id = pi.id
                AND (
                    pit.quality ILIKE %s
                    OR pit.gsm::text ILIKE %s
                    OR pit.form_type ILIKE %s
                    OR pit.reel_width::text ILIKE %s
                    OR pit.total_reel_weight::text ILIKE %s
                    OR pit.sheet_length::text ILIKE %s
                    OR pit.sheet_width::text ILIKE %s
                    OR pit.total_sheets::text ILIKE %s
                )
            )
        )""")
        params.extend([like] * 16)
    if form_type:
        where_clauses.append(
            "EXISTS (SELECT 1 FROM PaperItems pit WHERE pit.inward_id = pi.id AND pit.form_type = %s)"
        )
        params.append(form_type)
    if work_type:
        where_clauses.append("pi.work_type = %s")
        params.append(work_type)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    query = f"""
        SELECT pi.id, pi.inward_date, pi.inward_time, pi.supplier_name, pi.invoice_number,
               pi.work_type, pi.customer_name, pi.checked_received_by, pi.remarks,
               (SELECT COUNT(*) FROM PaperItems pit WHERE pit.inward_id = pi.id) AS item_count
        FROM PaperInward pi
        {where_sql}
        ORDER BY pi.inward_date DESC, pi.id DESC
    """
    cursor.execute(query, params)
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT inward_id, quality, gsm FROM PaperItems WHERE inward_id IN ({ph}) ORDER BY inward_id, id",
            ids,
        )
        for item_row in cursor.fetchall():
            summaries.setdefault(item_row[0], []).append(f"{item_row[1]} ({item_row[2]} GSM)")

    conn.close()
    return [
        {
            "id": r[0],
            "inward_date": r[1],
            "inward_time": r[2],
            "supplier_name": r[3],
            "invoice_number": r[4],
            "work_type": r[5],
            "customer_name": r[6],
            "checked_received_by": r[7],
            "remarks": r[8],
            "item_count": r[9],
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/suggestions", response_model=PaperSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def get_values(category: str) -> List[str]:
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (category,))
        return [r[0] for r in cursor.fetchall()]

    supplier_names = get_values("supplier_name")
    customer_names = get_values("customer_name")
    qualities = get_values("quality")
    checked_received_by = get_values("checked_received_by")

    cursor.execute("SELECT value FROM SuggestionMemory WHERE category = 'gsm' ORDER BY value::int")
    gsm_values = [int(r[0]) for r in cursor.fetchall()]

    conn.close()
    return {
        "supplier_names": supplier_names,
        "customer_names": customer_names,
        "qualities": qualities,
        "gsm_values": gsm_values,
        "checked_received_by": checked_received_by,
    }


@router.delete("/suggestions/{category}/{value}")
def delete_suggestion(category: str, value: str, current_user: dict = Depends(get_current_user)):
    if category not in SUGGESTION_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid suggestion category")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SuggestionMemory WHERE category = %s AND value = %s", (category, value))
    conn.commit()
    conn.close()
    return {"detail": "Removed"}


@router.get("/export")
def export_paper(
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
        f"SELECT id FROM PaperInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/stock")
def get_paper_stock(current_user: dict = Depends(get_current_user)):
    """Live stock: reels (kg) and sheets (count) grouped by quality/gsm/size."""
    conn = get_connection()
    try:
        c = conn.cursor()

        # Reel stock grouped by quality, gsm, reel_width
        c.execute("""
            SELECT
                pi.quality,
                pi.gsm,
                pi.reel_width,
                COALESCE(SUM(pirw.weight), 0)
                + COALESCE((
                    SELECT SUM(adj.quantity)
                    FROM PaperAdjustmentEntries adj
                    WHERE adj.quality = pi.quality AND adj.gsm = pi.gsm
                      AND adj.form_type = 'Reel Form'
                      AND (adj.reel_width = pi.reel_width OR adj.reel_width IS NULL)
                ), 0)
                - COALESCE((
                    SELECT SUM(poi.weight_issued)
                    FROM PaperOutwardItems poi
                    WHERE poi.quality = pi.quality AND poi.gsm = pi.gsm
                      AND poi.form_type = 'Reel Form'
                      AND poi.weight_issued IS NOT NULL
                      AND (poi.reel_width = pi.reel_width OR poi.reel_width IS NULL)
                ), 0)
                AS available_kg
            FROM PaperItems pi
            JOIN PaperItemReelWeights pirw ON pirw.paper_item_id = pi.id
            WHERE pi.form_type = 'Reel Form'
            GROUP BY pi.quality, pi.gsm, pi.reel_width
            ORDER BY pi.quality, pi.gsm, pi.reel_width
        """)
        reel_rows = c.fetchall()
        reels = [
            {
                "quality": r[0],
                "gsm": r[1],
                "reel_width": r[2],
                "available_kg": round(float(r[3]), 2),
            }
            for r in reel_rows
            if float(r[3]) > 0
        ]

        # Sheet stock grouped by quality, gsm, sheet_length, sheet_width
        c.execute("""
            SELECT
                pi.quality,
                pi.gsm,
                pi.sheet_length,
                pi.sheet_width,
                COALESCE(SUM(pi.total_sheets), 0)
                + COALESCE((
                    SELECT SUM(adj.quantity)
                    FROM PaperAdjustmentEntries adj
                    WHERE adj.quality = pi.quality AND adj.gsm = pi.gsm
                      AND adj.form_type = 'Sheet Form'
                      AND (
                          (adj.sheet_length = pi.sheet_length AND adj.sheet_width = pi.sheet_width)
                          OR (adj.sheet_length IS NULL AND adj.sheet_width IS NULL)
                      )
                ), 0)
                - COALESCE((
                    SELECT SUM(poi.sheets_issued)
                    FROM PaperOutwardItems poi
                    WHERE poi.quality = pi.quality AND poi.gsm = pi.gsm
                      AND poi.form_type = 'Sheet Form'
                      AND poi.sheets_issued IS NOT NULL
                      AND (
                          (poi.sheet_length = pi.sheet_length AND poi.sheet_width = pi.sheet_width)
                          OR (poi.sheet_length IS NULL AND poi.sheet_width IS NULL)
                      )
                ), 0)
                AS available_sheets
            FROM PaperItems pi
            WHERE pi.form_type = 'Sheet Form' AND pi.total_sheets IS NOT NULL
            GROUP BY pi.quality, pi.gsm, pi.sheet_length, pi.sheet_width
            ORDER BY pi.quality, pi.gsm
        """)
        sheet_rows = c.fetchall()
        sheets = [
            {
                "quality": r[0],
                "gsm": r[1],
                "sheet_length": r[2],
                "sheet_width": r[3],
                "available_sheets": int(r[4]),
            }
            for r in sheet_rows
            if float(r[4]) > 0
        ]

        return {"reels": reels, "sheets": sheets}
    finally:
        conn.close()


@router.get("/{inward_id}", response_model=PaperInwardDetail)
def get_paper(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(inward_id)


@router.post("", response_model=PaperInwardDetail, status_code=status.HTTP_201_CREATED)
def create_paper(body: PaperInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO PaperInward (inward_date, inward_time, supplier_name, invoice_number, work_type, customer_name, checked_received_by, remarks, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (
                body.inward_date, body.inward_time, body.supplier_name, body.invoice_number,
                body.work_type, body.customer_name, body.checked_received_by, body.remarks, current_user["id"],
            ),
        )
        inward_id = cursor.fetchone()[0]

        for item in body.items:
            _insert_item(cursor, inward_id, item, body.work_type, body.customer_name, body.checked_received_by)

        _remember(cursor, "supplier_name", body.supplier_name)
        _remember(cursor, "checked_received_by", body.checked_received_by)
        if body.customer_name:
            _remember(cursor, "customer_name", body.customer_name)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.put("/{inward_id}", response_model=PaperInwardDetail)
def update_paper(inward_id: int, body: PaperInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM PaperInward WHERE id = %s", (inward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)

    try:
        cursor.execute(
            "UPDATE PaperInward SET inward_date = %s, inward_time = %s, supplier_name = %s, invoice_number = %s, "
            "work_type = %s, customer_name = %s, checked_received_by = %s, remarks = %s WHERE id = %s",
            (
                body.inward_date, body.inward_time, body.supplier_name, body.invoice_number,
                body.work_type, body.customer_name, body.checked_received_by, body.remarks, inward_id,
            ),
        )
        cursor.execute("DELETE FROM PaperItems WHERE inward_id = %s", (inward_id,))
        for item in body.items:
            _insert_item(cursor, inward_id, item, body.work_type, body.customer_name, body.checked_received_by)
        _remember(cursor, "supplier_name", body.supplier_name)
        _remember(cursor, "checked_received_by", body.checked_received_by)
        if body.customer_name:
            _remember(cursor, "customer_name", body.customer_name)
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(inward_id)


@router.delete("/{inward_id}")
def delete_paper(inward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM PaperInward WHERE id = %s", (inward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute("DELETE FROM PaperInward WHERE id = %s", (inward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
