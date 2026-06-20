from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, model_validator

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

router = APIRouter(prefix="/api/ctp", tags=["ctp"])


PLATE_SIZE_OPTIONS = ("770 x 1030 mm", "800 x 1030 mm", "Other")

PRESET_DIMENSIONS = {
    "770 x 1030 mm": (770.0, 1030.0),
    "800 x 1030 mm": (800.0, 1030.0),
}

CTP_CHECKED_RECEIVED_BY_OPTIONS = ("NAVNEET MAHAJAN", "Other")

CTP_CATEGORY_MAP = {
    "supplier_name": "ctp_supplier_name",
    "checked_received_by": "ctp_checked_received_by",
}


class PlateSizeInput(BaseModel):
    plate_size: str
    length_mm: Optional[float] = None
    width_mm: Optional[float] = None
    total_packets: int
    plates_per_packet: int

    @model_validator(mode="after")
    def validate_plate_size(self):
        if self.plate_size not in PLATE_SIZE_OPTIONS:
            raise ValueError("Invalid plate size")
        if self.plate_size == "Other":
            if self.length_mm is None or self.width_mm is None or self.length_mm <= 0 or self.width_mm <= 0:
                raise ValueError("length_mm and width_mm are required for a custom plate size")
        if self.total_packets <= 0 or self.plates_per_packet <= 0:
            raise ValueError("total_packets and plates_per_packet must be greater than zero")
        return self


class PlateSizeOut(BaseModel):
    size_number: int
    plate_size: str
    length_mm: float
    width_mm: float
    total_packets: int
    plates_per_packet: int
    total_plates: int


class CTPInwardCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: str
    remarks: Optional[str] = None
    plate_sizes: List[PlateSizeInput]

    @model_validator(mode="after")
    def validate_entry(self):
        if not self.supplier_name or not self.supplier_name.strip():
            raise ValueError("supplier_name is required")
        if not self.checked_received_by or not self.checked_received_by.strip():
            raise ValueError("checked_received_by is required")
        if not self.plate_sizes:
            raise ValueError("At least one plate size is required")
        return self


class CTPInwardDetail(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    checked_received_by: Optional[str] = None
    remarks: Optional[str] = None
    plate_sizes: List[PlateSizeOut]
    grand_total_plates: int
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None


class CTPInwardListItem(BaseModel):
    id: int
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    remarks: Optional[str] = None
    plate_size_count: int
    grand_total_plates: int
    item_summaries: List[str] = []


class CTPSuggestionsOut(BaseModel):
    supplier_names: List[str]
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


def _insert_plate_size(cursor, ctp_id: int, idx: int, plate: PlateSizeInput) -> int:
    if plate.plate_size in PRESET_DIMENSIONS:
        length_mm, width_mm = PRESET_DIMENSIONS[plate.plate_size]
    else:
        length_mm, width_mm = plate.length_mm, plate.width_mm

    total_plates = plate.total_packets * plate.plates_per_packet

    cursor.execute("""
        INSERT INTO CTPPlateSizes (
            ctp_inward_id, size_number, plate_size, length_mm, width_mm,
            total_packets, plates_per_packet, total_plates
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (ctp_id, idx, plate.plate_size, length_mm, width_mm, plate.total_packets, plate.plates_per_packet, total_plates))

    return total_plates


def _fetch_detail(ctp_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT c.id, c.inward_date, c.inward_time, c.supplier_name, c.invoice_number,
               c.checked_received_by, c.grand_total_plates, c.remarks,
               c.created_by, COALESCE(u.full_name, u.username)
        FROM CTPInward c LEFT JOIN Users u ON u.id = c.created_by WHERE c.id = %s
    """, (ctp_id,))
    header = cursor.fetchone()
    if not header:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute("""
        SELECT size_number, plate_size, length_mm, width_mm, total_packets, plates_per_packet, total_plates
        FROM CTPPlateSizes WHERE ctp_inward_id = %s ORDER BY size_number
    """, (ctp_id,))
    plate_sizes = [
        {
            "size_number": r[0],
            "plate_size": r[1],
            "length_mm": float(r[2]),
            "width_mm": float(r[3]),
            "total_packets": r[4],
            "plates_per_packet": r[5],
            "total_plates": r[6],
        }
        for r in cursor.fetchall()
    ]

    conn.close()
    return {
        "id": header[0],
        "inward_date": header[1],
        "inward_time": header[2],
        "supplier_name": header[3],
        "invoice_number": header[4],
        "checked_received_by": header[5],
        "grand_total_plates": header[6],
        "remarks": header[7],
        "created_by_id": header[8],
        "created_by_name": header[9],
        "plate_sizes": plate_sizes,
    }


@router.get("", response_model=List[CTPInwardListItem])
def list_ctp(
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
            ci.supplier_name ILIKE %s
            OR ci.invoice_number ILIKE %s
            OR ci.checked_received_by ILIKE %s
            OR ci.remarks ILIKE %s
            OR TO_CHAR(ci.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR TO_CHAR(ci.inward_time, 'HH24:MI:SS') ILIKE %s
            OR ci.grand_total_plates::text ILIKE %s
            OR EXISTS (
                SELECT 1 FROM CTPPlateSizes cps WHERE cps.ctp_inward_id = ci.id
                AND (
                    cps.plate_size ILIKE %s
                    OR cps.length_mm::text ILIKE %s
                    OR cps.width_mm::text ILIKE %s
                    OR cps.total_packets::text ILIKE %s
                    OR cps.plates_per_packet::text ILIKE %s
                    OR cps.total_plates::text ILIKE %s
                )
            )
        )""")
        params.extend([like] * 13)
    if date_from:
        where.append("ci.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("ci.inward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT ci.id, ci.inward_date, ci.inward_time, ci.supplier_name, ci.invoice_number, ci.grand_total_plates, "
        f"ci.remarks, (SELECT COUNT(*) FROM CTPPlateSizes cps WHERE cps.ctp_inward_id = ci.id) AS plate_size_count "
        f"FROM CTPInward ci WHERE {' AND '.join(where)} "
        f"ORDER BY ci.inward_date DESC, ci.inward_time DESC, ci.id DESC",
        params,
    )
    rows = cursor.fetchall()

    summaries: dict = {}
    if rows:
        ids = [r[0] for r in rows]
        ph = ",".join(["%s"] * len(ids))
        cursor.execute(
            f"SELECT ctp_inward_id, plate_size, total_packets * plates_per_packet AS total_plates "
            f"FROM CTPPlateSizes WHERE ctp_inward_id IN ({ph}) ORDER BY ctp_inward_id, size_number",
            ids,
        )
        for item_row in cursor.fetchall():
            label = f"{item_row[1]} — {item_row[2]} plates"
            summaries.setdefault(item_row[0], []).append(label)

    conn.close()
    return [
        {
            "id": r[0],
            "inward_date": r[1],
            "inward_time": r[2],
            "supplier_name": r[3],
            "invoice_number": r[4],
            "grand_total_plates": r[5],
            "remarks": r[6],
            "plate_size_count": r[7],
            "item_summaries": summaries.get(r[0], []),
        }
        for r in rows
    ]


@router.get("/suggestions", response_model=CTPSuggestionsOut)
def get_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def get_values(category: str) -> List[str]:
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (category,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": get_values("ctp_supplier_name"),
        "checked_received_by": get_values("ctp_checked_received_by"),
    }
    conn.close()
    return result


@router.delete("/suggestions/{category}/{value}")
def delete_suggestion(category: str, value: str, current_user: dict = Depends(get_current_user)):
    if category not in CTP_CATEGORY_MAP:
        raise HTTPException(status_code=400, detail="Invalid suggestion category")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM SuggestionMemory WHERE category = %s AND value = %s", (CTP_CATEGORY_MAP[category], value))
    conn.commit()
    conn.close()
    return {"detail": "Removed"}


@router.get("/export")
def export_ctp(
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
        f"SELECT id FROM CTPInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(eid) for eid in ids]


@router.get("/{ctp_id}", response_model=CTPInwardDetail)
def get_ctp(ctp_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(ctp_id)


@router.post("", response_model=CTPInwardDetail, status_code=status.HTTP_201_CREATED)
def create_ctp(body: CTPInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        grand_total = sum(p.total_packets * p.plates_per_packet for p in body.plate_sizes)

        cursor.execute("""
            INSERT INTO CTPInward (
                inward_date, inward_time, supplier_name, invoice_number, checked_received_by, grand_total_plates, remarks, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """, (
            body.inward_date, body.inward_time, body.supplier_name, body.invoice_number,
            body.checked_received_by, grand_total, body.remarks, current_user["id"],
        ))
        ctp_id = cursor.fetchone()[0]

        for idx, plate in enumerate(body.plate_sizes, start=1):
            _insert_plate_size(cursor, ctp_id, idx, plate)

        _remember(cursor, "ctp_supplier_name", body.supplier_name)
        _remember(cursor, "ctp_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(ctp_id)


@router.put("/{ctp_id}", response_model=CTPInwardDetail)
def update_ctp(ctp_id: int, body: CTPInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, inward_date, inward_time, created_by FROM CTPInward WHERE id = %s", (ctp_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)

    try:
        grand_total = sum(p.total_packets * p.plates_per_packet for p in body.plate_sizes)

        cursor.execute("""
            UPDATE CTPInward
            SET inward_date = %s, inward_time = %s, supplier_name = %s, invoice_number = %s,
                checked_received_by = %s, grand_total_plates = %s, remarks = %s
            WHERE id = %s
        """, (
            body.inward_date, body.inward_time, body.supplier_name, body.invoice_number,
            body.checked_received_by, grand_total, body.remarks, ctp_id,
        ))

        cursor.execute("DELETE FROM CTPPlateSizes WHERE ctp_inward_id = %s", (ctp_id,))
        for idx, plate in enumerate(body.plate_sizes, start=1):
            _insert_plate_size(cursor, ctp_id, idx, plate)

        _remember(cursor, "ctp_supplier_name", body.supplier_name)
        _remember(cursor, "ctp_checked_received_by", body.checked_received_by)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(ctp_id)


@router.delete("/{ctp_id}")
def delete_ctp(ctp_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM CTPInward WHERE id = %s", (ctp_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")

    cursor.execute("DELETE FROM CTPInward WHERE id = %s", (ctp_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
