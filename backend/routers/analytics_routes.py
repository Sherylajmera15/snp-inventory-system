from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query

from auth import get_current_user
from database import get_connection

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _today() -> str:
    return date.today().isoformat()


def _month_start() -> str:
    d = date.today()
    return date(d.year, d.month, 1).isoformat()


def _fmt_date(v) -> str:
    if v is None:
        return ""
    return str(v)[:10]


def _flt(v) -> float:
    return float(v) if v is not None else 0.0


# ─── Dashboard: all-module today + month stats ────────────────────────────────

@router.get("/dashboard")
def get_dashboard(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()
    r: dict = {}

    # ── Paper ──
    c.execute("""
        SELECT
            COUNT(DISTINCT pi.id),
            SUM(CASE WHEN it.form_type='Reel Form' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.form_type='Sheet Form' THEN 1 ELSE 0 END),
            SUM(CASE WHEN pi.work_type='Job Work' THEN 1 ELSE 0 END),
            SUM(CASE WHEN pi.work_type='Self Work' THEN 1 ELSE 0 END)
        FROM PaperInward pi
        LEFT JOIN PaperItems it ON it.inward_id = pi.id
        WHERE pi.inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["paper_today"] = {
        "total_entries": row[0] or 0, "reel_items": row[1] or 0,
        "sheet_items": row[2] or 0, "job_work": row[3] or 0, "self_work": row[4] or 0,
    }
    c.execute("""
        SELECT COUNT(DISTINCT pi.id),
            COALESCE(SUM(it.total_reel_weight),0), COALESCE(SUM(it.total_sheets),0)
        FROM PaperInward pi
        LEFT JOIN PaperItems it ON it.inward_id = pi.id
        WHERE pi.inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["paper_month"] = {
        "total_entries": row[0] or 0, "total_reel_weight": _flt(row[1]),
        "total_sheets": row[2] or 0,
    }

    # ── CTP ──
    c.execute("""
        SELECT COUNT(DISTINCT id), COALESCE(SUM(grand_total_plates),0)
        FROM CTPInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["ctp_today"] = {"total_entries": row[0] or 0, "total_plates": row[1] or 0}
    c.execute("""
        SELECT ps.plate_size, COALESCE(SUM(ps.total_plates),0)
        FROM CTPPlateSizes ps
        JOIN CTPInward ci ON ci.id = ps.ctp_inward_id
        WHERE ci.inward_date::date = %s
        GROUP BY ps.plate_size
    """, (today,))
    r["ctp_today"]["size_breakdown"] = {row[0]: row[1] for row in c.fetchall()}
    c.execute("""
        SELECT COUNT(DISTINCT id), COALESCE(SUM(grand_total_plates),0)
        FROM CTPInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["ctp_month"] = {"total_entries": row[0] or 0, "total_plates": row[1] or 0}

    # ── Ink ──
    c.execute("""
        SELECT COUNT(DISTINCT i.id),
            SUM(CASE WHEN it.item_type='UV Ink' AND it.category='Ink' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.item_type='Conventional Ink' AND it.category='Ink' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.category='Varnish' AND it.item_type='UV Ink' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.category='Varnish' AND it.item_type='Conventional Ink' THEN 1 ELSE 0 END),
            COALESCE(SUM(i.grand_total_weight),0)
        FROM InkVarnishInward i
        LEFT JOIN InkVarnishItems it ON it.inward_id = i.id
        WHERE i.inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["ink_today"] = {
        "total_entries": row[0] or 0, "uv_ink": row[1] or 0,
        "conv_ink": row[2] or 0, "uv_varnish": row[3] or 0,
        "conv_varnish": row[4] or 0, "total_weight": _flt(row[5]),
    }
    c.execute("""
        SELECT COUNT(DISTINCT id), COALESCE(SUM(grand_total_weight),0)
        FROM InkVarnishInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["ink_month"] = {"total_entries": row[0] or 0, "total_weight": _flt(row[1])}

    # ── Chemicals ──
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM ChemicalInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["chemicals_today"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM ChemicalInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["chemicals_month"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}

    # ── Adhesives ──
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM AdhesiveInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["adhesives_today"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM AdhesiveInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["adhesives_month"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}

    # ── Consumables ──
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM ConsumableInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["consumables_today"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM ConsumableInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["consumables_month"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}

    # ── Packing ──
    c.execute("SELECT COUNT(id) FROM PackingMaterialInward WHERE inward_date::date = %s", (today,))
    r["packing_today"] = {"total_entries": c.fetchone()[0] or 0}
    c.execute("""
        SELECT it.material_type, COALESCE(SUM(it.item_total_quantity),0)
        FROM PackingMaterialItems it
        JOIN PackingMaterialInward pi ON pi.id = it.inward_id
        WHERE pi.inward_date::date = %s
        GROUP BY it.material_type
    """, (today,))
    r["packing_today"]["type_breakdown"] = {row[0]: _flt(row[1]) for row in c.fetchall()}
    c.execute("SELECT COUNT(id) FROM PackingMaterialInward WHERE inward_date >= %s", (ms,))
    r["packing_month"] = {"total_entries": c.fetchone()[0] or 0}
    c.execute("""
        SELECT it.material_type, COALESCE(SUM(it.item_total_quantity),0)
        FROM PackingMaterialItems it
        JOIN PackingMaterialInward pi ON pi.id = it.inward_id
        WHERE pi.inward_date >= %s
        GROUP BY it.material_type
    """, (ms,))
    r["packing_month"]["type_breakdown"] = {row[0]: _flt(row[1]) for row in c.fetchall()}

    # ── Oil ──
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM OilInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    r["oil_today"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}
    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM OilInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    r["oil_month"] = {"total_entries": row[0] or 0, "total_qty": _flt(row[1])}

    # ── Dies ──
    c.execute("""
        SELECT COUNT(di.id)
        FROM DieItems di JOIN DiesInward d ON d.id = di.inward_id
        WHERE d.inward_date::date = %s
    """, (today,))
    r["dies_today"] = {"dies_added": c.fetchone()[0] or 0}
    c.execute("SELECT COUNT(*) FROM DieItems WHERE status='Active'")
    r["dies_today"]["active"] = c.fetchone()[0] or 0
    c.execute("SELECT COUNT(*) FROM DieItems WHERE status='Discontinued'")
    r["dies_today"]["discontinued"] = c.fetchone()[0] or 0
    c.execute("""
        SELECT COUNT(di.id)
        FROM DieItems di JOIN DiesInward d ON d.id = di.inward_id
        WHERE d.inward_date >= %s
    """, (ms,))
    r["dies_month"] = {"dies_added": c.fetchone()[0] or 0}

    # ── Micro ──
    c.execute(
        "SELECT COUNT(*) FROM microinward WHERE inward_date::date = %s AND material_type = 'Plates'", (today,)
    )
    r["micro_today"] = {"plates_today": c.fetchone()[0] or 0}
    c.execute(
        "SELECT COUNT(*) FROM microinward WHERE inward_date::date = %s AND material_type = 'Chemicals'", (today,)
    )
    r["micro_today"]["chemicals_today"] = c.fetchone()[0] or 0
    c.execute(
        "SELECT COUNT(*) FROM microinward WHERE inward_date::date = %s AND material_type = 'Films'", (today,)
    )
    r["micro_today"]["films_today"] = c.fetchone()[0] or 0

    c.execute(
        "SELECT COUNT(*) FROM microinward WHERE inward_date >= %s AND material_type = 'Plates'", (ms,)
    )
    r["micro_month"] = {"plates_month": c.fetchone()[0] or 0}
    c.execute(
        "SELECT COUNT(*) FROM microinward WHERE inward_date >= %s AND material_type = 'Chemicals'", (ms,)
    )
    r["micro_month"]["chemicals_month"] = c.fetchone()[0] or 0
    c.execute(
        "SELECT COUNT(*) FROM microinward WHERE inward_date >= %s AND material_type = 'Films'", (ms,)
    )
    r["micro_month"]["films_month"] = c.fetchone()[0] or 0

    # ── Lamination Film ──
    c.execute("SELECT COUNT(*) FROM laminationfilminward WHERE inward_date::date = %s", (today,))
    lam_entries_today = c.fetchone()[0] or 0
    c.execute("SELECT COALESCE(SUM(r.original_weight), 0) FROM laminationfilmroll r JOIN laminationfilminward i ON i.id = r.inward_id WHERE i.inward_date::date = %s", (today,))
    lam_weight_today = float(c.fetchone()[0] or 0)
    c.execute("SELECT COALESCE(SUM(quantity_issued), 0) FROM laminationfilmoutward WHERE outward_date::date = %s", (today,))
    lam_issued_today = float(c.fetchone()[0] or 0)

    c.execute("SELECT COUNT(*) FROM laminationfilminward WHERE inward_date >= %s", (ms,))
    lam_entries_month = c.fetchone()[0] or 0
    c.execute("SELECT COALESCE(SUM(r.original_weight), 0) FROM laminationfilmroll r JOIN laminationfilminward i ON i.id = r.inward_id WHERE i.inward_date >= %s", (ms,))
    lam_weight_month = float(c.fetchone()[0] or 0)
    c.execute("SELECT COALESCE(SUM(quantity_issued), 0) FROM laminationfilmoutward WHERE outward_date >= %s", (ms,))
    lam_issued_month = float(c.fetchone()[0] or 0)

    r["lamination_today"] = {"entries_today": lam_entries_today, "weight_received_today": lam_weight_today, "weight_issued_today": lam_issued_today}
    r["lamination_month"] = {"entries_month": lam_entries_month, "weight_received_month": lam_weight_month, "weight_issued_month": lam_issued_month}

    conn.close()
    return r


# ─── Recent entries across all modules ───────────────────────────────────────

@router.get("/recent")
def get_recent(limit: int = 20, current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    results = []

    queries = [
        ("Paper", "PaperInward", "id", "inward_date", "supplier_name", "created_at", "/paper/"),
        ("CTP Plates", "CTPInward", "id", "inward_date", "supplier_name", "created_at", "/ctp/"),
        ("Ink & Varnishes", "InkVarnishInward", "id", "inward_date", "supplier_name", "created_at", "/ink/"),
        ("Chemicals", "ChemicalInward", "id", "inward_date", "supplier_name", "created_at", "/chemicals/"),
        ("Adhesives", "AdhesiveInward", "id", "inward_date", "supplier_name", "created_at", "/adhesives/"),
        ("Consumables", "ConsumableInward", "id", "inward_date", "supplier_name", "created_at", "/consumables/"),
        ("Packing Materials", "PackingMaterialInward", "id", "inward_date", "supplier_name", "created_at", "/packing/"),
        ("Oil & Lubrication", "OilInward", "id", "inward_date", "supplier_name", "created_at", "/oil/"),
        ("Dies", "DiesInward", "id", "inward_date", "supplier_name", "created_at", "/dies/"),
        ("Micro Plates/Films/Chem", "microinward", "id", "inward_date", "supplier_name", "created_at", "/micro/"),
        ("Lamination Film", "laminationfilminward", "id", "inward_date", "supplier_name", "created_at", "/lamination/"),
    ]

    for module, table, id_col, date_col, supplier_col, created_col, href_prefix in queries:
        try:
            c.execute(f"""
                SELECT {id_col}, {date_col}, {supplier_col}, {created_col}
                FROM {table}
                ORDER BY {created_col} DESC
                LIMIT 5
            """)
            for row in c.fetchall():
                results.append({
                    "module": module,
                    "id": row[0],
                    "date": _fmt_date(row[1]),
                    "supplier": str(row[2]) if row[2] else "",
                    "created_at": str(row[3]) if row[3] else "",
                    "href": f"{href_prefix}{row[0]}",
                })
        except Exception:
            pass

    results.sort(key=lambda x: x["created_at"], reverse=True)
    conn.close()
    return results[:limit]


# ─── Global search across all modules ────────────────────────────────────────

@router.get("/global-search")
def global_search(
    q: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
):
    like = f"%{q}%"
    conn = get_connection()
    c = conn.cursor()
    results = []
    seen: set = set()

    def add(module, entry_id, date_val, supplier, description, href):
        key = (module, entry_id)
        if key not in seen:
            seen.add(key)
            results.append({
                "module": module,
                "id": entry_id,
                "date": _fmt_date(date_val),
                "supplier": str(supplier) if supplier else "",
                "description": description,
                "href": href,
            })

    # Paper
    c.execute("""
        SELECT pi.id, pi.inward_date, pi.supplier_name,
            pi.work_type, it.quality, it.gsm::text
        FROM PaperInward pi
        LEFT JOIN PaperItems it ON it.inward_id = pi.id
        WHERE pi.supplier_name ILIKE %s OR pi.invoice_number ILIKE %s
           OR pi.customer_name ILIKE %s OR pi.remarks ILIKE %s
           OR it.quality ILIKE %s OR it.gsm::text ILIKE %s
           OR pi.inward_date::text ILIKE %s
        ORDER BY pi.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4], f"{row[5]} GSM" if row[5] else None]))
        add("Paper", row[0], row[1], row[2], desc, f"/paper/{row[0]}")

    # CTP
    c.execute("""
        SELECT ci.id, ci.inward_date, ci.supplier_name,
            ps.plate_size, ps.total_plates::text
        FROM CTPInward ci
        LEFT JOIN CTPPlateSizes ps ON ps.ctp_inward_id = ci.id
        WHERE ci.supplier_name ILIKE %s OR ci.invoice_number ILIKE %s
           OR ci.remarks ILIKE %s OR ps.plate_size ILIKE %s
           OR ps.total_plates::text ILIKE %s
           OR ci.inward_date::text ILIKE %s
        ORDER BY ci.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], f"{row[4]} plates" if row[4] else None]))
        add("CTP Plates", row[0], row[1], row[2], desc, f"/ctp/{row[0]}")

    # Ink
    c.execute("""
        SELECT i.id, i.inward_date, i.supplier_name,
            it.item_type, it.category, it.color, it.varnish_type, it.pantone_number
        FROM InkVarnishInward i
        LEFT JOIN InkVarnishItems it ON it.inward_id = i.id
        WHERE i.supplier_name ILIKE %s OR i.invoice_number ILIKE %s
           OR i.remarks ILIKE %s OR it.color ILIKE %s
           OR it.varnish_type ILIKE %s OR it.pantone_number ILIKE %s
           OR i.inward_date::text ILIKE %s
        ORDER BY i.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like, like))
    for row in c.fetchall():
        parts = [row[3], row[4], row[5] or row[6] or row[7]]
        desc = " · ".join(filter(None, parts))
        add("Ink & Varnishes", row[0], row[1], row[2], desc, f"/ink/{row[0]}")

    # Chemicals
    c.execute("""
        SELECT ci.id, ci.inward_date, ci.supplier_name, it.chemical_name, it.manufacturer
        FROM ChemicalInward ci
        LEFT JOIN ChemicalItems it ON it.inward_id = ci.id
        WHERE ci.supplier_name ILIKE %s OR ci.invoice_number ILIKE %s
           OR ci.remarks ILIKE %s OR it.chemical_name ILIKE %s OR it.manufacturer ILIKE %s
           OR ci.inward_date::text ILIKE %s
        ORDER BY ci.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4]]))
        add("Chemicals", row[0], row[1], row[2], desc, f"/chemicals/{row[0]}")

    # Adhesives
    c.execute("""
        SELECT ai.id, ai.inward_date, ai.supplier_name, it.adhesive_name, it.manufacturer
        FROM AdhesiveInward ai
        LEFT JOIN AdhesiveItems it ON it.inward_id = ai.id
        WHERE ai.supplier_name ILIKE %s OR ai.invoice_number ILIKE %s
           OR ai.remarks ILIKE %s OR it.adhesive_name ILIKE %s OR it.manufacturer ILIKE %s
           OR ai.inward_date::text ILIKE %s
        ORDER BY ai.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4]]))
        add("Adhesives", row[0], row[1], row[2], desc, f"/adhesives/{row[0]}")

    # Consumables
    c.execute("""
        SELECT ci.id, ci.inward_date, ci.supplier_name, it.consumable_name, it.manufacturer
        FROM ConsumableInward ci
        LEFT JOIN ConsumableItems it ON it.inward_id = ci.id
        WHERE ci.supplier_name ILIKE %s OR ci.invoice_number ILIKE %s
           OR ci.remarks ILIKE %s OR it.consumable_name ILIKE %s OR it.manufacturer ILIKE %s
           OR ci.inward_date::text ILIKE %s
        ORDER BY ci.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4]]))
        add("Consumables", row[0], row[1], row[2], desc, f"/consumables/{row[0]}")

    # Packing
    c.execute("""
        SELECT pi.id, pi.inward_date, pi.supplier_name, it.material_type, it.custom_name
        FROM PackingMaterialInward pi
        LEFT JOIN PackingMaterialItems it ON it.inward_id = pi.id
        WHERE pi.supplier_name ILIKE %s OR pi.invoice_number ILIKE %s
           OR pi.remarks ILIKE %s OR it.material_type ILIKE %s OR it.custom_name ILIKE %s
           OR pi.inward_date::text ILIKE %s
        ORDER BY pi.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4]]))
        add("Packing Materials", row[0], row[1], row[2], desc, f"/packing/{row[0]}")

    # Oil
    c.execute("""
        SELECT oi.id, oi.inward_date, oi.supplier_name, it.oil_name, it.manufacturer, it.machine_name
        FROM OilInward oi
        LEFT JOIN OilItems it ON it.inward_id = oi.id
        WHERE oi.supplier_name ILIKE %s OR oi.invoice_number ILIKE %s
           OR oi.remarks ILIKE %s OR it.oil_name ILIKE %s OR it.manufacturer ILIKE %s OR it.machine_name ILIKE %s
           OR oi.inward_date::text ILIKE %s
        ORDER BY oi.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4], row[5]]))
        add("Oil & Lubrication", row[0], row[1], row[2], desc, f"/oil/{row[0]}")

    # Dies
    c.execute("""
        SELECT di.id, di.inward_date, di.supplier_name,
            it.die_number, it.job_name, it.status
        FROM DiesInward di
        LEFT JOIN DieItems it ON it.inward_id = di.id
        WHERE di.supplier_name ILIKE %s OR di.invoice_number ILIKE %s
           OR di.remarks ILIKE %s OR it.die_number ILIKE %s OR it.job_name ILIKE %s
           OR it.storage_location ILIKE %s OR it.status ILIKE %s
           OR di.inward_date::text ILIKE %s
        ORDER BY di.inward_date DESC
        LIMIT 8
    """, (like, like, like, like, like, like, like, like))
    for row in c.fetchall():
        desc = " · ".join(filter(None, [row[3], row[4], row[5]]))
        add("Dies", row[0], row[1], row[2], desc, f"/dies/{row[0]}")

    # Lamination Film
    c.execute("""
        SELECT i.id, i.inward_date, i.supplier_name, i.film_type, i.custom_type, i.film_length, i.film_width
        FROM laminationfilminward i
        WHERE i.supplier_name ILIKE %s OR i.invoice_number ILIKE %s
           OR i.film_type ILIKE %s OR i.custom_type ILIKE %s OR i.remarks ILIKE %s
           OR i.inward_date::text ILIKE %s
        ORDER BY i.inward_date DESC LIMIT 5
    """, (like, like, like, like, like, like))
    for row in c.fetchall():
        type_str = row[4] if row[4] else row[3]
        size_str = f"{row[5]}×{row[6]}" if row[5] and row[6] else ""
        desc = " · ".join(filter(None, [type_str, size_str]))
        add("Lamination Film", row[0], row[1], row[2], desc, f"/lamination/{row[0]}")

    conn.close()
    return results


# ─── Per-module analytics ─────────────────────────────────────────────────────

@router.get("/paper")
def analytics_paper(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute("""
        SELECT it.quality, COUNT(DISTINCT pi.id), COALESCE(SUM(it.total_reel_weight),0), COALESCE(SUM(it.total_sheets),0)
        FROM PaperItems it JOIN PaperInward pi ON pi.id = it.inward_id
        GROUP BY it.quality ORDER BY COUNT(DISTINCT pi.id) DESC
    """)
    quality = [{"quality": r[0], "entries": r[1], "reel_weight": _flt(r[2]), "sheets": r[3] or 0} for r in c.fetchall()]

    c.execute("""
        SELECT supplier_name, COUNT(id) as cnt
        FROM PaperInward GROUP BY supplier_name ORDER BY cnt DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    c.execute("""
        SELECT COUNT(DISTINCT pi.id),
            SUM(CASE WHEN it.form_type='Reel Form' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.form_type='Sheet Form' THEN 1 ELSE 0 END),
            COALESCE(SUM(it.total_reel_weight),0), COALESCE(SUM(it.total_sheets),0),
            SUM(CASE WHEN pi.work_type='Job Work' THEN 1 ELSE 0 END),
            SUM(CASE WHEN pi.work_type='Self Work' THEN 1 ELSE 0 END)
        FROM PaperInward pi
        LEFT JOIN PaperItems it ON it.inward_id = pi.id
        WHERE pi.inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    today_stats = {
        "entries": row[0] or 0, "reel": row[1] or 0, "sheet": row[2] or 0,
        "reel_weight": _flt(row[3]), "sheets": row[4] or 0,
        "job_work": row[5] or 0, "self_work": row[6] or 0,
    }

    c.execute("""
        SELECT COUNT(DISTINCT pi.id),
            COALESCE(SUM(it.total_reel_weight),0), COALESCE(SUM(it.total_sheets),0)
        FROM PaperInward pi
        LEFT JOIN PaperItems it ON it.inward_id = pi.id
        WHERE pi.inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    month_stats = {
        "entries": row[0] or 0, "reel_weight": _flt(row[1]), "sheets": row[2] or 0,
    }

    conn.close()
    return {"today": today_stats, "month": month_stats, "quality_breakdown": quality, "top_suppliers": suppliers}


@router.get("/ctp")
def analytics_ctp(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute("""
        SELECT COUNT(DISTINCT id), COALESCE(SUM(grand_total_plates),0)
        FROM CTPInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    today_stats = {"entries": row[0] or 0, "plates": row[1] or 0}

    c.execute("""
        SELECT COUNT(DISTINCT id), COALESCE(SUM(grand_total_plates),0)
        FROM CTPInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    month_stats = {"entries": row[0] or 0, "plates": row[1] or 0}

    c.execute("""
        SELECT ps.plate_size, COUNT(DISTINCT ci.id), COALESCE(SUM(ps.total_plates),0)
        FROM CTPPlateSizes ps JOIN CTPInward ci ON ci.id = ps.ctp_inward_id
        GROUP BY ps.plate_size ORDER BY SUM(ps.total_plates) DESC
    """)
    sizes = [{"size": r[0], "entries": r[1], "plates": r[2] or 0} for r in c.fetchall()]

    c.execute("""
        SELECT supplier_name, COUNT(id) FROM CTPInward
        GROUP BY supplier_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    conn.close()
    return {"today": today_stats, "month": month_stats, "size_breakdown": sizes, "top_suppliers": suppliers}


@router.get("/ink")
def analytics_ink(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute("""
        SELECT COUNT(DISTINCT i.id),
            SUM(CASE WHEN it.item_type='UV Ink' AND it.category='Ink' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.item_type='Conventional Ink' AND it.category='Ink' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.category='Varnish' AND it.item_type='UV Ink' THEN 1 ELSE 0 END),
            SUM(CASE WHEN it.category='Varnish' AND it.item_type='Conventional Ink' THEN 1 ELSE 0 END),
            COALESCE(SUM(i.grand_total_weight),0)
        FROM InkVarnishInward i
        LEFT JOIN InkVarnishItems it ON it.inward_id = i.id
        WHERE i.inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    today_stats = {
        "entries": row[0] or 0, "uv_ink": row[1] or 0, "conv_ink": row[2] or 0,
        "uv_varnish": row[3] or 0, "conv_varnish": row[4] or 0, "weight": _flt(row[5]),
    }

    c.execute("""
        SELECT COUNT(DISTINCT id), COALESCE(SUM(grand_total_weight),0)
        FROM InkVarnishInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    month_stats = {"entries": row[0] or 0, "weight": _flt(row[1])}

    c.execute("""
        SELECT supplier_name, COUNT(id) FROM InkVarnishInward
        GROUP BY supplier_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    conn.close()
    return {"today": today_stats, "month": month_stats, "top_suppliers": suppliers}


def _simple_analytics(table, item_table, name_col, current_user):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute(f"""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM {table} WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    today_stats = {"entries": row[0] or 0, "qty": _flt(row[1])}

    c.execute(f"""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM {table} WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    month_stats = {"entries": row[0] or 0, "qty": _flt(row[1])}

    c.execute(f"""
        SELECT {name_col}, COUNT(id), COALESCE(SUM(item_total_quantity),0)
        FROM {item_table} GROUP BY {name_col}
        ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    items = [{"name": r[0], "count": r[1], "qty": _flt(r[2])} for r in c.fetchall()]

    c.execute(f"""
        SELECT supplier_name, COUNT(id) FROM {table}
        GROUP BY supplier_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    conn.close()
    return {"today": today_stats, "month": month_stats, "item_breakdown": items, "top_suppliers": suppliers}


@router.get("/chemicals")
def analytics_chemicals(current_user: dict = Depends(get_current_user)):
    return _simple_analytics("ChemicalInward", "ChemicalItems", "chemical_name", current_user)


@router.get("/adhesives")
def analytics_adhesives(current_user: dict = Depends(get_current_user)):
    return _simple_analytics("AdhesiveInward", "AdhesiveItems", "adhesive_name", current_user)


@router.get("/consumables")
def analytics_consumables(current_user: dict = Depends(get_current_user)):
    return _simple_analytics("ConsumableInward", "ConsumableItems", "consumable_name", current_user)


@router.get("/packing")
def analytics_packing(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute("SELECT COUNT(id) FROM PackingMaterialInward WHERE inward_date::date = %s", (today,))
    today_stats = {"entries": c.fetchone()[0] or 0}
    c.execute("""
        SELECT it.material_type, COALESCE(SUM(it.item_total_quantity),0)
        FROM PackingMaterialItems it JOIN PackingMaterialInward pi ON pi.id = it.inward_id
        WHERE pi.inward_date::date = %s GROUP BY it.material_type
    """, (today,))
    today_stats["type_breakdown"] = {r[0]: _flt(r[1]) for r in c.fetchall()}

    c.execute("SELECT COUNT(id) FROM PackingMaterialInward WHERE inward_date >= %s", (ms,))
    month_stats = {"entries": c.fetchone()[0] or 0}
    c.execute("""
        SELECT it.material_type, COALESCE(SUM(it.item_total_quantity),0)
        FROM PackingMaterialItems it JOIN PackingMaterialInward pi ON pi.id = it.inward_id
        WHERE pi.inward_date >= %s GROUP BY it.material_type
    """, (ms,))
    month_stats["type_breakdown"] = {r[0]: _flt(r[1]) for r in c.fetchall()}

    c.execute("""
        SELECT supplier_name, COUNT(id) FROM PackingMaterialInward
        GROUP BY supplier_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    conn.close()
    return {"today": today_stats, "month": month_stats, "top_suppliers": suppliers}


@router.get("/oil")
def analytics_oil(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM OilInward WHERE inward_date::date = %s
    """, (today,))
    row = c.fetchone()
    today_stats = {"entries": row[0] or 0, "qty": _flt(row[1])}

    c.execute("""
        SELECT COUNT(id), COALESCE(SUM(grand_total_quantity),0)
        FROM OilInward WHERE inward_date >= %s
    """, (ms,))
    row = c.fetchone()
    month_stats = {"entries": row[0] or 0, "qty": _flt(row[1])}

    c.execute("""
        SELECT oil_name, COUNT(id), COALESCE(SUM(item_total_quantity),0)
        FROM OilItems GROUP BY oil_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    items = [{"name": r[0], "count": r[1], "qty": _flt(r[2])} for r in c.fetchall()]

    c.execute("""
        SELECT supplier_name, COUNT(id) FROM OilInward
        GROUP BY supplier_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    conn.close()
    return {"today": today_stats, "month": month_stats, "item_breakdown": items, "top_suppliers": suppliers}


@router.get("/dies")
def analytics_dies(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    today = _today()
    ms = _month_start()

    c.execute("""
        SELECT COUNT(di.id) FROM DieItems di
        JOIN DiesInward d ON d.id = di.inward_id WHERE d.inward_date::date = %s
    """, (today,))
    today_stats = {"dies_added": c.fetchone()[0] or 0}

    c.execute("""
        SELECT COUNT(di.id) FROM DieItems di
        JOIN DiesInward d ON d.id = di.inward_id WHERE d.inward_date >= %s
    """, (ms,))
    month_stats = {"dies_added": c.fetchone()[0] or 0}

    c.execute("SELECT COUNT(*) FROM DieItems WHERE status='Active'")
    active = c.fetchone()[0] or 0
    c.execute("SELECT COUNT(*) FROM DieItems WHERE status='Discontinued'")
    discontinued = c.fetchone()[0] or 0

    c.execute("""
        SELECT supplier_name, COUNT(id) FROM DiesInward
        GROUP BY supplier_name ORDER BY COUNT(id) DESC
        LIMIT 10
    """)
    suppliers = [{"name": r[0], "count": r[1]} for r in c.fetchall()]

    conn.close()
    return {
        "today": today_stats, "month": month_stats,
        "active": active, "discontinued": discontinued,
        "top_suppliers": suppliers,
    }


# ─── Activity log ─────────────────────────────────────────────────────────────

@router.get("/activity")
def get_activity(
    module: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    current_user: dict = Depends(get_current_user),
):
    conn = get_connection()
    c = conn.cursor()
    where = ["1=1"]
    params: list = []
    if module:
        where.append("module = %s")
        params.append(module)
    if username:
        where.append("username ILIKE %s")
        params.append(f"%{username}%")
    if date_from:
        where.append("created_at::date >= %s")
        params.append(date_from)
    if date_to:
        where.append("created_at::date <= %s")
        params.append(date_to)
    c.execute(
        f"SELECT id, username, module, action, entry_id, created_at, details "
        f"FROM ActivityLog WHERE {' AND '.join(where)} ORDER BY created_at DESC "
        f"LIMIT {limit}",
        params,
    )
    rows = c.fetchall()
    conn.close()
    return [
        {
            "id": r[0], "username": r[1], "module": r[2],
            "action": r[3], "entry_id": r[4],
            "created_at": str(r[5]) if r[5] else "",
            "details": r[6],
        }
        for r in rows
    ]


@router.get("/activity/modules")
def get_activity_modules(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT DISTINCT module FROM ActivityLog ORDER BY module")
    modules = [r[0] for r in c.fetchall()]
    conn.close()
    return modules


@router.get("/activity/users")
def get_activity_users(current_user: dict = Depends(get_current_user)):
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT DISTINCT username FROM ActivityLog ORDER BY username")
    users = [r[0] for r in c.fetchall()]
    conn.close()
    return users
