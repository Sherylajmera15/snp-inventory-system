"""
Micro Plates, Films & Chemicals module.
Handles inward and outward for all three sub-modules in one file.
"""
from datetime import date, time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import check_edit_authorization, get_current_user, require_admin, verify_password
from database import get_connection

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class QuantityGroupInput(BaseModel):
    number_of_packs: float
    quantity_per_pack: float
    unit: str


class PlateItemCreate(BaseModel):
    plate_size: str
    custom_length: Optional[float] = None
    custom_width: Optional[float] = None
    number_of_plates: int


class ChemicalItemCreate(BaseModel):
    chemical_name: str
    manufacturer: Optional[str] = None
    quantity_groups: List[QuantityGroupInput]


class FilmItemCreate(BaseModel):
    job_name: str
    film_length: Optional[float] = None
    film_width: Optional[float] = None
    film_type: str  # 'Only Micro' | 'Only Embossing' | 'Both'
    quantity: int = 1


class MicroInwardCreate(BaseModel):
    inward_date: date
    inward_time: time
    supplier_name: str
    invoice_number: Optional[str] = None
    received_by: str
    remarks: Optional[str] = None
    material_type: str  # 'Plates' | 'Chemicals' | 'Films'
    plate_items: Optional[List[PlateItemCreate]] = None
    chemical_items: Optional[List[ChemicalItemCreate]] = None
    film_items: Optional[List[FilmItemCreate]] = None


class PlatesOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    receiver_name: Optional[str] = None
    issued_by: Optional[str] = None
    plate_size: str
    number_of_plates: int
    remarks: Optional[str] = None


class PlatesOutwardUpdate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    receiver_name: Optional[str] = None
    issued_by: Optional[str] = None
    plate_size: str
    number_of_plates: int
    remarks: Optional[str] = None


class SimpleOutwardItemInput(BaseModel):
    item_name: str
    unit: str
    quantity_issued: float


class ChemicalsOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None
    items: List[SimpleOutwardItemInput]
    force_adjustment: bool = False


class ChemicalsOutwardUpdate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class FilmsOutwardCreate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    receiver_name: Optional[str] = None
    issued_by: Optional[str] = None
    job_name: str
    film_length: Optional[float] = None
    film_width: Optional[float] = None
    film_type: Optional[str] = None
    quantity: Optional[int] = None
    remarks: Optional[str] = None


class FilmsOutwardUpdate(BaseModel):
    outward_date: date
    outward_time: Optional[time] = None
    receiver_name: Optional[str] = None
    issued_by: Optional[str] = None
    job_name: str
    film_length: Optional[float] = None
    film_width: Optional[float] = None
    film_type: Optional[str] = None
    quantity: Optional[int] = None
    remarks: Optional[str] = None


class DeleteRequest(BaseModel):
    password: str


# ─── Suggestion helper ────────────────────────────────────────────────────────

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


# ─── Micro Inward Router ──────────────────────────────────────────────────────

micro_router = APIRouter(prefix="/api/micro", tags=["micro"])


def _fetch_micro_detail(inward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT m.id, m.inward_date, m.inward_time, m.supplier_name, m.invoice_number, "
            "m.received_by, m.remarks, m.material_type, "
            "m.created_by, COALESCE(u.full_name, u.username) "
            "FROM MicroInward m LEFT JOIN users u ON u.id = m.created_by WHERE m.id = %s",
            (inward_id,),
        )
        header = cursor.fetchone()
        if not header:
            raise HTTPException(status_code=404, detail="Inward entry not found")

        material_type = header[7]

        plate_items = []
        chemical_items = []
        film_items = []

        if material_type == "Plates":
            cursor.execute(
                "SELECT id, plate_size, custom_length, custom_width, number_of_plates "
                "FROM MicroPlateItem WHERE inward_id = %s ORDER BY id",
                (inward_id,),
            )
            for r in cursor.fetchall():
                plate_items.append({
                    "id": r[0],
                    "plate_size": r[1],
                    "custom_length": float(r[2]) if r[2] is not None else None,
                    "custom_width": float(r[3]) if r[3] is not None else None,
                    "number_of_plates": r[4],
                })

        elif material_type == "Chemicals":
            cursor.execute(
                "SELECT ci.id, ci.item_number, ci.chemical_name, ci.manufacturer, ci.item_total_quantity, "
                "cqg.group_number, cqg.number_of_packs, cqg.quantity_per_pack, cqg.group_quantity, cqg.unit "
                "FROM MicroChemicalItem ci "
                "LEFT JOIN MicroChemicalQuantityGroups cqg ON cqg.item_id = ci.id "
                "WHERE ci.inward_id = %s ORDER BY ci.item_number, cqg.group_number",
                (inward_id,),
            )
            rows = cursor.fetchall()
            items_map: dict = {}
            for r in rows:
                iid, inum, iname, imfr, itotal, gnum, npacks, qperpack, gqty, gunit = r
                if iid not in items_map:
                    items_map[iid] = {
                        "id": iid, "item_number": inum, "chemical_name": iname,
                        "manufacturer": imfr,
                        "item_total_quantity": float(itotal) if itotal is not None else 0.0,
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
            chemical_items = list(items_map.values())

        elif material_type == "Films":
            cursor.execute(
                "SELECT id, job_name, film_length, film_width, film_type, quantity "
                "FROM MicroFilmItem WHERE inward_id = %s ORDER BY id",
                (inward_id,),
            )
            for r in cursor.fetchall():
                film_items.append({
                    "id": r[0],
                    "job_name": r[1],
                    "film_length": float(r[2]) if r[2] is not None else None,
                    "film_width": float(r[3]) if r[3] is not None else None,
                    "film_type": r[4],
                    "quantity": r[5],
                })

        return {
            "id": header[0],
            "inward_date": header[1],
            "inward_time": header[2],
            "supplier_name": header[3],
            "invoice_number": header[4],
            "received_by": header[5],
            "remarks": header[6],
            "material_type": header[7],
            "created_by_id": header[8],
            "created_by_name": header[9],
            "plate_items": plate_items,
            "chemical_items": chemical_items,
            "film_items": film_items,
        }
    finally:
        conn.close()


def _insert_micro_items(cursor, inward_id: int, body: MicroInwardCreate):
    if body.material_type == "Plates" and body.plate_items:
        for item in body.plate_items:
            cursor.execute(
                "INSERT INTO MicroPlateItem (inward_id, plate_size, custom_length, custom_width, number_of_plates) "
                "VALUES (%s, %s, %s, %s, %s)",
                (inward_id, item.plate_size.strip(), item.custom_length, item.custom_width, item.number_of_plates),
            )

    elif body.material_type == "Chemicals" and body.chemical_items:
        for idx, item in enumerate(body.chemical_items, start=1):
            item_total = sum(g.number_of_packs * g.quantity_per_pack for g in item.quantity_groups)
            cursor.execute(
                "INSERT INTO MicroChemicalItem (inward_id, item_number, chemical_name, manufacturer, item_total_quantity) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (inward_id, idx, item.chemical_name.strip(),
                 item.manufacturer.strip() if item.manufacturer else None,
                 round(item_total, 3)),
            )
            item_id = cursor.fetchone()[0]
            for g_idx, g in enumerate(item.quantity_groups, start=1):
                group_qty = round(g.number_of_packs * g.quantity_per_pack, 3)
                cursor.execute(
                    "INSERT INTO MicroChemicalQuantityGroups "
                    "(item_id, group_number, number_of_packs, quantity_per_pack, group_quantity, unit) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (item_id, g_idx, g.number_of_packs, g.quantity_per_pack, group_qty, g.unit.strip()),
                )

    elif body.material_type == "Films" and body.film_items:
        for item in body.film_items:
            cursor.execute(
                "INSERT INTO MicroFilmItem (inward_id, job_name, film_length, film_width, film_type, quantity) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (inward_id,
                 item.job_name.strip(),
                 item.film_length,
                 item.film_width,
                 item.film_type.strip(),
                 item.quantity),
            )


@micro_router.get("")
def list_micro(
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    material_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    where = ["1=1"]
    params: list = []

    if material_type:
        where.append("m.material_type = %s")
        params.append(material_type)

    if search:
        like = f"%{search}%"
        where.append("""(
            m.supplier_name ILIKE %s
            OR m.invoice_number ILIKE %s
            OR m.received_by ILIKE %s
            OR m.remarks ILIKE %s
            OR TO_CHAR(m.inward_date, 'YYYY-MM-DD') ILIKE %s
            OR EXISTS (
                SELECT 1 FROM MicroPlateItem pi WHERE pi.inward_id = m.id
                AND pi.plate_size ILIKE %s
            )
            OR EXISTS (
                SELECT 1 FROM MicroChemicalItem ci WHERE ci.inward_id = m.id
                AND ci.chemical_name ILIKE %s
            )
            OR EXISTS (
                SELECT 1 FROM MicroFilmItem fi WHERE fi.inward_id = m.id
                AND (fi.film_type ILIKE %s OR fi.job_name ILIKE %s)
            )
        )""")
        params.extend([like] * 9)

    if date_from:
        where.append("m.inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("m.inward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT m.id, m.inward_date, m.inward_time, m.supplier_name, m.invoice_number, "
        f"m.received_by, m.remarks, m.material_type "
        f"FROM MicroInward m WHERE {' AND '.join(where)} "
        f"ORDER BY m.inward_date DESC, m.inward_time DESC, m.id DESC",
        params,
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r[0], "inward_date": r[1], "inward_time": r[2],
            "supplier_name": r[3], "invoice_number": r[4],
            "received_by": r[5], "remarks": r[6], "material_type": r[7],
        }
        for r in rows
    ]


@micro_router.get("/suggestions")
def get_micro_suggestions(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    def vals(cat):
        cursor.execute("SELECT value FROM SuggestionMemory WHERE category = %s ORDER BY value", (cat,))
        return [r[0] for r in cursor.fetchall()]

    result = {
        "supplier_names": vals("micro_supplier_name"),
        "chemical_names": vals("micro_chemical_name"),
        "manufacturers": vals("micro_manufacturer"),
        "received_by_options": vals("micro_received_by"),
    }
    conn.close()
    return result


@micro_router.get("/export")
def export_micro(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    material_type: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["1=1"]
    params: list = []
    if material_type:
        where.append("material_type = %s")
        params.append(material_type)
    if date_from:
        where.append("inward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("inward_date <= %s")
        params.append(date_to)
    cursor.execute(
        f"SELECT id FROM MicroInward WHERE {' AND '.join(where)} ORDER BY inward_date, inward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_micro_detail(eid) for eid in ids]


@micro_router.get("/dashboard")
def get_micro_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    # Today counts
    cursor.execute(
        "SELECT COUNT(*) FROM MicroInward WHERE inward_date = CURRENT_DATE AND material_type = 'Plates'"
    )
    plates_today = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM MicroInward WHERE inward_date = CURRENT_DATE AND material_type = 'Chemicals'"
    )
    chemicals_today = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM MicroInward WHERE inward_date = CURRENT_DATE AND material_type = 'Films'"
    )
    films_today = cursor.fetchone()[0]

    # Month counts
    cursor.execute(
        "SELECT COUNT(*) FROM MicroInward "
        "WHERE DATE_TRUNC('month', inward_date) = DATE_TRUNC('month', CURRENT_DATE) "
        "AND material_type = 'Plates'"
    )
    plates_month = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM MicroInward "
        "WHERE DATE_TRUNC('month', inward_date) = DATE_TRUNC('month', CURRENT_DATE) "
        "AND material_type = 'Chemicals'"
    )
    chemicals_month = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM MicroInward "
        "WHERE DATE_TRUNC('month', inward_date) = DATE_TRUNC('month', CURRENT_DATE) "
        "AND material_type = 'Films'"
    )
    films_month = cursor.fetchone()[0]

    # Plate stock: inward plates - outward plates grouped by plate_size
    cursor.execute(
        """
        SELECT
            pi.plate_size,
            COALESCE(SUM(pi.number_of_plates), 0)
            - COALESCE((
                SELECT SUM(po.number_of_plates)
                FROM MicroPlateOutward po
                WHERE po.plate_size = pi.plate_size
            ), 0) AS available
        FROM MicroPlateItem pi
        GROUP BY pi.plate_size
        ORDER BY pi.plate_size
        """
    )
    plate_stock = [
        {"plate_size": r[0], "available": int(r[1])}
        for r in cursor.fetchall()
    ]

    # Chemical stock
    cursor.execute(
        """
        SELECT
            i.chemical_name AS item_name,
            qg.unit,
            COALESCE(SUM(qg.group_quantity), 0)
            + COALESCE((SELECT SUM(adj.quantity) FROM MicroChemicalAdjustment adj
                        WHERE adj.item_name = i.chemical_name AND adj.unit = qg.unit), 0)
            - COALESCE((SELECT SUM(oi.quantity_issued) FROM MicroChemicalOutwardItem oi
                        WHERE oi.item_name = i.chemical_name AND oi.unit = qg.unit), 0)
            AS available_qty
        FROM MicroChemicalItem i
        JOIN MicroChemicalQuantityGroups qg ON qg.item_id = i.id
        GROUP BY i.chemical_name, qg.unit
        ORDER BY i.chemical_name, qg.unit
        """
    )
    chemical_stock = [
        {"item_name": r[0], "unit": r[1], "available_qty": round(float(r[2]), 3)}
        for r in cursor.fetchall()
    ]

    # Film stock: inward - outward grouped by film_length, film_width, film_type
    cursor.execute(
        """
        SELECT
            fi.film_length,
            fi.film_width,
            fi.film_type,
            COALESCE(SUM(fi.quantity), 0)
            - COALESCE((
                SELECT SUM(fo.quantity)
                FROM MicroFilmOutward fo
                WHERE (fo.film_length IS NOT DISTINCT FROM fi.film_length)
                  AND (fo.film_width IS NOT DISTINCT FROM fi.film_width)
                  AND fo.film_type = fi.film_type
            ), 0) AS available
        FROM MicroFilmItem fi
        GROUP BY fi.film_length, fi.film_width, fi.film_type
        ORDER BY fi.film_length, fi.film_width, fi.film_type
        """
    )
    film_stock = [
        {"film_length": r[0], "film_width": r[1], "film_type": r[2], "available": int(r[3])}
        for r in cursor.fetchall()
    ]

    # Top suppliers
    cursor.execute(
        "SELECT supplier_name, COUNT(*) AS cnt FROM MicroInward "
        "GROUP BY supplier_name ORDER BY cnt DESC LIMIT 10"
    )
    top_suppliers = [{"name": r[0], "count": r[1]} for r in cursor.fetchall()]

    conn.close()
    return {
        "plates_today": plates_today,
        "chemicals_today": chemicals_today,
        "films_today": films_today,
        "plates_month": plates_month,
        "chemicals_month": chemicals_month,
        "films_month": films_month,
        "plate_stock": plate_stock,
        "chemical_stock": chemical_stock,
        "film_stock": film_stock,
        "top_suppliers": top_suppliers,
    }


@micro_router.get("/{inward_id}")
def get_micro(inward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_micro_detail(inward_id)


@micro_router.post("", status_code=status.HTTP_201_CREATED)
def create_micro(body: MicroInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO MicroInward "
            "(inward_date, inward_time, supplier_name, invoice_number, received_by, remarks, material_type, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (
                body.inward_date, body.inward_time,
                body.supplier_name.strip(),
                body.invoice_number.strip() if body.invoice_number else None,
                body.received_by.strip(),
                body.remarks.strip() if body.remarks else None,
                body.material_type,
                current_user["id"],
            ),
        )
        inward_id = cursor.fetchone()[0]

        _insert_micro_items(cursor, inward_id, body)

        # Save suggestions
        _remember(cursor, "micro_supplier_name", body.supplier_name)
        _remember(cursor, "micro_received_by", body.received_by)

        if body.material_type == "Chemicals" and body.chemical_items:
            for item in body.chemical_items:
                _remember(cursor, "micro_chemical_name", item.chemical_name)
                if item.manufacturer:
                    _remember(cursor, "micro_manufacturer", item.manufacturer)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_micro_detail(inward_id)


@micro_router.put("/{inward_id}")
def update_micro(inward_id: int, body: MicroInwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, inward_date, inward_time, created_by, material_type FROM MicroInward WHERE id = %s",
        (inward_id,),
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    check_edit_authorization(str(row[1]), row[2], row[3], current_user)
    existing_material_type = row[4]

    try:
        cursor.execute(
            "UPDATE MicroInward SET inward_date=%s, inward_time=%s, supplier_name=%s, invoice_number=%s, "
            "received_by=%s, remarks=%s, material_type=%s WHERE id=%s",
            (
                body.inward_date, body.inward_time,
                body.supplier_name.strip(),
                body.invoice_number.strip() if body.invoice_number else None,
                body.received_by.strip(),
                body.remarks.strip() if body.remarks else None,
                body.material_type,
                inward_id,
            ),
        )

        # Delete existing sub-items based on old material type
        if existing_material_type == "Plates":
            cursor.execute("DELETE FROM MicroPlateItem WHERE inward_id = %s", (inward_id,))
        elif existing_material_type == "Chemicals":
            cursor.execute(
                "DELETE FROM MicroChemicalQuantityGroups WHERE item_id IN "
                "(SELECT id FROM MicroChemicalItem WHERE inward_id = %s)",
                (inward_id,),
            )
            cursor.execute("DELETE FROM MicroChemicalItem WHERE inward_id = %s", (inward_id,))
        elif existing_material_type == "Films":
            cursor.execute("DELETE FROM MicroFilmItem WHERE inward_id = %s", (inward_id,))

        # Also clean new material type sub-items if type changed
        if body.material_type != existing_material_type:
            if body.material_type == "Plates":
                cursor.execute("DELETE FROM MicroPlateItem WHERE inward_id = %s", (inward_id,))
            elif body.material_type == "Chemicals":
                cursor.execute(
                    "DELETE FROM MicroChemicalQuantityGroups WHERE item_id IN "
                    "(SELECT id FROM MicroChemicalItem WHERE inward_id = %s)",
                    (inward_id,),
                )
                cursor.execute("DELETE FROM MicroChemicalItem WHERE inward_id = %s", (inward_id,))
            elif body.material_type == "Films":
                cursor.execute("DELETE FROM MicroFilmItem WHERE inward_id = %s", (inward_id,))

        _insert_micro_items(cursor, inward_id, body)

        # Save suggestions
        _remember(cursor, "micro_supplier_name", body.supplier_name)
        _remember(cursor, "micro_received_by", body.received_by)

        if body.material_type == "Chemicals" and body.chemical_items:
            for item in body.chemical_items:
                _remember(cursor, "micro_chemical_name", item.chemical_name)
                if item.manufacturer:
                    _remember(cursor, "micro_manufacturer", item.manufacturer)

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_micro_detail(inward_id)


@micro_router.delete("/{inward_id}")
def delete_micro(inward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, material_type FROM MicroInward WHERE id = %s", (inward_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Inward entry not found")
    try:
        material_type = row[1]
        if material_type == "Chemicals":
            cursor.execute(
                "DELETE FROM MicroChemicalQuantityGroups WHERE item_id IN "
                "(SELECT id FROM MicroChemicalItem WHERE inward_id = %s)",
                (inward_id,),
            )
            cursor.execute("DELETE FROM MicroChemicalItem WHERE inward_id = %s", (inward_id,))
        elif material_type == "Plates":
            cursor.execute("DELETE FROM MicroPlateItem WHERE inward_id = %s", (inward_id,))
        elif material_type == "Films":
            cursor.execute("DELETE FROM MicroFilmItem WHERE inward_id = %s", (inward_id,))
        cursor.execute("DELETE FROM MicroInward WHERE id = %s", (inward_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return {"detail": "Deleted successfully"}


# ─── Plates Outward Router ────────────────────────────────────────────────────

micro_plates_outward_router = APIRouter(prefix="/api/micro-plates-outward", tags=["micro-plates-outward"])


def _fetch_plate_outward_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT o.id, o.outward_date, o.outward_time, o.receiver_name, o.issued_by, "
            "o.plate_size, o.number_of_plates, o.remarks, "
            "o.created_by, COALESCE(u.full_name, u.username) "
            "FROM MicroPlateOutward o LEFT JOIN users u ON u.id = o.created_by WHERE o.id = %s",
            (outward_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Outward entry not found")
        return {
            "id": row[0],
            "outward_date": row[1],
            "outward_time": row[2],
            "receiver_name": row[3],
            "issued_by": row[4],
            "plate_size": row[5],
            "number_of_plates": row[6],
            "remarks": row[7],
            "created_by_id": row[8],
            "created_by_name": row[9],
        }
    finally:
        conn.close()


@micro_plates_outward_router.get("/stock")
def get_plates_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            pi.plate_size,
            COALESCE(SUM(pi.number_of_plates), 0)
            - COALESCE((
                SELECT SUM(po.number_of_plates)
                FROM MicroPlateOutward po
                WHERE po.plate_size = pi.plate_size
            ), 0) AS available
        FROM MicroPlateItem pi
        GROUP BY pi.plate_size
        ORDER BY pi.plate_size
        """
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"plate_size": r[0], "available": int(r[1])} for r in rows]


@micro_plates_outward_router.get("")
def list_plate_outwards(
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
            "(o.receiver_name ILIKE %s OR o.issued_by ILIKE %s OR o.plate_size ILIKE %s "
            "OR o.remarks ILIKE %s OR TO_CHAR(o.outward_date, 'YYYY-MM-DD') ILIKE %s "
            "OR o.number_of_plates::text ILIKE %s)"
        )
        params.extend([like] * 6)

    if date_from:
        where.append("o.outward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("o.outward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT o.id, o.outward_date, o.outward_time, o.receiver_name, o.issued_by, "
        f"o.plate_size, o.number_of_plates, o.remarks "
        f"FROM MicroPlateOutward o WHERE {' AND '.join(where)} "
        f"ORDER BY o.outward_date DESC, o.outward_time DESC, o.id DESC",
        params,
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "outward_date": r[1], "outward_time": r[2],
            "receiver_name": r[3], "issued_by": r[4],
            "plate_size": r[5], "number_of_plates": r[6], "remarks": r[7],
        }
        for r in rows
    ]


@micro_plates_outward_router.get("/{outward_id}")
def get_plate_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_plate_outward_detail(outward_id)


@micro_plates_outward_router.post("", status_code=status.HTTP_201_CREATED)
def create_plate_outward(body: PlatesOutwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    # Validate stock
    cursor.execute(
        """
        SELECT
            COALESCE(SUM(pi.number_of_plates), 0)
            - COALESCE((
                SELECT SUM(po.number_of_plates)
                FROM MicroPlateOutward po
                WHERE po.plate_size = %s
            ), 0) AS available
        FROM MicroPlateItem pi
        WHERE pi.plate_size = %s
        """,
        (body.plate_size, body.plate_size),
    )
    row = cursor.fetchone()
    available = int(row[0]) if row and row[0] is not None else 0

    if body.number_of_plates > available:
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for plate size '{body.plate_size}'. "
                   f"Available: {available}, Requested: {body.number_of_plates}",
        )

    try:
        cursor.execute(
            "INSERT INTO MicroPlateOutward "
            "(outward_date, outward_time, receiver_name, issued_by, plate_size, number_of_plates, remarks, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (
                body.outward_date, body.outward_time,
                body.receiver_name.strip() if body.receiver_name else None,
                body.issued_by.strip() if body.issued_by else None,
                body.plate_size.strip(),
                body.number_of_plates,
                body.remarks.strip() if body.remarks else None,
                current_user["id"],
            ),
        )
        outward_id = cursor.fetchone()[0]
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_plate_outward_detail(outward_id)


@micro_plates_outward_router.put("/{outward_id}")
def update_plate_outward(outward_id: int, body: PlatesOutwardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT outward_date, outward_time, created_by FROM MicroPlateOutward WHERE id = %s", (outward_id,)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    check_edit_authorization(str(row[0]), row[1], row[2], current_user)

    try:
        cursor.execute(
            "UPDATE MicroPlateOutward SET outward_date=%s, outward_time=%s, receiver_name=%s, "
            "issued_by=%s, plate_size=%s, number_of_plates=%s, remarks=%s WHERE id=%s",
            (
                body.outward_date, body.outward_time,
                body.receiver_name.strip() if body.receiver_name else None,
                body.issued_by.strip() if body.issued_by else None,
                body.plate_size.strip(),
                body.number_of_plates,
                body.remarks.strip() if body.remarks else None,
                outward_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_plate_outward_detail(outward_id)


@micro_plates_outward_router.delete("/{outward_id}")
def delete_plate_outward(outward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM MicroPlateOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    try:
        cursor.execute("DELETE FROM MicroPlateOutward WHERE id = %s", (outward_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return {"detail": "Deleted successfully"}


# ─── Chemicals Outward Router (FIFO, mirrors generic_outward_routes) ──────────

micro_chemicals_outward_router = APIRouter(prefix="/api/micro-chemicals-outward", tags=["micro-chemicals-outward"])

_CHEM_INWARD_ITEMS = "MicroChemicalItem"
_CHEM_ITEM_NAME_COL = "chemical_name"
_CHEM_QTY_GROUPS = "MicroChemicalQuantityGroups"
_CHEM_OUTWARD = "MicroChemicalOutward"
_CHEM_OUTWARD_ITEMS = "MicroChemicalOutwardItem"
_CHEM_ADJ = "MicroChemicalAdjustment"


def _micro_chem_available(cursor, item_name: str, unit: str) -> float:
    cursor.execute(
        f"""
        SELECT
            COALESCE((
                SELECT SUM(qg.group_quantity)
                FROM {_CHEM_INWARD_ITEMS} i
                JOIN {_CHEM_QTY_GROUPS} qg ON qg.item_id = i.id
                WHERE i.{_CHEM_ITEM_NAME_COL} = %s AND qg.unit = %s
            ), 0)
            + COALESCE((
                SELECT SUM(quantity) FROM {_CHEM_ADJ} WHERE item_name = %s AND unit = %s
            ), 0)
            - COALESCE((
                SELECT SUM(quantity_issued) FROM {_CHEM_OUTWARD_ITEMS} WHERE item_name = %s AND unit = %s
            ), 0)
        """,
        (item_name, unit, item_name, unit, item_name, unit),
    )
    row = cursor.fetchone()
    return float(row[0]) if row else 0.0


def _fetch_micro_chem_outward_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"SELECT o.id, o.outward_date, o.outward_time, o.issued_by, o.received_by, o.remarks, "
            f"o.created_by, COALESCE(u.full_name, u.username) "
            f"FROM {_CHEM_OUTWARD} o LEFT JOIN users u ON o.created_by = u.id WHERE o.id = %s",
            (outward_id,),
        )
        h = cursor.fetchone()
        if not h:
            raise HTTPException(status_code=404, detail="Entry not found")

        cursor.execute(
            f"SELECT id, item_name, quantity_issued, unit "
            f"FROM {_CHEM_OUTWARD_ITEMS} WHERE outward_id = %s ORDER BY id",
            (outward_id,),
        )
        items = [
            {"id": r[0], "item_name": r[1], "quantity_issued": float(r[2]), "unit": r[3]}
            for r in cursor.fetchall()
        ]

        cursor.execute(
            f"SELECT id, item_name, quantity, unit, reason "
            f"FROM {_CHEM_ADJ} WHERE outward_id = %s ORDER BY id",
            (outward_id,),
        )
        adjustments = [
            {"id": r[0], "item_name": r[1], "quantity": float(r[2]), "unit": r[3], "reason": r[4]}
            for r in cursor.fetchall()
        ]

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
    finally:
        conn.close()


@micro_chemicals_outward_router.get("/stock-containers")
def get_micro_chem_stock_containers(
    item_name: str = Query(...),
    unit: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"""
        SELECT qg.number_of_packs, qg.quantity_per_pack, qg.group_quantity
        FROM {_CHEM_INWARD_ITEMS} i
        JOIN {_CHEM_QTY_GROUPS} qg ON qg.item_id = i.id
        WHERE i.{_CHEM_ITEM_NAME_COL} = %s AND qg.unit = %s
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


@micro_chemicals_outward_router.get("/stock")
def get_micro_chem_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"""
        SELECT
            i.{_CHEM_ITEM_NAME_COL} AS item_name,
            qg.unit,
            COALESCE(SUM(qg.group_quantity), 0)
            + COALESCE((SELECT SUM(adj.quantity) FROM {_CHEM_ADJ} adj
                        WHERE adj.item_name = i.{_CHEM_ITEM_NAME_COL} AND adj.unit = qg.unit), 0)
            - COALESCE((SELECT SUM(oi.quantity_issued) FROM {_CHEM_OUTWARD_ITEMS} oi
                        WHERE oi.item_name = i.{_CHEM_ITEM_NAME_COL} AND oi.unit = qg.unit), 0)
            AS available_qty
        FROM {_CHEM_INWARD_ITEMS} i
        JOIN {_CHEM_QTY_GROUPS} qg ON qg.item_id = i.id
        GROUP BY i.{_CHEM_ITEM_NAME_COL}, qg.unit
        ORDER BY i.{_CHEM_ITEM_NAME_COL}, qg.unit
        """
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"item_name": r[0], "unit": r[1], "available_qty": round(float(r[2]), 3)}
        for r in rows
    ]


@micro_chemicals_outward_router.get("/export")
def export_micro_chem_outward(
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
        f"SELECT id FROM {_CHEM_OUTWARD} WHERE {' AND '.join(where)} ORDER BY outward_date, outward_time, id",
        params,
    )
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_micro_chem_outward_detail(eid) for eid in ids]


@micro_chemicals_outward_router.get("")
def list_micro_chem_outward(
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
            f"OR EXISTS (SELECT 1 FROM {_CHEM_OUTWARD_ITEMS} oi WHERE oi.outward_id = o.id "
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
        f"FROM {_CHEM_OUTWARD} o WHERE {' AND '.join(where)} "
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
        f"FROM {_CHEM_OUTWARD_ITEMS} WHERE outward_id IN ({ph}) ORDER BY outward_id, id",
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


@micro_chemicals_outward_router.get("/{outward_id}")
def get_micro_chem_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_micro_chem_outward_detail(outward_id)


@micro_chemicals_outward_router.post("", status_code=status.HTTP_201_CREATED)
def create_micro_chem_outward(body: ChemicalsOutwardCreate, current_user: dict = Depends(get_current_user)):
    if not body.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    conn = get_connection()
    cursor = conn.cursor()

    if not body.force_adjustment:
        shortages = []
        for item in body.items:
            avail = _micro_chem_available(cursor, item.item_name, item.unit)
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
            f"INSERT INTO {_CHEM_OUTWARD} "
            f"(outward_date, outward_time, issued_by, received_by, remarks, created_by) "
            f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
            (
                body.outward_date, body.outward_time,
                body.issued_by.strip() if body.issued_by else None,
                body.received_by.strip() if body.received_by else None,
                body.remarks.strip() if body.remarks else None,
                current_user["id"],
            ),
        )
        outward_id = cursor.fetchone()[0]

        for item in body.items:
            avail = _micro_chem_available(cursor, item.item_name, item.unit)
            if item.quantity_issued > avail:
                shortage = round(item.quantity_issued - avail, 3)
                cursor.execute(
                    f"INSERT INTO {_CHEM_ADJ} (outward_id, item_name, quantity, unit, reason) "
                    f"VALUES (%s, %s, %s, %s, %s)",
                    (outward_id, item.item_name, shortage, item.unit,
                     f"Auto-created due to outward stock shortage (Outward #{outward_id})"),
                )

            cursor.execute(
                f"INSERT INTO {_CHEM_OUTWARD_ITEMS} (outward_id, item_name, quantity_issued, unit) "
                f"VALUES (%s, %s, %s, %s)",
                (outward_id, item.item_name, round(item.quantity_issued, 3), item.unit),
            )

        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise

    conn.close()
    return _fetch_micro_chem_outward_detail(outward_id)


@micro_chemicals_outward_router.put("/{outward_id}")
def update_micro_chem_outward(
    outward_id: int,
    body: ChemicalsOutwardUpdate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        f"SELECT outward_date, outward_time, created_by FROM {_CHEM_OUTWARD} WHERE id = %s", (outward_id,)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"UPDATE {_CHEM_OUTWARD} SET outward_date=%s, outward_time=%s, issued_by=%s, received_by=%s, remarks=%s "
            f"WHERE id=%s",
            (
                body.outward_date, body.outward_time,
                body.issued_by.strip() if body.issued_by else None,
                body.received_by.strip() if body.received_by else None,
                body.remarks.strip() if body.remarks else None,
                outward_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_micro_chem_outward_detail(outward_id)


@micro_chemicals_outward_router.delete("/{outward_id}")
def delete_micro_chem_outward(outward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(f"SELECT id FROM {_CHEM_OUTWARD} WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Entry not found")
    try:
        cursor.execute(f"DELETE FROM {_CHEM_OUTWARD} WHERE id = %s", (outward_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return {"detail": "Deleted successfully"}


# ─── Films Outward Router ─────────────────────────────────────────────────────

micro_films_outward_router = APIRouter(prefix="/api/micro-films-outward", tags=["micro-films-outward"])


def _fetch_film_outward_detail(outward_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT o.id, o.outward_date, o.outward_time, o.receiver_name, o.issued_by, "
            "o.job_name, o.film_length, o.film_width, o.film_type, o.quantity, o.remarks, "
            "o.created_by, COALESCE(u.full_name, u.username) "
            "FROM MicroFilmOutward o LEFT JOIN users u ON u.id = o.created_by WHERE o.id = %s",
            (outward_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Outward entry not found")
        return {
            "id": row[0],
            "outward_date": row[1],
            "outward_time": row[2],
            "receiver_name": row[3],
            "issued_by": row[4],
            "job_name": row[5],
            "film_length": float(row[6]) if row[6] is not None else None,
            "film_width": float(row[7]) if row[7] is not None else None,
            "film_type": row[8],
            "quantity": row[9],
            "remarks": row[10],
            "created_by_id": row[11],
            "created_by_name": row[12],
        }
    finally:
        conn.close()


@micro_films_outward_router.get("/stock")
def get_films_stock(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            fi.film_length,
            fi.film_width,
            fi.film_type,
            COALESCE(SUM(fi.quantity), 0)
            - COALESCE((
                SELECT SUM(fo.quantity)
                FROM MicroFilmOutward fo
                WHERE (fo.film_length IS NOT DISTINCT FROM fi.film_length)
                  AND (fo.film_width IS NOT DISTINCT FROM fi.film_width)
                  AND fo.film_type = fi.film_type
            ), 0) AS available
        FROM MicroFilmItem fi
        GROUP BY fi.film_length, fi.film_width, fi.film_type
        ORDER BY fi.film_length, fi.film_width, fi.film_type
        """
    )
    rows = cursor.fetchall()
    conn.close()
    return [{"film_length": r[0], "film_width": r[1], "film_type": r[2], "available": int(r[3])} for r in rows]


@micro_films_outward_router.get("")
def list_film_outwards(
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
            "(o.receiver_name ILIKE %s OR o.issued_by ILIKE %s OR o.job_name ILIKE %s "
            "OR o.film_type ILIKE %s OR o.remarks ILIKE %s "
            "OR TO_CHAR(o.outward_date, 'YYYY-MM-DD') ILIKE %s)"
        )
        params.extend([like] * 6)

    if date_from:
        where.append("o.outward_date >= %s")
        params.append(date_from)
    if date_to:
        where.append("o.outward_date <= %s")
        params.append(date_to)

    cursor.execute(
        f"SELECT o.id, o.outward_date, o.outward_time, o.receiver_name, o.issued_by, "
        f"o.job_name, o.film_length, o.film_width, o.film_type, o.quantity, o.remarks "
        f"FROM MicroFilmOutward o WHERE {' AND '.join(where)} "
        f"ORDER BY o.outward_date DESC, o.outward_time DESC, o.id DESC",
        params,
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "outward_date": r[1], "outward_time": r[2],
            "receiver_name": r[3], "issued_by": r[4],
            "job_name": r[5],
            "film_length": float(r[6]) if r[6] is not None else None,
            "film_width": float(r[7]) if r[7] is not None else None,
            "film_type": r[8], "quantity": r[9], "remarks": r[10],
        }
        for r in rows
    ]


@micro_films_outward_router.get("/{outward_id}")
def get_film_outward(outward_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_film_outward_detail(outward_id)


@micro_films_outward_router.post("", status_code=status.HTTP_201_CREATED)
def create_film_outward(body: FilmsOutwardCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    # Validate stock if film dimensions and film_type are provided
    if body.film_type and body.quantity:
        cursor.execute(
            """
            SELECT
                COALESCE(SUM(fi.quantity), 0)
                - COALESCE((
                    SELECT SUM(fo.quantity)
                    FROM MicroFilmOutward fo
                    WHERE (fo.film_length IS NOT DISTINCT FROM %s)
                      AND (fo.film_width IS NOT DISTINCT FROM %s)
                      AND fo.film_type = %s
                ), 0) AS available
            FROM MicroFilmItem fi
            WHERE (fi.film_length IS NOT DISTINCT FROM %s)
              AND (fi.film_width IS NOT DISTINCT FROM %s)
              AND fi.film_type = %s
            """,
            (body.film_length, body.film_width, body.film_type,
             body.film_length, body.film_width, body.film_type),
        )
        row = cursor.fetchone()
        available = int(row[0]) if row and row[0] is not None else 0

        if body.quantity > available:
            conn.close()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock for film type '{body.film_type}'. "
                       f"Available: {available}, Requested: {body.quantity}",
            )

    try:
        cursor.execute(
            "INSERT INTO MicroFilmOutward "
            "(outward_date, outward_time, receiver_name, issued_by, job_name, film_length, film_width, film_type, quantity, remarks, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (
                body.outward_date, body.outward_time,
                body.receiver_name.strip() if body.receiver_name else None,
                body.issued_by.strip() if body.issued_by else None,
                body.job_name.strip(),
                body.film_length,
                body.film_width,
                body.film_type.strip() if body.film_type else None,
                body.quantity,
                body.remarks.strip() if body.remarks else None,
                current_user["id"],
            ),
        )
        outward_id = cursor.fetchone()[0]
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_film_outward_detail(outward_id)


@micro_films_outward_router.put("/{outward_id}")
def update_film_outward(outward_id: int, body: FilmsOutwardUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT outward_date, outward_time, created_by FROM MicroFilmOutward WHERE id = %s", (outward_id,)
    )
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    check_edit_authorization(str(row[0]), row[1], row[2], current_user)

    try:
        cursor.execute(
            "UPDATE MicroFilmOutward SET outward_date=%s, outward_time=%s, receiver_name=%s, "
            "issued_by=%s, job_name=%s, film_length=%s, film_width=%s, film_type=%s, quantity=%s, remarks=%s WHERE id=%s",
            (
                body.outward_date, body.outward_time,
                body.receiver_name.strip() if body.receiver_name else None,
                body.issued_by.strip() if body.issued_by else None,
                body.job_name.strip(),
                body.film_length,
                body.film_width,
                body.film_type.strip() if body.film_type else None,
                body.quantity,
                body.remarks.strip() if body.remarks else None,
                outward_id,
            ),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_film_outward_detail(outward_id)


@micro_films_outward_router.delete("/{outward_id}")
def delete_film_outward(outward_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM MicroFilmOutward WHERE id = %s", (outward_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Outward entry not found")
    try:
        cursor.execute("DELETE FROM MicroFilmOutward WHERE id = %s", (outward_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return {"detail": "Deleted successfully"}
