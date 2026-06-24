from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/dies", tags=["dies"])

CATEGORY_MAP = {
    "supplier_name": "die_supplier_name",
    "job_name": "die_job_name",
    "storage_location": "die_storage_location",
    "checked_received_by": "die_checked_received_by",
}


# ─── Schemas ───────────────────────────────────────────────────────────────────

class DieItemCreate(BaseModel):
    die_number: str
    job_name: str
    ups: int
    embossing: str
    female_block: Optional[str] = None
    rubberized: str
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    storage_location: Optional[str] = None

    @model_validator(mode="after")
    def validate_die(self):
        if not self.die_number or not self.die_number.strip():
            raise ValueError("die_number is required")
        if not self.job_name or not self.job_name.strip():
            raise ValueError("job_name is required")
        if self.ups <= 0:
            raise ValueError("ups must be greater than zero")
        if self.embossing not in ("Yes", "No"):
            raise ValueError("embossing must be Yes or No")
        if self.rubberized not in ("Yes", "No"):
            raise ValueError("rubberized must be Yes or No")
        if self.embossing == "Yes" and self.female_block is not None:
            if self.female_block not in ("Yes", "No"):
                raise ValueError("female_block must be Yes or No")
        if self.embossing == "No":
            self.female_block = None
        return self


class DieItemOut(BaseModel):
    id: int
    item_number: int
    die_number: str
    job_name: str
    ups: int
    embossing: str
    female_block: Optional[str] = None
    rubberized: str
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    storage_location: Optional[str] = None
    status: str
    discontinued_date: Optional[date] = None


class DiesInwardCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    items: List[DieItemCreate]
    replace_existing: bool = False

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.supplier_name or not self.supplier_name.strip():
            raise ValueError("supplier_name is required")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.items:
            raise ValueError("At least one die is required")
        return self


class DiesInwardDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[DieItemOut]
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class DiesInwardListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    remarks: Optional[str] = None
    die_count: int
    item_summaries: List[str] = []


class DieItemSearchResult(BaseModel):
    id: int
    inward_id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    die_number: str
    job_name: str
    ups: int
    embossing: str
    rubberized: str
    status: str
    storage_location: Optional[str] = None


class DiesSuggestionsOut(BaseModel):
    supplier_names: List[str]
    job_names: List[str]
    storage_locations: List[str]
    checked_received_by: List[str]


class DeleteRequest(BaseModel):
    password: str


# ─── Helpers ───────────────────────────────────────────────────────────────────

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


def _insert_die_item(cursor, inward_id: int, idx: int, item: DieItemCreate):
    cursor.execute(
        "INSERT INTO DieItems (inward_id, item_number, die_number, job_name, ups, embossing, "
        "female_block, rubberized, length, width, height, storage_location, status) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Active')",
        (
            inward_id, idx, item.die_number.strip(), item.job_name.strip(), item.ups,
            item.embossing, item.female_block, item.rubberized,
            item.length, item.width, item.height,
            item.storage_location.strip() if item.storage_location else None,
        ),
    )


def _check_duplicates(cursor, items: List[DieItemCreate], exclude_inward_id: Optional[int] = None) -> List[str]:
    duplicates = []
    for item in items:
        dn = item.die_number.strip()
        if exclude_inward_id is not None:
            cursor.execute(
                "SELECT 1 FROM DieItems WHERE die_number = %s AND status = 'Active' AND inward_id != %s",
                (dn, exclude_inward_id),
            )
        else:
            cursor.execute(
                "SELECT 1 FROM DieItems WHERE die_number = %s AND status = 'Active'",
                (dn,),
            )
        if cursor.fetchone():
            duplicates.append(dn)
    return duplicates


def _discontinue_existing(cursor, items: List[DieItemCreate], exclude_inward_id: Optional[int] = None):
    today = date.today()
    for item in items:
        dn = item.die_number.strip()
        if exclude_inward_id is not None:
            cursor.execute(
                "UPDATE DieItems SET status = 'Discontinued', discontinued_date = %s "
                "WHERE die_number = %s AND status = 'Active' AND inward_id != %s",
                (today, dn, exclude_inward_id),
            )
        else:
            cursor.execute(
                "UPDATE DieItems SET status = 'Discontinued', discontinued_date = %s "
                "WHERE die_number = %s AND status = 'Active'",
                (today, dn),
            )


def _fetch_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT d.id, d.inward_date, d.inward_time, d.supplier_name, d.invoice_number, "
        "d.checked_received_by, d.remarks, "
        "d.created_by, COALESCE(u.full_name, u.username) "
        "FROM DiesInward d LEFT JOIN Users u ON u.id = d.created_by WHERE d.id = %s",
        (inward_id,),
    )
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute(
        "SELECT id, item_number, die_number, job_name, ups, embossing, female_block, "
        "rubberized, length, width, height, storage_location, status, discontinued_date "
        "FROM DieItems WHERE inward_id = %s ORDER BY item_number",
        (inward_id,),
    )
    items = []
    for r in cursor.fetchall():
        items.append({
            "id": r[0], "item_number": r[1], "die_number": r[2], "job_name": r[3],
            "ups": r[4], "embossing": r[5], "female_block": r[6], "rubberized": r[7],
            "length": float(r[8]) if r[8] is not None else None,
            "width": float(r[9]) if r[9] is not None else None,
            "height": float(r[10]) if r[10] is not None else None,
            "storage_location": r[11], "status": r[12], "discontinued_date": r[13],
        })

    conn.close()
    return {
        "id": header[0], "inward_date": header[1], "inward_time": header[2],
        "supplier_name": header[3], "invoice_number": header[4],
        "checked_received_by": header[5], "remarks": header[6],
        "created_by_id": header[7],
        "created_by_name": header[8],
        "items": items,
    }


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DiesInwardListItem])
def list_dies(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    supplier: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    where = ["1=1"]
    params: list = []

    if supplier:
        where.append("di.supplier_name ILIKE %s")
        params.append(f"%{supplier}%")

    if date_from:
        where.append("di.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("di.inward_date <= %s")
        params.append(date_to)

    if search:
        like = f"%{search}%"
        where.append("""(
            di.supplier_name ILIKE %s
            OR di.invoice_number ILIKE %s
            OR di.checked_received_by ILIKE %s
            OR di.remarks ILIKE %s
            OR TO_CHAR(di.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(di.inward_time, 'HH24:MI:SS') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM DieItems die2 WHERE die2.inward_id = di.id
                AND (
                    die2.die_number ILIKE %s
                    OR die2.job_name ILIKE %s
                    OR die2.storage_location ILIKE %s
                    OR die2.embossing ILIKE %s
                    OR die2.rubberized ILIKE %s
                    OR die2.status ILIKE %s
                    OR die2.ups::text ILIKE %s
                    OR die2.female_block ILIKE %s
                )
            )
        )""")
        params.extend([like] * 14)

    if status_filter and status_filter != "All":
        where.append("EXISTS (SELECT 1 FROM DieItems die2 WHERE die2.inward_id = di.id AND die2.status = %s)")
        params.append(status_filter)

    sql = (
        "SELECT di.id, di.inward_date, di.inward_time, di.supplier_name, di.remarks, "
        "       (SELECT COUNT(*) FROM DieItems d WHERE d.inward_id = di.id) AS die_count "
        "FROM DiesInward di "
        f"WHERE {' AND '.join(where)} "
        "ORDER BY di.inward_date DESC, di.inward_time DESC, di.id DESC"
    )
    cursor.execute(sql, params)
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT inward_id, die_number, job_name FROM DieItems WHERE inward_id IN ({ph}) ORDER BY inward_id, item_number",
            ids,
        )
        for item_row in cursor.fetchall():
            summaries.setdefault(item_row[0], []).append(f"{item_row[1]}: {item_row[2]}")

    conn.close()
    return [
        {
            "id": r[0], "inward_date": r[1], "inward_time": r[2],
            "supplier_name": r[3], "remarks": r[4], "die_count": r[5],
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/items", response_model=List[DieItemSearchResult])
def search_die_items(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    where = ["1=1"]
    params: list = []
    if search:
        like = f"%{search}%"
        where.append(
            "(di.die_number ILIKE %s OR di.job_name ILIKE %s OR di.storage_location ILIKE %s)"
        )
        params.extend([like, like, like])
    if status_filter and status_filter != "All":
        where.append("di.status = %s")
        params.append(status_filter)

    cursor.execute(
        f"SELECT di.id, di.inward_id, dw.inward_date, dw.inward_time, dw.supplier_name, "
        f"di.die_number, di.job_name, di.ups, di.embossing, di.rubberized, di.status, di.storage_location "
        f"FROM DieItems di "
        f"JOIN DiesInward dw ON dw.id = di.inward_id "
        f"WHERE {' AND '.join(where)} "
        f"ORDER BY dw.inward_date DESC, dw.inward_time DESC, di.die_number",
        params,
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "inward_id": r[1], "inward_date": r[2], "inward_time": r[3],
            "supplier_name": r[4], "die_number": r[5], "job_name": r[6],
            "ups": r[7], "embossing": r[8], "rubberized": r[9],
            "status": r[10], "storage_location": r[11],
        }
        for r in rows
    ]


@router.get("/suggestions", response_model=DiesSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def vals(cat: str):
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (cat,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": vals("die_supplier_name"),
        "job_names": vals("die_job_name"),
        "storage_locations": vals("die_storage_location"),
        "checked_received_by": vals("die_checked_received_by"),
    }
    conn.close()
    return result


@router.delete("/suggestions/{category}/{value}")
def delete_suggestion(
    category: str, value: str, current_user: dict = Depends(get_current_user)
):
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


class DieNumbersCheck(BaseModel):
    die_numbers: List[str]
    exclude_inward_id: Optional[int] = None


@router.post("/check-duplicates")
def check_duplicates(body: DieNumbersCheck, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    duplicates = []
    for dn in body.die_numbers:
        dn = dn.strip()
        if not dn:
            continue
        if body.exclude_inward_id is not None:
            cursor.execute(
                "SELECT 1 FROM DieItems WHERE die_number = %s AND status = 'Active' AND inward_id != %s",
                (dn, body.exclude_inward_id),
            )
        else:
            cursor.execute(
                "SELECT 1 FROM DieItems WHERE die_number = %s AND status = 'Active'",
                (dn,),
            )
        if cursor.fetchone():
            duplicates.append(dn)
    conn.close()
    return {"duplicates": duplicates}


@router.get("/export")
def export_dies(
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
        f"SELECT id FROM DiesInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/stock")
def get_dies_stock(current_user: dict = Depends(get_current_user)):
    """Dies asset summary: active/discontinued counts and full item list with latest location."""
    conn = get_connection()
    try:
        c = conn.cursor()

        c.execute("SELECT COUNT(*) FROM DieItems WHERE status = 'Active'")
        active_count = c.fetchone()[0]

        c.execute("SELECT COUNT(*) FROM DieItems WHERE status = 'Discontinued'")
        discontinued_count = c.fetchone()[0]

        c.execute("""
            SELECT
                di.id,
                di.die_number,
                di.job_name,
                di.status,
                di.storage_location,
                (
                    SELECT dm.current_location
                    FROM DieMovements dm
                    WHERE dm.die_item_id = di.id
                    ORDER BY dm.id DESC
                    LIMIT 1
                ) AS latest_location
            FROM DieItems di
            ORDER BY di.status, di.die_number
        """)
        rows = c.fetchall()
        items = [
            {
                "die_number": r[1],
                "job_name": r[2],
                "status": r[3],
                "current_location": r[5] if r[5] is not None else r[4],
            }
            for r in rows
        ]

        return {
            "active_count": active_count,
            "discontinued_count": discontinued_count,
            "items": items,
        }
    finally:
        conn.close()


@router.get("/{inward_id}", response_model=DiesInwardDetail)
def get_dies(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(inward_id)


@router.post("", response_model=DiesInwardDetail, status_code=status.HTTP_201_CREATED)
def create_dies(body: DiesInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if not body.replace_existing:
            duplicates = _check_duplicates(cursor, body.items)
            if duplicates:
                conn.close()
                raise HTTPException(
                    status_code=409,
                    detail={"message": "Duplicate active die numbers found", "duplicates": duplicates},
                )

        cursor.execute(
            "INSERT INTO DiesInward (inward_date, inward_time, supplier_name, invoice_number, "
            "checked_received_by, remarks, created_by) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (
                body.inward_date, body.inward_time, body.supplier_name.strip(),
                body.invoice_number.strip() if body.invoice_number else None,
                body.checked_received_by.strip(),
                body.remarks.strip() if body.remarks else None,
                current_user["id"],
            ),
        )
        inward_id = cursor.fetchone()[0]

        if body.replace_existing:
            _discontinue_existing(cursor, body.items)

        for idx, item in enumerate(body.items, start=1):
            _insert_die_item(cursor, inward_id, idx, item)
            _remember(cursor, "die_job_name", item.job_name)
            if item.storage_location:
                _remember(cursor, "die_storage_location", item.storage_location)

        _remember(cursor, "die_supplier_name", body.supplier_name)
        _remember(cursor, "die_checked_received_by", body.checked_received_by)

        conn.commit()
    except HTTPException:
        conn.close()
        raise
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return _fetch_detail(inward_id)


@router.put("/{inward_id}", response_model=DiesInwardDetail)
def update_dies(
    inward_id: int,
    body: DiesInwardCreate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM DiesInward WHERE id = %s", (inward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)
    try:
        if not body.replace_existing:
            duplicates = _check_duplicates(cursor, body.items, exclude_inward_id=inward_id)
            if duplicates:
                conn.close()
                raise HTTPException(
                    status_code=409,
                    detail={"message": "Duplicate active die numbers found", "duplicates": duplicates},
                )

        cursor.execute(
            "UPDATE DiesInward SET inward_date=%s, inward_time=%s, supplier_name=%s, invoice_number=%s, "
            "checked_received_by=%s, remarks=%s WHERE id=%s",
            (
                body.inward_date, body.inward_time, body.supplier_name.strip(),
                body.invoice_number.strip() if body.invoice_number else None,
                body.checked_received_by.strip(),
                body.remarks.strip() if body.remarks else None,
                inward_id,
            ),
        )

        if body.replace_existing:
            _discontinue_existing(cursor, body.items, exclude_inward_id=inward_id)

        cursor.execute("DELETE FROM DieItems WHERE inward_id = %s", (inward_id,))
        for idx, item in enumerate(body.items, start=1):
            _insert_die_item(cursor, inward_id, idx, item)
            _remember(cursor, "die_job_name", item.job_name)
            if item.storage_location:
                _remember(cursor, "die_storage_location", item.storage_location)

        _remember(cursor, "die_supplier_name", body.supplier_name)
        _remember(cursor, "die_checked_received_by", body.checked_received_by)

        conn.commit()
    except HTTPException:
        conn.close()
        raise
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return _fetch_detail(inward_id)


@router.delete("/{inward_id}")
def delete_dies(
    inward_id: int,
    body: DeleteRequest,
    current_user: dict = Depends(require_admin),
):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM DiesInward WHERE id = %s", (inward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    cursor.execute("DELETE FROM DiesInward WHERE id = %s", (inward_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
