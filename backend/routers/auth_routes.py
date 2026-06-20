from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from auth import create_access_token, verify_password, hash_password
from database import get_connection

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_ADMINS = 2


# ─── Request / Response models ────────────────────────────────────────────────

class SetupRequest(BaseModel):
    full_name: str
    username: str
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    mobile_number: str
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/system-status")
def system_status():
    """Returns whether first-time admin setup is still needed."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM Users WHERE role = 'admin' AND status = 'active'")
    admin_count = cursor.fetchone()[0]
    conn.close()
    return {"needs_setup": admin_count == 0, "admin_count": admin_count}


@router.post("/setup")
def first_time_setup(body: SetupRequest):
    """Create the first administrator account. Only works when no admins exist."""
    if not body.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name cannot be empty.")
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM Users WHERE role = 'admin' AND status = 'active'")
    if cursor.fetchone()[0] > 0:
        conn.close()
        raise HTTPException(status_code=400, detail="System is already set up. An administrator account exists.")

    cursor.execute("SELECT id FROM Users WHERE username = %s", (body.username.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already taken.")

    hashed = hash_password(body.password)
    cursor.execute(
        "INSERT INTO Users (full_name, username, password_hash, role, status) VALUES (%s, %s, %s, 'admin', 'active')",
        (body.full_name.strip(), body.username.strip(), hashed),
    )
    conn.commit()
    conn.close()
    return {"message": "Administrator account created successfully."}


@router.post("/register")
def register_operator(body: RegisterRequest):
    """Operator self-registration. Account is created with status='pending' until approved."""
    if not body.full_name.strip():
        raise HTTPException(status_code=400, detail="Full name cannot be empty.")
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    if not body.mobile_number.strip():
        raise HTTPException(status_code=400, detail="Mobile number cannot be empty.")
    if len(body.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM Users WHERE username = %s", (body.username.strip(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already taken. Please choose a different username.")

    hashed = hash_password(body.password)
    cursor.execute(
        "INSERT INTO Users (full_name, mobile_number, username, password_hash, role, status) VALUES (%s, %s, %s, %s, 'operator', 'pending')",
        (body.full_name.strip(), body.mobile_number.strip(), body.username.strip(), hashed),
    )
    conn.commit()
    conn.close()
    return {"message": "Account request submitted. An administrator will review your request."}


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, password_hash, role, status FROM Users WHERE username = %s",
        (body.username,),
    )
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(body.password, row[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
        )

    user_status = row[4]
    if user_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending administrator approval.",
        )
    if user_status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account request was not approved. Contact an administrator.",
        )
    if user_status == "disabled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Contact an administrator.",
        )
    if user_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Contact an administrator.",
        )

    token = create_access_token({"sub": str(row[0])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": row[0],
        "username": row[1],
        "role": row[3],
    }
