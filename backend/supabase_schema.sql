-- SNP Inward ERP — Supabase PostgreSQL Schema
-- Run this entire file in the Supabase SQL Editor before starting the application.
-- All tables are created in the public schema with lowercase names (PostgreSQL default).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','operator')),
    mobile_number VARCHAR(20) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paperinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    work_type VARCHAR(20) NULL,
    customer_name VARCHAR(200) NULL,
    checked_received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paperitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES paperinward(id) ON DELETE CASCADE,
    work_type VARCHAR(20) NOT NULL CHECK (work_type IN ('Self Work','Job Work')),
    customer_name VARCHAR(200) NULL,
    quality VARCHAR(100) NOT NULL,
    gsm INT NOT NULL,
    form_type VARCHAR(20) NOT NULL CHECK (form_type IN ('Reel Form','Sheet Form')),
    reel_width DECIMAL(10,2) NULL,
    number_of_reels INT NULL,
    total_reel_weight DECIMAL(10,2) NULL,
    sheet_length DECIMAL(10,2) NULL,
    sheet_width DECIMAL(10,2) NULL,
    sheet_weight DECIMAL(10,2) NULL,
    total_sheets INT NULL,
    checked_received_by VARCHAR(200) NULL
);

CREATE TABLE IF NOT EXISTS paperitemreelweights (
    id SERIAL PRIMARY KEY,
    paper_item_id INT NOT NULL REFERENCES paperitems(id) ON DELETE CASCADE,
    reel_number INT NOT NULL,
    weight DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS paperitembundlegroups (
    id SERIAL PRIMARY KEY,
    paper_item_id INT NOT NULL REFERENCES paperitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_bundles INT NOT NULL,
    packets_per_bundle INT NOT NULL,
    sheets_per_packet INT NOT NULL,
    group_total_sheets INT NOT NULL
);

CREATE TABLE IF NOT EXISTS ctpinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    checked_received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    grand_total_plates INT NOT NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ctpplatesizes (
    id SERIAL PRIMARY KEY,
    ctp_inward_id INT NOT NULL REFERENCES ctpinward(id) ON DELETE CASCADE,
    size_number INT NOT NULL,
    plate_size VARCHAR(50) NOT NULL,
    length_mm DECIMAL(10,2) NOT NULL,
    width_mm DECIMAL(10,2) NOT NULL,
    total_packets INT NOT NULL,
    plates_per_packet INT NOT NULL,
    total_plates INT NOT NULL
);

CREATE TABLE IF NOT EXISTS inkvarnishinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    checked_received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    grand_total_weight DECIMAL(10,2) NOT NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inkvarnishitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES inkvarnishinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('UV Ink','Conventional Ink')),
    category VARCHAR(20) NOT NULL CHECK (category IN ('Ink','Varnish')),
    color VARCHAR(50) NULL,
    pantone_number VARCHAR(100) NULL,
    varnish_type VARCHAR(100) NULL,
    checked_received_by VARCHAR(200) NULL,
    item_total_weight DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS inkvarnishboxgroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES inkvarnishitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_boxes INT NOT NULL,
    containers_per_box INT NOT NULL,
    weight_per_container DECIMAL(10,2) NOT NULL,
    group_weight DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS chemicalinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    work_type VARCHAR(20) NULL,
    customer_name VARCHAR(200) NULL,
    checked_received_by VARCHAR(200) NOT NULL,
    remarks VARCHAR(500) NULL,
    grand_total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chemicalitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES chemicalinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    chemical_name VARCHAR(200) NOT NULL,
    manufacturer VARCHAR(200) NULL,
    item_total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS chemicalquantitygroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES chemicalitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_packs DECIMAL(12,3) NOT NULL,
    quantity_per_pack DECIMAL(12,3) NOT NULL,
    group_quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS adhesiveinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    work_type VARCHAR(20) NULL,
    customer_name VARCHAR(200) NULL,
    checked_received_by VARCHAR(200) NOT NULL,
    remarks VARCHAR(500) NULL,
    grand_total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adhesiveitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES adhesiveinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    adhesive_name VARCHAR(200) NOT NULL,
    manufacturer VARCHAR(200) NULL,
    item_total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS adhesivequantitygroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES adhesiveitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_packs DECIMAL(12,3) NOT NULL,
    quantity_per_pack DECIMAL(12,3) NOT NULL,
    group_quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS consumableinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    work_type VARCHAR(20) NULL,
    customer_name VARCHAR(200) NULL,
    checked_received_by VARCHAR(200) NOT NULL,
    remarks VARCHAR(500) NULL,
    grand_total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumableitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES consumableinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    consumable_name VARCHAR(200) NOT NULL,
    unit VARCHAR(20) NULL,
    manufacturer VARCHAR(200) NULL,
    item_total_quantity DECIMAL(12,3) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consumablequantitygroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES consumableitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_packs DECIMAL(12,3) NOT NULL,
    quantity_per_pack DECIMAL(12,3) NOT NULL,
    group_quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS suggestionmemory (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    value VARCHAR(200) NOT NULL,
    CONSTRAINT uq_suggestionmemory_categoryvalue UNIQUE (category, value)
);

CREATE TABLE IF NOT EXISTS packingmaterialinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    checked_received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    grand_total_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packingmaterialitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES packingmaterialinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    material_type VARCHAR(50) NOT NULL,
    custom_name VARCHAR(200) NULL,
    item_total_quantity DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pmboxsizes (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES packingmaterialitems(id) ON DELETE CASCADE,
    size_number INT NOT NULL,
    length DOUBLE PRECISION NOT NULL,
    width DOUBLE PRECISION NOT NULL,
    height DOUBLE PRECISION NOT NULL,
    num_boxes INT NOT NULL
);

CREATE TABLE IF NOT EXISTS pmsutligroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES packingmaterialitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    bundle_quantity INT NOT NULL
);

CREATE TABLE IF NOT EXISTS pmrollweights (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES packingmaterialitems(id) ON DELETE CASCADE,
    roll_number INT NOT NULL,
    weight DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS pmquantitygroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES packingmaterialitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_packs DOUBLE PRECISION NOT NULL,
    quantity_per_pack DOUBLE PRECISION NOT NULL,
    group_quantity DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS oilinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    checked_received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    grand_total_quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oilitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES oilinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    oil_name VARCHAR(200) NOT NULL,
    manufacturer VARCHAR(200) NULL,
    machine_name VARCHAR(200) NULL,
    item_total_quantity DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS oilquantitygroups (
    id SERIAL PRIMARY KEY,
    item_id INT NOT NULL REFERENCES oilitems(id) ON DELETE CASCADE,
    group_number INT NOT NULL,
    number_of_packs DOUBLE PRECISION NOT NULL,
    quantity_per_pack DOUBLE PRECISION NOT NULL,
    group_quantity DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS diesinward (
    id SERIAL PRIMARY KEY,
    inward_date DATE NOT NULL,
    inward_time TIME NULL,
    supplier_name VARCHAR(200) NOT NULL,
    invoice_number VARCHAR(100) NULL,
    checked_received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dieitems (
    id SERIAL PRIMARY KEY,
    inward_id INT NOT NULL REFERENCES diesinward(id) ON DELETE CASCADE,
    item_number INT NOT NULL,
    die_number VARCHAR(100) NOT NULL,
    job_name VARCHAR(200) NOT NULL,
    ups INT NOT NULL,
    embossing VARCHAR(3) NOT NULL,
    female_block VARCHAR(3) NULL,
    rubberized VARCHAR(3) NOT NULL,
    length DOUBLE PRECISION NULL,
    width DOUBLE PRECISION NULL,
    height DOUBLE PRECISION NULL,
    storage_location VARCHAR(200) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    discontinued_date DATE NULL
);

CREATE TABLE IF NOT EXISTS paperoutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    job_name VARCHAR(200) NOT NULL,
    job_card_number VARCHAR(100) NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paperoutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES paperoutward(id) ON DELETE CASCADE,
    quality VARCHAR(100) NOT NULL,
    gsm INT NOT NULL,
    form_type VARCHAR(20) NOT NULL,
    reel_width DECIMAL(10,2) NULL,
    sheet_length DECIMAL(10,2) NULL,
    sheet_width DECIMAL(10,2) NULL,
    weight_issued DECIMAL(10,2) NULL,
    sheets_issued INT NULL,
    issue_method VARCHAR(20) NULL
);

CREATE TABLE IF NOT EXISTS paperadjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES paperoutward(id),
    quality VARCHAR(100) NOT NULL,
    gsm INT NOT NULL,
    form_type VARCHAR(20) NOT NULL,
    reel_width DECIMAL(10,2) NULL,
    sheet_length DECIMAL(10,2) NULL,
    sheet_width DECIMAL(10,2) NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ctpoutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ctpoutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES ctpoutward(id) ON DELETE CASCADE,
    plate_size VARCHAR(100) NOT NULL,
    quantity_issued INT NOT NULL
);

CREATE TABLE IF NOT EXISTS ctpadjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES ctpoutward(id),
    plate_size VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inkoutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    job_name VARCHAR(200) NULL,
    job_card_number VARCHAR(100) NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inkoutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES inkoutward(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL,
    category VARCHAR(20) NOT NULL,
    color VARCHAR(50) NULL,
    pantone_number VARCHAR(100) NULL,
    varnish_type VARCHAR(100) NULL,
    containers_issued INT NOT NULL,
    weight_per_container DECIMAL(10,2) NOT NULL,
    total_weight_issued DECIMAL(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS inkadjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES inkoutward(id),
    item_type VARCHAR(30) NOT NULL,
    category VARCHAR(20) NOT NULL,
    color VARCHAR(50) NULL,
    pantone_number VARCHAR(100) NULL,
    varnish_type VARCHAR(100) NULL,
    quantity_kg DECIMAL(10,2) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packingoutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packingoutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES packingoutward(id) ON DELETE CASCADE,
    material_type VARCHAR(50) NOT NULL,
    box_size VARCHAR(100) NULL,
    quantity_issued DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS packingadjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES packingoutward(id),
    material_type VARCHAR(50) NOT NULL,
    box_size VARCHAR(100) NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oiloutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    machine_name VARCHAR(200) NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oiloutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES oiloutward(id) ON DELETE CASCADE,
    item_name VARCHAR(300) NOT NULL,
    quantity_issued DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS oiladjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES oiloutward(id),
    item_name VARCHAR(300) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diemovements (
    id SERIAL PRIMARY KEY,
    movement_date DATE NOT NULL,
    movement_time TIME NULL,
    die_item_id INT NOT NULL REFERENCES dieitems(id),
    issued_to VARCHAR(200) NOT NULL,
    current_location VARCHAR(200) NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chemicaloutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chemicaloutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES chemicaloutward(id) ON DELETE CASCADE,
    item_name VARCHAR(300) NOT NULL,
    quantity_issued DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS chemicaladjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES chemicaloutward(id),
    item_name VARCHAR(300) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adhesiveoutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS adhesiveoutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES adhesiveoutward(id) ON DELETE CASCADE,
    item_name VARCHAR(300) NOT NULL,
    quantity_issued DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS adhesiveadjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES adhesiveoutward(id),
    item_name VARCHAR(300) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumableoutward (
    id SERIAL PRIMARY KEY,
    outward_date DATE NOT NULL,
    outward_time TIME NULL,
    issued_by VARCHAR(200) NULL,
    received_by VARCHAR(200) NULL,
    remarks VARCHAR(500) NULL,
    created_by INT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumableoutwarditems (
    id SERIAL PRIMARY KEY,
    outward_id INT NOT NULL REFERENCES consumableoutward(id) ON DELETE CASCADE,
    item_name VARCHAR(300) NOT NULL,
    quantity_issued DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS consumableadjustmententries (
    id SERIAL PRIMARY KEY,
    outward_id INT NULL REFERENCES consumableoutward(id),
    item_name VARCHAR(300) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reason VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activitylog (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    module VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    entry_id INT NULL,
    details VARCHAR(500) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appsettings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value TEXT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by INT NULL REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS ix_paperinward_date_supplier ON paperinward(inward_date, supplier_name);
CREATE INDEX IF NOT EXISTS ix_paperitems_search ON paperitems(inward_id, quality, gsm, customer_name, work_type, form_type);
CREATE INDEX IF NOT EXISTS ix_activitylog_created ON activitylog(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_activitylog_module ON activitylog(module);
