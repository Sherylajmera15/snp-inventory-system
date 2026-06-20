import os
from datetime import datetime, timedelta

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from database import get_connection

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, role, password_hash, status FROM Users WHERE id = %s",
        (int(user_id),),
    )
    row = cursor.fetchone()
    conn.close()

    if row is None:
        raise credentials_exception

    if row[4] != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is not active. Contact an administrator.",
        )

    return {"id": row[0], "username": row[1], "role": row[2], "password_hash": row[3]}


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def check_edit_authorization(
    entry_date: str,
    entry_time_str,
    entry_created_by_id,
    current_user: dict,
) -> None:
    """
    Admins can edit any entry at any time.
    Operators can only edit their own entries within 24 hours of creation.
    Raises HTTP 403 otherwise.
    """
    if current_user["role"] == "admin":
        return

    # Operator: ownership check
    if entry_created_by_id is None or int(entry_created_by_id) != int(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit entries you created.",
        )

    # Operator: 24-hour window check
    try:
        t_str = (str(entry_time_str) if entry_time_str else "00:00")[:5]
        entry_dt = datetime.strptime(f"{str(entry_date)[:10]} {t_str}", "%Y-%m-%d %H:%M")
    except Exception:
        entry_dt = datetime.strptime(str(entry_date)[:10], "%Y-%m-%d")

    if (datetime.now() - entry_dt).total_seconds() >= 86400:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The 24-hour edit window has expired.",
        )
