from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import get_current_user, require_admin, hash_password
from database import get_connection

router = APIRouter(prefix="/api/admin/users", tags=["user-management"])

MAX_ADMINS = 2


# ─── Models ───────────────────────────────────────────────────────────────────

class CreateAdminRequest(BaseModel):
    full_name: str
    username: str
    password: str


class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None   # True = enable, False = disable
    new_password: Optional[str] = None


# ─── List & manage pending registrations ──────────────────────────────────────

@router.get("/pending")
def list_pending(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, full_name, username, mobile_number, created_at "
        "FROM Users WHERE status = 'pending' AND role = 'operator' ORDER BY created_at"
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "full_name": r[1] or r[2],
            "username": r[2],
            "mobile_number": r[3],
            "created_at": str(r[4]) if r[4] else None,
        }
        for r in rows
    ]


@router.post("/{user_id}/approve")
def approve_user(user_id: int, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM Users WHERE id = %s AND status = 'pending'", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Pending user not found.")

    cursor.execute("UPDATE Users SET status = 'active' WHERE id = %s", (user_id,))
    try:
        cursor.execute(
            "INSERT INTO ActivityLog (username, module, action, entry_id, details) VALUES (%s, %s, %s, %s, %s)",
            (current_user["username"], "User Management", "approved", user_id, f"Approved operator: {row[1]}"),
        )
    except Exception:
        pass
    conn.commit()
    conn.close()
    return {"message": f"User '{row[1]}' approved successfully."}


@router.post("/{user_id}/reject")
def reject_user(user_id: int, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM Users WHERE id = %s AND status = 'pending'", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Pending user not found.")

    cursor.execute("UPDATE Users SET status = 'rejected' WHERE id = %s", (user_id,))
    try:
        cursor.execute(
            "INSERT INTO ActivityLog (username, module, action, entry_id, details) VALUES (%s, %s, %s, %s, %s)",
            (current_user["username"], "User Management", "rejected", user_id, f"Rejected operator: {row[1]}"),
        )
    except Exception:
        pass
    conn.commit()
    conn.close()
    return {"message": f"User '{row[1]}' rejected."}


# ─── List active/disabled/rejected users ──────────────────────────────────────

@router.get("")
def list_users(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, COALESCE(full_name, username), username, role, status, created_at "
        "FROM Users WHERE status != 'pending' ORDER BY role DESC, username"
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "full_name": r[1],
            "username": r[2],
            "role": r[3],
            "status": r[4],
            "is_active": r[4] == "active",
            "created_at": str(r[5]) if r[5] else None,
        }
        for r in rows
    ]


# ─── Create second admin (admin-only) ────────────────────────────────────────

@router.post("")
def create_second_admin(body: CreateAdminRequest, current_user: dict = Depends(require_admin)):
    if not body.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name cannot be empty.")
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM Users WHERE role = 'admin'")
    if cursor.fetchone()[0] >= MAX_ADMINS:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Maximum of {MAX_ADMINS} administrator accounts allowed.",
        )

    cursor.execute("SELECT id FROM Users WHERE username = %s", (body.username.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already exists.")

    hashed = hash_password(body.password)
    cursor.execute(
        "INSERT INTO Users (full_name, username, password_hash, role, status) VALUES (%s, %s, %s, 'admin', 'active') RETURNING id",
        (body.full_name.strip(), body.username.strip(), hashed),
    )
    new_id = cursor.fetchone()[0]
    conn.commit()
    conn.close()

    return {"id": new_id, "username": body.username.strip(), "role": "admin", "status": "active"}


# ─── Enable / Disable / Reset password ───────────────────────────────────────

@router.put("/{user_id}")
def update_user(user_id: int, body: UpdateUserRequest, current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, status FROM Users WHERE id = %s", (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found.")

    if body.is_active is False and user_id == current_user["id"]:
        conn.close()
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")

    if body.is_active is not None:
        new_status = "active" if body.is_active else "disabled"
        cursor.execute("UPDATE Users SET status = %s WHERE id = %s", (new_status, user_id))

    if body.new_password:
        if len(body.new_password) < 4:
            conn.close()
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")
        hashed = hash_password(body.new_password)
        cursor.execute("UPDATE Users SET password_hash = %s WHERE id = %s", (hashed, user_id))

    conn.commit()
    cursor.execute("SELECT id, COALESCE(full_name, username), username, role, status FROM Users WHERE id = %s", (user_id,))
    updated = cursor.fetchone()
    conn.close()

    return {
        "id": updated[0],
        "full_name": updated[1],
        "username": updated[2],
        "role": updated[3],
        "status": updated[4],
        "is_active": updated[4] == "active",
    }


# ─── Admin count ──────────────────────────────────────────────────────────────

@router.get("/admin-count")
def get_admin_count(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM Users WHERE role = 'admin'")
    count = cursor.fetchone()[0]
    conn.close()
    return {"count": count, "max": MAX_ADMINS}
