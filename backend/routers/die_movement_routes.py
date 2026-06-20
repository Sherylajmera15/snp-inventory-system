from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from auth import get_current_user, require_admin, verify_password, check_edit_authorization
from database import get_connection

router = APIRouter(prefix="/api/die-movement", tags=["die-movement"])

ISSUED_TO_OPTIONS = ["Die Cutting Department", "Production", "Store", "Other"]
LOCATION_OPTIONS = ["Rack A", "Rack B", "Rack C", "Production Floor", "Die Cutting Department", "Store", "Other"]


class DieMovementCreate(BaseModel):
    movement_date: str
    movement_time: Optional[str] = None
    die_item_id: int
    issued_to: str
    current_location: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class DieMovementUpdate(BaseModel):
    movement_date: str
    movement_time: Optional[str] = None
    issued_to: Optional[str] = None
    current_location: Optional[str] = None
    issued_by: Optional[str] = None
    received_by: Optional[str] = None
    remarks: Optional[str] = None


class DeleteRequest(BaseModel):
    password: str


def _fetch_detail(movement_id: int) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT dm.id, dm.movement_date, dm.movement_time,
               dm.die_item_id, di.die_number, di.job_name, di.ups, di.embossing, di.rubberized,
               dm.issued_to, dm.current_location, dm.issued_by, dm.received_by, dm.remarks,
               dm.created_by, u.username
        FROM DieMovements dm
        JOIN DieItems di ON di.id = dm.die_item_id
        LEFT JOIN Users u ON dm.created_by = u.id
        WHERE dm.id = %s
    """, (movement_id,))
    r = cursor.fetchone()
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Movement not found")
    conn.close()
    return {
        "id": r[0], "movement_date": r[1], "movement_time": r[2],
        "die_item_id": r[3], "die_number": r[4], "job_name": r[5],
        "ups": r[6], "embossing": r[7], "rubberized": r[8],
        "issued_to": r[9], "current_location": r[10],
        "issued_by": r[11], "received_by": r[12], "remarks": r[13],
        "created_by_id": r[14], "created_by_name": r[15],
    }


@router.get("/active-dies")
def get_active_dies(
    q: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["di.status = 'Active'"]
    params: list = []
    if q and q.strip():
        like = f"%{q.strip()}%"
        where.append("(di.die_number ILIKE %s OR di.job_name ILIKE %s)")
        params.extend([like, like])

    cursor.execute(
        f"SELECT di.id, di.die_number, di.job_name, di.ups, di.embossing, di.rubberized, di.storage_location "
        f"FROM DieItems di WHERE {' AND '.join(where)} ORDER BY di.die_number LIMIT 50",
        params,
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"id": r[0], "die_number": r[1], "job_name": r[2], "ups": r[3],
         "embossing": r[4], "rubberized": r[5], "storage_location": r[6]}
        for r in rows
    ]


@router.get("/analytics")
def get_analytics(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM DieMovements WHERE movement_date::date = CURRENT_DATE")
    today_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM DieMovements WHERE DATE_TRUNC('month', movement_date) = DATE_TRUNC('month', CURRENT_DATE)")
    month_count = cursor.fetchone()[0]

    cursor.execute("""
        SELECT di.die_number, di.job_name, COUNT(*) as cnt
        FROM DieMovements dm
        JOIN DieItems di ON di.id = dm.die_item_id
        GROUP BY dm.die_item_id, di.die_number, di.job_name
        ORDER BY cnt DESC LIMIT 10
    """)
    top_moved = [{"die_number": r[0], "job_name": r[1], "movement_count": r[2]} for r in cursor.fetchall()]

    cursor.execute("""
        SELECT current_location, COUNT(*) as die_count
        FROM (
            SELECT die_item_id, current_location,
                   ROW_NUMBER() OVER (PARTITION BY die_item_id ORDER BY movement_date DESC, movement_time DESC, id DESC) as rn
            FROM DieMovements
            WHERE current_location IS NOT NULL AND current_location <> ''
        ) t
        WHERE rn = 1
        GROUP BY current_location
        ORDER BY die_count DESC
    """)
    location_summary = [{"location": r[0], "die_count": r[1]} for r in cursor.fetchall()]

    conn.close()
    return {
        "today_movements": today_count,
        "month_movements": month_count,
        "top_moved_dies": top_moved,
        "location_summary": location_summary,
    }


@router.get("/export")
def export_movements(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()
    where = ["1=1"]
    params: list = []
    if date_from:
        where.append("dm.movement_date >= %s"); params.append(date_from)
    if date_to:
        where.append("dm.movement_date <= %s"); params.append(date_to)
    cursor.execute(f"SELECT dm.id FROM DieMovements dm WHERE {' AND '.join(where)} ORDER BY dm.movement_date, dm.movement_time, dm.id", params)
    ids = [r[0] for r in cursor.fetchall()]
    conn.close()
    return [_fetch_detail(mid) for mid in ids]


@router.get("")
def list_movements(
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
            "(di.die_number ILIKE %s OR di.job_name ILIKE %s OR dm.issued_to ILIKE %s "
            "OR dm.current_location ILIKE %s OR dm.issued_by ILIKE %s OR dm.received_by ILIKE %s "
            "OR dm.remarks ILIKE %s OR TO_CHAR(dm.movement_date, 'YYYY-MM-DD') ILIKE %s "
            "OR TO_CHAR(dm.movement_time, 'HH24:MI:SS') ILIKE %s)"
        )
        params.extend([like] * 9)
    if date_from:
        where.append("dm.movement_date >= %s"); params.append(date_from)
    if date_to:
        where.append("dm.movement_date <= %s"); params.append(date_to)

    cursor.execute(
        f"SELECT dm.id, dm.movement_date, dm.movement_time, di.die_number, di.job_name, "
        f"dm.issued_to, dm.current_location, dm.issued_by, dm.received_by, dm.remarks "
        f"FROM DieMovements dm JOIN DieItems di ON di.id = dm.die_item_id "
        f"WHERE {' AND '.join(where)} ORDER BY dm.movement_date DESC, dm.movement_time DESC, dm.id DESC",
        params,
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"id": r[0], "movement_date": r[1], "movement_time": r[2], "die_number": r[3],
         "job_name": r[4], "issued_to": r[5], "current_location": r[6],
         "issued_by": r[7], "received_by": r[8], "remarks": r[9]}
        for r in rows
    ]


@router.get("/{movement_id}")
def get_movement(movement_id: int, current_user: dict = Depends(get_current_user)):
    return _fetch_detail(movement_id)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_movement(body: DieMovementCreate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM DieItems WHERE id = %s AND status = 'Active'", (body.die_item_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Die not found or not active")
    try:
        cursor.execute(
            "INSERT INTO DieMovements (movement_date, movement_time, die_item_id, issued_to, current_location, issued_by, received_by, remarks, created_by) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (body.movement_date, body.movement_time or None, body.die_item_id,
             body.issued_to.strip(),
             body.current_location.strip() if body.current_location else None,
             body.issued_by.strip() if body.issued_by else None,
             body.received_by.strip() if body.received_by else None,
             body.remarks.strip() if body.remarks else None,
             current_user["id"]),
        )
        movement_id = cursor.fetchone()[0]
        conn.commit()
    except Exception:
        conn.rollback()
        conn.close()
        raise
    conn.close()
    return _fetch_detail(movement_id)


@router.put("/{movement_id}")
def update_movement(movement_id: int, body: DieMovementUpdate, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT movement_date, movement_time, created_by FROM DieMovements WHERE id = %s", (movement_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Movement not found")
    conn.close()

    check_edit_authorization(str(row[0])[:10], row[1], row[2], current_user)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE DieMovements SET movement_date=%s, movement_time=%s, issued_to=%s, current_location=%s, "
        "issued_by=%s, received_by=%s, remarks=%s WHERE id=%s",
        (body.movement_date, body.movement_time or None,
         body.issued_to.strip() if body.issued_to else None,
         body.current_location.strip() if body.current_location else None,
         body.issued_by.strip() if body.issued_by else None,
         body.received_by.strip() if body.received_by else None,
         body.remarks.strip() if body.remarks else None,
         movement_id),
    )
    conn.commit()
    conn.close()
    return _fetch_detail(movement_id)


@router.delete("/{movement_id}")
def delete_movement(movement_id: int, body: DeleteRequest, current_user: dict = Depends(require_admin)):
    if not verify_password(body.password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect password")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM DieMovements WHERE id = %s", (movement_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Movement not found")
    cursor.execute("DELETE FROM DieMovements WHERE id = %s", (movement_id,))
    conn.commit()
    conn.close()
    return {"detail": "Deleted successfully"}
