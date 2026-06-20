from database import get_connection
from auth import hash_password

conn = get_connection()
cur = conn.cursor()

cur.execute(
    "INSERT INTO Users (full_name, username, password_hash, role, status) VALUES (%s, %s, %s, 'admin', 'active')",
    ("Admin", "admin", hash_password("admin123")),
)
conn.commit()
conn.close()
print("Admin user created. Username: admin  Password: admin123")
