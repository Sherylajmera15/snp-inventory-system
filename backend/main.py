import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection, init_db
from routers.auth_routes import router as auth_router
from routers.paper_routes import router as paper_router
from routers.ctp_routes import router as ctp_router
from routers.ink_routes import router as ink_router
from routers.chemical_routes import router as chemical_router
from routers.adhesive_routes import router as adhesive_router
from routers.consumable_routes import router as consumable_router
from routers.packing_routes import router as packing_router
from routers.oil_routes import router as oil_router
from routers.dies_routes import router as dies_router
from routers.analytics_routes import router as analytics_router
from routers.paper_outward_routes import router as paper_outward_router
from routers.ctp_outward_routes import router as ctp_outward_router
from routers.ink_outward_routes import router as ink_outward_router
from routers.generic_outward_routes import (
    chemical_outward_router,
    adhesive_outward_router,
    consumable_outward_router,
)
from routers.packing_outward_routes import router as packing_outward_router
from routers.oil_outward_routes import router as oil_outward_router
from routers.die_movement_routes import router as die_movement_router
from routers.admin_settings_routes import router as admin_settings_router
from routers.user_management_routes import router as user_management_router
from routers.micro_routes import (
    micro_router,
    micro_plates_outward_router,
    micro_chemicals_outward_router,
    micro_films_outward_router,
)

app = FastAPI(title="SNP Inward API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://snp-inventory-system.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ─── Activity logging middleware ──────────────────────────────────────────────

_MODULE_PREFIXES = [
    ("/api/paper-outward", "Paper Outward"),
    ("/api/ctp-outward", "CTP Plates Outward"),
    ("/api/ink-outward", "Ink & Varnishes Outward"),
    ("/api/chemical-outward", "Chemicals Outward"),
    ("/api/adhesive-outward", "Adhesives Outward"),
    ("/api/consumable-outward", "Consumables Outward"),
    ("/api/packing-outward", "Packing Materials Outward"),
    ("/api/oil-outward", "Oil & Lubrication Outward"),
    ("/api/die-movement", "Die Movement"),
    ("/api/micro-plates-outward", "Micro Plates Outward"),
    ("/api/micro-chemicals-outward", "Micro Chemicals Outward"),
    ("/api/micro-films-outward", "Micro Films Outward"),
    ("/api/paper", "Paper"),
    ("/api/ctp", "CTP Plates"),
    ("/api/ink", "Ink & Varnishes"),
    ("/api/chemicals", "Chemicals"),
    ("/api/adhesives", "Adhesives"),
    ("/api/consumables", "Consumables"),
    ("/api/packing", "Packing Materials"),
    ("/api/oil", "Oil & Lubrication"),
    ("/api/dies", "Dies"),
    ("/api/micro", "Micro Plates Films & Chemicals"),
]

_SKIP_SUFFIXES = ("/export", "/suggestions", "/items")


@app.middleware("http")
async def activity_logger(request: Request, call_next):
    response = await call_next(request)

    method = request.method
    path = request.url.path

    if method in ("POST", "PUT", "DELETE") and 200 <= response.status_code < 300:
        if path.startswith("/api/analytics") or path.startswith("/api/auth") or path.startswith("/api/admin"):
            return response
        if any(path.endswith(s) for s in _SKIP_SUFFIXES):
            return response

        module_name = None
        for prefix, name in _MODULE_PREFIXES:
            if path.startswith(prefix):
                module_name = name
                break

        if module_name:
            action = {"POST": "created", "PUT": "edited", "DELETE": "deleted"}[method]
            entry_id = None
            if method != "POST":
                try:
                    entry_id = int(path.rstrip("/").split("/")[-1])
                except (ValueError, IndexError):
                    pass

            username = "Unknown"
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    from jose import jwt as jose_jwt
                    payload = jose_jwt.decode(
                        auth_header[7:],
                        os.getenv("SECRET_KEY", ""),
                        algorithms=[os.getenv("ALGORITHM", "HS256")],
                    )
                    user_id_str = payload.get("sub")
                    if user_id_str:
                        try:
                            conn_u = get_connection()
                            cur_u = conn_u.cursor()
                            cur_u.execute("SELECT COALESCE(full_name, username) FROM Users WHERE id = %s", (int(user_id_str),))
                            u_row = cur_u.fetchone()
                            conn_u.close()
                            if u_row:
                                username = u_row[0]
                        except Exception:
                            username = user_id_str
                except Exception:
                    pass

            try:
                conn = get_connection()
                cur = conn.cursor()
                cur.execute(
                    "INSERT INTO ActivityLog (username, module, action, entry_id) VALUES (%s, %s, %s, %s)",
                    (username, module_name, action, entry_id),
                )
                conn.commit()
                conn.close()
            except Exception:
                pass

    return response


# ─── Routers ──────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(paper_router)
app.include_router(ctp_router)
app.include_router(ink_router)
app.include_router(chemical_router)
app.include_router(adhesive_router)
app.include_router(consumable_router)
app.include_router(packing_router)
app.include_router(oil_router)
app.include_router(dies_router)
app.include_router(analytics_router)
app.include_router(paper_outward_router)
app.include_router(ctp_outward_router)
app.include_router(ink_outward_router)
app.include_router(chemical_outward_router)
app.include_router(adhesive_outward_router)
app.include_router(consumable_outward_router)
app.include_router(packing_outward_router)
app.include_router(oil_outward_router)
app.include_router(die_movement_router)
app.include_router(admin_settings_router)
app.include_router(user_management_router)
app.include_router(micro_router)
app.include_router(micro_plates_outward_router)
app.include_router(micro_chemicals_outward_router)
app.include_router(micro_films_outward_router)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}
