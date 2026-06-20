from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import get_current_user, require_admin, verify_password
import bcrypt
from database import get_connection

router = APIRouter(prefix="/api/admin/settings", tags=["admin-settings"])


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _get_setting(cursor, key: str) -> Optional[str]:
    cursor.execute("SELECT setting_value FROM AppSettings WHERE setting_key = %s", (key,))
    row = cursor.fetchone()
    return row[0] if row else None


class EditPasswordUpdate(BaseModel):
    new_password: str
    admin_password: str  # current admin login password to authorise the change


class VerifyEditPasswordRequest(BaseModel):
    password: str


class EditAgeCheckRequest(BaseModel):
    entry_date: str          # "YYYY-MM-DD"
    entry_time: Optional[str] = None  # "HH:MM" or "HH:MM:SS"
    edit_password: Optional[str] = None


@router.get("")
def get_settings(current_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    edit_pw = _get_setting(cursor, "edit_protection_password")
    conn.close()
    return {
        "edit_protection_password_set": bool(edit_pw),
    }


@router.put("/edit-password")
def set_edit_password(body: EditPasswordUpdate, current_user: dict = Depends(require_admin)):
    if not verify_password(body.admin_password, current_user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Incorrect admin password")
    if not body.new_password.strip():
        raise HTTPException(status_code=400, detail="Password cannot be empty")

    hashed = _hash(body.new_password)
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO AppSettings (setting_key, setting_value, updated_by, updated_at)
        VALUES ('edit_protection_password', %s, %s, NOW())
        ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
    """, (hashed, current_user["id"]))
    conn.commit()
    conn.close()
    return {"detail": "Edit protection password updated"}


@router.post("/verify-edit-password")
def verify_edit_password(body: VerifyEditPasswordRequest, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    stored = _get_setting(cursor, "edit_protection_password")
    conn.close()
    if not stored:
        return {"valid": True, "reason": "no_password_set"}
    if verify_password(body.password, stored):
        return {"valid": True}
    return {"valid": False}


@router.post("/check-edit-age")
def check_edit_age(body: EditAgeCheckRequest, current_user: dict = Depends(get_current_user)):
    """
    Returns whether the entry requires password protection for editing.
    If requires_password=True and edit_password is provided, also verifies it.
    """
    try:
        time_str = body.entry_time or "00:00:00"
        if len(time_str) == 5:
            time_str += ":00"
        entry_dt = datetime.strptime(f"{body.entry_date} {time_str}", "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date/time format")

    age_hours = (datetime.now() - entry_dt).total_seconds() / 3600
    requires_password = age_hours >= 24

    if not requires_password:
        return {"requires_password": False, "age_hours": round(age_hours, 1)}

    if body.edit_password is not None:
        conn = get_connection()
        cursor = conn.cursor()
        stored = _get_setting(cursor, "edit_protection_password")
        conn.close()
        if not stored:
            return {"requires_password": True, "password_verified": True, "reason": "no_password_set"}
        if verify_password(body.edit_password, stored):
            return {"requires_password": True, "password_verified": True}
        return {"requires_password": True, "password_verified": False}

    return {"requires_password": True, "age_hours": round(age_hours, 1)}
