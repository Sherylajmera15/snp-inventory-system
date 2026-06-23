import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const RUST = [164, 31, 19] as [number, number, number];
const CREAM = [250, 245, 241] as [number, number, number];
const COMPANY = "Shri Neminath Printers & Packaging";

function fmtDate(d: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB"); } catch { return d; }
}
function fmtTime(t: string | null | undefined) { return t ? String(t).slice(0, 5) : ""; }
function fmtNum(v: number | null | undefined, decimals = 2) {
  if (v === null || v === undefined) return "";
  return Number(v).toFixed(decimals);
}
function s(v: unknown) { return v !== null && v !== undefined ? String(v) : ""; }

// ─── Logo loader ────────────────────────────────────────────────────────────

async function getLogoBase64(): Promise<string | null> {
  try {
    const response = await fetch("/logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function addPdfFooter(doc: jsPDF, pageNumber: number, logoData: string | null): void {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(7);
  doc.setTextColor(143, 122, 110);
  let textX = 10;
  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", 10, pageH - 13, 8, 10);
      textX = 21;
    } catch { /* logo unavailable */ }
  }
  doc.text(COMPANY, textX, pageH - 5);
  doc.text(`Page ${pageNumber}`, pageW - 22, pageH - 5);
}

// ─── PDF ────────────────────────────────────────────────────────────────────

async function buildPDF(moduleTitle: string, rangeLabel: string, columns: string[], rows: string[][]): Promise<void> {
  const logoData = await getLogoBase64();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setTextColor(41, 47, 54);
  doc.text(`${COMPANY}`, 14, 14);
  doc.setFontSize(11);
  doc.text(`${moduleTitle} Inward Report`, 14, 21);
  doc.setFontSize(8);
  doc.setTextColor(143, 122, 110);
  doc.text(`Range: ${rangeLabel}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 33);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: 38,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: [41, 47, 54] },
    headStyles: { fillColor: RUST, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: CREAM },
    margin: { left: 10, right: 10, bottom: 18 },
    didDrawPage: (data) => { addPdfFooter(doc, data.pageNumber, logoData); },
  });

  const fname = `${moduleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}

// ─── Excel ──────────────────────────────────────────────────────────────────

function buildExcel(moduleTitle: string, rangeLabel: string, rows: Record<string, string>[]): void {
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  const firstKey = Object.keys(rows[0])[0];
  const brandingRow = { [firstKey]: `${COMPANY}  |  ${moduleTitle} Report  |  ${rangeLabel}` } as Record<string, string>;
  const ws = XLSX.utils.json_to_sheet([...rows, {} as Record<string, string>, brandingRow]);
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: `${moduleTitle} Inward Report`, Subject: rangeLabel, Company: COMPANY };
  XLSX.utils.book_append_sheet(wb, ws, moduleTitle.slice(0, 31));
  const fname = `${moduleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ─── Minimal entry shapes for export functions ───────────────────────────────

interface ExportPaperItem {
  quality: unknown; gsm: unknown; form_type: unknown; reel_width: unknown; number_of_reels: unknown;
  total_reel_weight: number | null | undefined; sheet_length: unknown; sheet_width: unknown;
  total_sheets: unknown; sheet_weight: number | null | undefined;
}
interface ExportPaperEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  work_type: unknown; customer_name: unknown; checked_received_by: unknown; remarks: unknown;
  items: ExportPaperItem[];
}

interface ExportPlateSizeItem {
  plate_size: unknown; length_mm: unknown; width_mm: unknown;
  total_packets: unknown; plates_per_packet: unknown; total_plates: unknown;
}
interface ExportCTPEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown; grand_total_plates: unknown;
  plate_sizes: ExportPlateSizeItem[];
}

interface ExportInkItem {
  item_number: unknown; item_type: unknown; category: unknown; color: unknown;
  pantone_number: unknown; varnish_type: unknown; item_total_weight: number | null | undefined;
}
interface ExportInkEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown; grand_total_weight: number | null | undefined;
  items: ExportInkItem[];
}

interface ExportChemicalItem {
  item_number: unknown; chemical_name: unknown; manufacturer: unknown;
  item_total_quantity: number | null | undefined;
}
interface ExportChemicalEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown; grand_total_quantity: number | null | undefined;
  items: ExportChemicalItem[];
}

interface ExportAdhesiveItem {
  item_number: unknown; adhesive_name: unknown; manufacturer: unknown;
  item_total_quantity: number | null | undefined;
}
interface ExportAdhesiveEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown; grand_total_quantity: number | null | undefined;
  items: ExportAdhesiveItem[];
}

interface ExportConsumableItem {
  item_number: unknown; consumable_name: unknown; manufacturer: unknown;
  item_total_quantity: number | null | undefined;
}
interface ExportConsumableEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown; grand_total_quantity: number | null | undefined;
  items: ExportConsumableItem[];
}

interface ExportPackingItem {
  item_number: unknown; material_type: unknown; custom_name: unknown;
  item_total_quantity: number | null | undefined;
}
interface ExportPackingEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown;
  items: ExportPackingItem[];
}

interface ExportOilItem {
  item_number: unknown; oil_name: unknown; manufacturer: unknown; machine_name: unknown;
  item_total_quantity: number | null | undefined;
}
interface ExportOilEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown; grand_total_quantity: number | null | undefined;
  items: ExportOilItem[];
}

interface ExportDieItem {
  item_number: unknown; die_number: unknown; job_name: unknown; ups: unknown; embossing: unknown;
  female_block: unknown; rubberized: unknown; length: unknown; width: unknown; height: unknown;
  storage_location: unknown; status: unknown; discontinued_date: unknown;
}
interface ExportDiesEntry {
  inward_date: string; inward_time: string; supplier_name: unknown; invoice_number: unknown;
  checked_received_by: unknown; remarks: unknown;
  items: ExportDieItem[];
}

interface ExportInkOutwardItem {
  item_type: unknown; category: unknown; color: unknown; pantone_number: unknown; varnish_type: unknown;
  containers_issued: unknown; weight_per_container: unknown; total_weight_issued: unknown;
}
interface ExportInkAdjustment {
  item_type: unknown; category: unknown; color: unknown; pantone_number: unknown; varnish_type: unknown;
  quantity_kg: unknown; reason: unknown;
}
interface ExportInkOutwardEntry {
  outward_date: string; outward_time: string | null;
  job_name: unknown; job_card_number: unknown; issued_by: unknown; received_by: unknown; remarks: unknown;
  items: ExportInkOutwardItem[];
  adjustments: ExportInkAdjustment[];
}

interface ExportCTPOutwardItem {
  plate_size: unknown; quantity_issued: unknown;
}
interface ExportCTPAdjustment {
  plate_size: unknown; quantity: unknown; reason: unknown;
}
interface ExportCTPOutwardEntry {
  outward_date: string; outward_time: string | null;
  issued_by: unknown; received_by: unknown; remarks: unknown;
  items: ExportCTPOutwardItem[];
  adjustments: ExportCTPAdjustment[];
}

interface ExportPaperOutwardItem {
  quality: unknown; gsm: unknown; form_type: unknown;
  weight_issued: unknown; sheets_issued: unknown; issue_method: unknown;
}
interface ExportPaperAdjustment {
  quality: unknown; gsm: unknown; form_type: unknown; quantity: unknown; unit: unknown; reason: unknown;
}
interface ExportPaperOutwardEntry {
  outward_date: string; outward_time: string | null;
  job_name: unknown; job_card_number: unknown; issued_by: unknown; received_by: unknown; remarks: unknown;
  items: ExportPaperOutwardItem[];
  adjustments: ExportPaperAdjustment[];
}

// ─── Module flatten functions ────────────────────────────────────────────────

export function exportPaper(entries: ExportPaperEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Work Type": s(e.work_type),
        "Customer": s(e.customer_name),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Quality": s(item.quality),
        "GSM": s(item.gsm),
        "Form Type": s(item.form_type),
        "Reel Width (cm)": s(item.reel_width),
        "No. of Reels": s(item.number_of_reels),
        "Total Reel Weight (kg)": fmtNum(item.total_reel_weight),
        "Sheet Length (cm)": s(item.sheet_length),
        "Sheet Width (cm)": s(item.sheet_width),
        "Total Sheets": s(item.total_sheets),
        "Sheet Weight (kg)": fmtNum(item.sheet_weight),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Paper", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Paper", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportCTP(entries: ExportCTPEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const ps of e.plate_sizes || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Grand Total Plates": s(e.grand_total_plates),
        "Plate Size": s(ps.plate_size),
        "Length (mm)": s(ps.length_mm),
        "Width (mm)": s(ps.width_mm),
        "Total Packets": s(ps.total_packets),
        "Plates / Packet": s(ps.plates_per_packet),
        "Total Plates": s(ps.total_plates),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("CTP Plates", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("CTP Plates", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportInk(entries: ExportInkEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Grand Total Weight (kg)": fmtNum(e.grand_total_weight, 3),
        "Item #": s(item.item_number),
        "Type": s(item.item_type),
        "Category": s(item.category),
        "Color": s(item.color),
        "Pantone #": s(item.pantone_number),
        "Varnish Type": s(item.varnish_type),
        "Item Total Weight (kg)": fmtNum(item.item_total_weight, 3),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Ink and Varnishes", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Ink and Varnishes", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportChemicals(entries: ExportChemicalEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Grand Total Qty": fmtNum(e.grand_total_quantity, 3),
        "Item #": s(item.item_number),
        "Chemical Name": s(item.chemical_name),
        "Manufacturer": s(item.manufacturer),
        "Item Total Qty": fmtNum(item.item_total_quantity, 3),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Chemicals", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Chemicals", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportAdhesives(entries: ExportAdhesiveEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Grand Total Qty": fmtNum(e.grand_total_quantity, 3),
        "Item #": s(item.item_number),
        "Adhesive Name": s(item.adhesive_name),
        "Manufacturer": s(item.manufacturer),
        "Item Total Qty": fmtNum(item.item_total_quantity, 3),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Adhesives", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Adhesives", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportConsumables(entries: ExportConsumableEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Grand Total Qty": fmtNum(e.grand_total_quantity, 3),
        "Item #": s(item.item_number),
        "Consumable Name": s(item.consumable_name),
        "Manufacturer": s(item.manufacturer),
        "Item Total Qty": fmtNum(item.item_total_quantity, 3),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Consumables", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Consumables", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportPacking(entries: ExportPackingEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      const name = item.material_type === "Other" && item.custom_name ? s(item.custom_name) : s(item.material_type);
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Item #": s(item.item_number),
        "Material Type": s(item.material_type),
        "Name / Custom": name,
        "Item Total Qty": fmtNum(item.item_total_quantity, 3),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Packing Materials", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Packing Materials", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportOil(entries: ExportOilEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Grand Total Qty": fmtNum(e.grand_total_quantity, 3),
        "Item #": s(item.item_number),
        "Oil / Lubricant Name": s(item.oil_name),
        "Manufacturer": s(item.manufacturer),
        "Machine Name": s(item.machine_name),
        "Item Total Qty": fmtNum(item.item_total_quantity, 3),
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Oil and Lubrication", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Oil and Lubrication", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportDies(entries: ExportDiesEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.inward_date),
        "Time": fmtTime(e.inward_time),
        "Supplier": s(e.supplier_name),
        "Invoice": s(e.invoice_number),
        "Checked / Received By": s(e.checked_received_by),
        "Remarks": s(e.remarks),
        "Item #": s(item.item_number),
        "Die Number": s(item.die_number),
        "Job Name": s(item.job_name),
        "UPS": s(item.ups),
        "Embossing": s(item.embossing),
        "Female Block": s(item.female_block),
        "Rubberized": s(item.rubberized),
        "Length (mm)": s(item.length),
        "Width (mm)": s(item.width),
        "Height (mm)": s(item.height),
        "Storage Location": s(item.storage_location),
        "Status": s(item.status),
        "Discontinued Date": item.discontinued_date ? fmtDate(s(item.discontinued_date)) : "",
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Dies", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Dies", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export async function exportInkOutward(entries: ExportInkOutwardEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      const itemName = item.category === "Ink"
        ? `${s(item.item_type)} — ${s(item.color)}${item.pantone_number ? ` (${s(item.pantone_number)})` : ""}`
        : `${s(item.item_type) === "UV Ink" ? "UV" : "Conventional"} Varnish — ${s(item.varnish_type)}`;
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time),
        "Job Name": s(e.job_name),
        "Job Card No.": s(e.job_card_number),
        "Issued By": s(e.issued_by),
        "Received By": s(e.received_by),
        "Remarks": s(e.remarks),
        "Item": itemName,
        "Category": s(item.category),
        "Containers": s(item.containers_issued),
        "Wt/Container (Kg)": s(item.weight_per_container),
        "Total Weight (Kg)": s(item.total_weight_issued),
      });
    }
    for (const adj of e.adjustments || []) {
      const itemName = adj.category === "Ink"
        ? `${s(adj.item_type)} — ${s(adj.color)}${adj.pantone_number ? ` (${s(adj.pantone_number)})` : ""}`
        : `${s(adj.item_type) === "UV Ink" ? "UV" : "Conventional"} Varnish — ${s(adj.varnish_type)}`;
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time),
        "Job Name": "[ADJUSTMENT]",
        "Job Card No.": s(e.job_card_number),
        "Issued By": "",
        "Received By": "",
        "Remarks": s(adj.reason),
        "Item": itemName,
        "Category": s(adj.category),
        "Containers": "",
        "Wt/Container (Kg)": "",
        "Total Weight (Kg)": `+${adj.quantity_kg}`,
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  const cols = Object.keys(rows[0]);
  if (format === "excel") {
    const firstKey = cols[0];
    const brandingRow = { [firstKey]: `${COMPANY}  |  Ink & Varnishes Outward Report  |  ${rangeLabel}` } as Record<string, string>;
    const ws = XLSX.utils.json_to_sheet([...rows, {} as Record<string, string>, brandingRow]);
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: "Ink & Varnishes Outward Report", Subject: rangeLabel, Company: COMPANY };
    XLSX.utils.book_append_sheet(wb, ws, "Ink Outward");
    XLSX.writeFile(wb, `ink-outward-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }
  const logoData = await getLogoBase64();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14); doc.setTextColor(41, 47, 54);
  doc.text(COMPANY, 14, 14);
  doc.setFontSize(11); doc.text("Ink & Varnishes Outward Report", 14, 21);
  doc.setFontSize(8); doc.setTextColor(143, 122, 110);
  doc.text(`Range: ${rangeLabel}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 33);
  autoTable(doc, {
    head: [cols], body: rows.map(r => cols.map(c => r[c])),
    startY: 38,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: [41, 47, 54] },
    headStyles: { fillColor: RUST, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: CREAM },
    margin: { left: 10, right: 10, bottom: 18 },
    didDrawPage: (data) => { addPdfFooter(doc, data.pageNumber, logoData); },
  });
  doc.save(`ink-outward-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function exportCTPOutward(entries: ExportCTPOutwardEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time),
        "Issued By": s(e.issued_by),
        "Received By": s(e.received_by),
        "Remarks": s(e.remarks),
        "Plate Size": s(item.plate_size),
        "Quantity Issued": s(item.quantity_issued),
      });
    }
    for (const adj of e.adjustments || []) {
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time),
        "Issued By": "[ADJUSTMENT]",
        "Received By": "",
        "Remarks": s(adj.reason),
        "Plate Size": s(adj.plate_size),
        "Quantity Issued": `+${adj.quantity}`,
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  const cols = Object.keys(rows[0]);
  if (format === "excel") {
    const firstKey = cols[0];
    const brandingRow = { [firstKey]: `${COMPANY}  |  CTP Plates Outward Report  |  ${rangeLabel}` } as Record<string, string>;
    const ws = XLSX.utils.json_to_sheet([...rows, {} as Record<string, string>, brandingRow]);
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: "CTP Plates Outward Report", Subject: rangeLabel, Company: COMPANY };
    XLSX.utils.book_append_sheet(wb, ws, "CTP Outward");
    XLSX.writeFile(wb, `ctp-outward-${new Date().toISOString().slice(0, 10)}.xlsx`);
    return;
  }
  const logoData = await getLogoBase64();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14); doc.setTextColor(41, 47, 54);
  doc.text(COMPANY, 14, 14);
  doc.setFontSize(11); doc.text("CTP Plates Outward Report", 14, 21);
  doc.setFontSize(8); doc.setTextColor(143, 122, 110);
  doc.text(`Range: ${rangeLabel}`, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, 14, 33);
  autoTable(doc, {
    head: [cols], body: rows.map(r => cols.map(c => r[c])),
    startY: 38,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", textColor: [41, 47, 54] },
    headStyles: { fillColor: RUST, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: CREAM },
    margin: { left: 10, right: 10, bottom: 18 },
    didDrawPage: (data) => { addPdfFooter(doc, data.pageNumber, logoData); },
  });
  doc.save(`ctp-outward-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportPaperOutward(entries: ExportPaperOutwardEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];
  for (const e of entries) {
    for (const item of e.items || []) {
      const qty = s(item.form_type) === "Reel Form"
        ? `${s(item.weight_issued)} Kg`
        : s(item.issue_method) === "sheets"
          ? `${s(item.sheets_issued)} Sheets`
          : `${s(item.weight_issued)} Kg (weight)`;
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time),
        "Job Name": s(e.job_name),
        "Job Card No.": s(e.job_card_number),
        "Issued By": s(e.issued_by),
        "Received By": s(e.received_by),
        "Remarks": s(e.remarks),
        "Quality": s(item.quality),
        "GSM": s(item.gsm),
        "Form Type": s(item.form_type),
        "Quantity Issued": qty,
        "Issue Method": s(item.issue_method) || (s(item.form_type) === "Reel Form" ? "weight" : ""),
      });
    }
    for (const adj of e.adjustments || []) {
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time),
        "Job Name": `[ADJUSTMENT] ${s(e.job_name)}`,
        "Job Card No.": s(e.job_card_number),
        "Issued By": "",
        "Received By": "",
        "Remarks": s(adj.reason),
        "Quality": s(adj.quality),
        "GSM": s(adj.gsm),
        "Form Type": s(adj.form_type),
        "Quantity Issued": `+${s(adj.quantity)} ${s(adj.unit)}`,
        "Issue Method": "adjustment",
      });
    }
  }
  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Paper Outward", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Paper Outward", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

// ─── Generic Outward (Chemicals / Adhesives / Consumables) ───────────────────

export function exportGenericOutward(
  entries: {
    outward_date: string;
    outward_time: string | null;
    issued_by: string | null;
    received_by: string | null;
    remarks: string | null;
    items: { item_name: string; quantity_issued: number; unit: string }[];
    adjustments: { item_name: string; quantity: number; unit: string; reason: string | null }[];
  }[],
  format: "pdf" | "excel",
  rangeLabel: string,
  moduleTitle: string,
): void {
  const rows: Record<string, string>[] = [];

  for (const e of entries) {
    for (const item of e.items) {
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time ?? ""),
        "Issued By": s(e.issued_by),
        "Received By": s(e.received_by),
        "Remarks": s(e.remarks),
        "Item Name": s(item.item_name),
        "Quantity Issued": fmtNum(item.quantity_issued),
        "Unit": s(item.unit),
      });
    }
    for (const adj of e.adjustments || []) {
      rows.push({
        "Date": fmtDate(e.outward_date),
        "Time": fmtTime(e.outward_time ?? ""),
        "Issued By": "[ADJUSTMENT]",
        "Received By": "",
        "Remarks": s(adj.reason),
        "Item Name": s(adj.item_name),
        "Quantity Issued": `+${fmtNum(adj.quantity)}`,
        "Unit": s(adj.unit),
      });
    }
  }

  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel(moduleTitle, rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF(moduleTitle, rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportPackingOutward(
  entries: {
    outward_date: string; outward_time: string | null;
    issued_by: string | null; received_by: string | null; remarks: string | null;
    items: { material_type: string; box_size: string | null; quantity_issued: number; unit: string }[];
    adjustments: { material_type: string; box_size: string | null; quantity: number; unit: string; reason: string | null }[];
  }[],
  format: "pdf" | "excel",
  rangeLabel: string,
): void {
  const rows: Record<string, string>[] = [];
  const moduleTitle = "Packing Materials Outward";

  function itemLabel(mt: string, bs: string | null) {
    return mt === "Printed Corrugated Boxes" && bs ? `Boxes (${bs})` : mt;
  }

  for (const e of entries) {
    for (const item of e.items) {
      rows.push({
        "Date": fmtDate(e.outward_date), "Time": fmtTime(e.outward_time ?? ""),
        "Issued By": s(e.issued_by), "Received By": s(e.received_by), "Remarks": s(e.remarks),
        "Material": itemLabel(item.material_type, item.box_size),
        "Qty Issued": fmtNum(item.quantity_issued, 0), "Unit": s(item.unit),
      });
    }
    for (const adj of e.adjustments || []) {
      rows.push({
        "Date": fmtDate(e.outward_date), "Time": fmtTime(e.outward_time ?? ""),
        "Issued By": "[ADJUSTMENT]", "Received By": "", "Remarks": s(adj.reason),
        "Material": itemLabel(adj.material_type, adj.box_size),
        "Qty Issued": `+${fmtNum(adj.quantity, 0)}`, "Unit": s(adj.unit),
      });
    }
  }

  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel(moduleTitle, rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF(moduleTitle, rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export function exportOilOutward(
  entries: {
    outward_date: string; outward_time: string | null;
    machine_name: string | null; issued_by: string | null; received_by: string | null; remarks: string | null;
    items: { item_name: string; quantity_issued: number; unit: string }[];
    adjustments: { item_name: string; quantity: number; unit: string; reason: string | null }[];
  }[],
  format: "pdf" | "excel",
  rangeLabel: string,
): void {
  const rows: Record<string, string>[] = [];
  const moduleTitle = "Oil & Lubrication Outward";

  for (const e of entries) {
    for (const item of e.items) {
      rows.push({
        "Date": fmtDate(e.outward_date), "Time": fmtTime(e.outward_time ?? ""),
        "Machine": s(e.machine_name), "Issued By": s(e.issued_by),
        "Received By": s(e.received_by), "Remarks": s(e.remarks),
        "Item": s(item.item_name), "Qty Issued": fmtNum(item.quantity_issued), "Unit": s(item.unit),
      });
    }
    for (const adj of e.adjustments || []) {
      rows.push({
        "Date": fmtDate(e.outward_date), "Time": fmtTime(e.outward_time ?? ""),
        "Machine": "", "Issued By": "[ADJUSTMENT]",
        "Received By": "", "Remarks": s(adj.reason),
        "Item": s(adj.item_name), "Qty Issued": `+${fmtNum(adj.quantity)}`, "Unit": s(adj.unit),
      });
    }
  }

  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel(moduleTitle, rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF(moduleTitle, rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

// ─── Micro Inward Export ─────────────────────────────────────────────────────

interface MicroExportPlateItem {
  item_number: unknown;
  plate_size: unknown;
  custom_length?: number | null;
  custom_width?: number | null;
  number_of_plates: unknown;
}

interface MicroExportChemicalItem {
  item_number: unknown;
  chemical_name: unknown;
  manufacturer?: unknown;
  item_total_quantity?: number | null;
}

interface MicroExportFilmItem {
  item_number: unknown;
  job_name: unknown;
  film_length?: unknown;
  film_width?: unknown;
  film_type: unknown;
  quantity: unknown;
}

export interface MicroExportEntry {
  inward_date: string;
  inward_time: string;
  supplier_name: unknown;
  invoice_number?: unknown;
  received_by: unknown;
  remarks?: unknown;
  material_type: "Plates" | "Chemicals" | "Films";
  plate_items?: MicroExportPlateItem[];
  chemical_items?: MicroExportChemicalItem[];
  film_items?: MicroExportFilmItem[];
}

export function exportMicroInward(entries: MicroExportEntry[], format: "pdf" | "excel", rangeLabel: string) {
  const rows: Record<string, string>[] = [];

  for (const e of entries) {
    const base = {
      "Date": fmtDate(e.inward_date),
      "Time": fmtTime(e.inward_time),
      "Supplier": s(e.supplier_name),
      "Invoice": s(e.invoice_number),
      "Received By": s(e.received_by),
      "Remarks": s(e.remarks),
      "Material Type": s(e.material_type),
    };

    if (e.material_type === "Plates" && e.plate_items?.length) {
      for (const item of e.plate_items) {
        rows.push({
          ...base,
          "Item #": s(item.item_number),
          "Plate Size": s(item.plate_size),
          "Custom L (mm)": item.custom_length != null ? s(item.custom_length) : "",
          "Custom W (mm)": item.custom_width != null ? s(item.custom_width) : "",
          "No. of Plates": s(item.number_of_plates),
          "Chemical Name": "",
          "Manufacturer": "",
          "Chem Total Qty": "",
          "Job Name": "",
          "Film L (mm)": "",
          "Film W (mm)": "",
          "Film Type": "",
          "Film Qty": "",
        });
      }
    } else if (e.material_type === "Chemicals" && e.chemical_items?.length) {
      for (const item of e.chemical_items) {
        rows.push({
          ...base,
          "Item #": s(item.item_number),
          "Plate Size": "",
          "Custom L (mm)": "",
          "Custom W (mm)": "",
          "No. of Plates": "",
          "Chemical Name": s(item.chemical_name),
          "Manufacturer": s(item.manufacturer),
          "Chem Total Qty": fmtNum(item.item_total_quantity, 3),
          "Job Name": "",
          "Film L (mm)": "",
          "Film W (mm)": "",
          "Film Type": "",
          "Film Qty": "",
        });
      }
    } else if (e.material_type === "Films" && e.film_items?.length) {
      for (const item of e.film_items) {
        rows.push({
          ...base,
          "Item #": s(item.item_number),
          "Plate Size": "",
          "Custom L (mm)": "",
          "Custom W (mm)": "",
          "No. of Plates": "",
          "Chemical Name": "",
          "Manufacturer": "",
          "Chem Total Qty": "",
          "Job Name": s(item.job_name),
          "Film L (mm)": item.film_length != null ? s(item.film_length) : "",
          "Film W (mm)": item.film_width != null ? s(item.film_width) : "",
          "Film Type": s(item.film_type),
          "Film Qty": s(item.quantity),
        });
      }
    } else {
      rows.push({
        ...base,
        "Item #": "",
        "Plate Size": "",
        "Custom L (mm)": "",
        "Custom W (mm)": "",
        "No. of Plates": "",
        "Chemical Name": "",
        "Manufacturer": "",
        "Chem Total Qty": "",
        "Job Name": "",
        "Film L (mm)": "",
        "Film W (mm)": "",
        "Film Type": "",
        "Film Qty": "",
      });
    }
  }

  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel("Micro Inward", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Micro Inward", rangeLabel, cols, rows.map((r) => cols.map((c) => r[c])));
}

export function exportDieMovement(
  entries: {
    movement_date: string; movement_time: string | null;
    die_number: string; job_name: string; ups: number; embossing: string; rubberized: string;
    issued_to: string; current_location: string | null;
    issued_by: string | null; received_by: string | null; remarks: string | null;
  }[],
  format: "pdf" | "excel",
  rangeLabel: string,
): void {
  const moduleTitle = "Dies Movement";
  const rows: Record<string, string>[] = entries.map((e) => ({
    "Date": fmtDate(e.movement_date), "Time": fmtTime(e.movement_time ?? ""),
    "Die No.": s(e.die_number), "Job Name": s(e.job_name),
    "UPS": s(e.ups), "Embossing": s(e.embossing), "Rubberized": s(e.rubberized),
    "Issued To": s(e.issued_to), "Current Location": s(e.current_location),
    "Issued By": s(e.issued_by), "Received By": s(e.received_by), "Remarks": s(e.remarks),
  }));

  if (!rows.length) { alert("No data to export for the selected range."); return; }
  if (format === "excel") { buildExcel(moduleTitle, rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF(moduleTitle, rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}

export interface LaminationExportEntry {
  inward_date: string;
  inward_time?: unknown;
  supplier_name: unknown;
  invoice_number?: unknown;
  received_by: unknown;
  film_type: unknown;
  custom_type?: unknown;
  film_length?: unknown;
  film_width?: unknown;
  remarks?: unknown;
  rolls?: { roll_number: unknown; original_weight: unknown; remaining_weight: unknown; is_consumed: unknown }[];
}

export function exportLaminationInward(entries: LaminationExportEntry[], format: "pdf" | "excel", rangeLabel: string) {
  // Max roll count among entries with ≤5 rolls — determines how many individual columns to add
  const maxSmallRolls = Math.max(0, ...entries.map((e) => {
    const n = e.rolls?.length ?? 0;
    return n <= 5 ? n : 0;
  }));

  const rows: Record<string, string>[] = entries.map((e) => {
    const rolls = e.rolls ?? [];
    const totalWt = rolls.reduce((sum, r) => sum + Number(r.original_weight || 0), 0);
    const isSmall = rolls.length <= 5;
    const row: Record<string, string> = {
      "Date": fmtDate(e.inward_date),
      "Time": fmtTime(e.inward_time as string),
      "Supplier": s(e.supplier_name),
      "Invoice": s(e.invoice_number),
      "Received By": s(e.received_by),
      "Film Type": e.film_type === "OTHER" && e.custom_type ? s(e.custom_type) : s(e.film_type),
      "Length (mm)": e.film_length != null ? s(e.film_length) : "",
      "Width (mm)": e.film_width != null ? s(e.film_width) : "",
      "No. of Rolls": String(rolls.length),
    };
    // Individual roll weight columns — filled only for entries with ≤5 rolls
    if (maxSmallRolls > 0) {
      for (let i = 1; i <= maxSmallRolls; i++) {
        const r = isSmall ? rolls.find((r) => Number(r.roll_number) === i) : undefined;
        row[`Roll ${i} Wt (kg)`] = r ? Number(r.original_weight).toFixed(3) : "";
      }
    }
    row["Total Wt (kg)"] = totalWt ? totalWt.toFixed(3) : "";
    row["Remarks"] = s(e.remarks);
    return row;
  });

  if (!rows.length) { alert("No data to export."); return; }
  if (format === "excel") { buildExcel("Lamination Film Inward", rangeLabel, rows); return; }
  const cols = Object.keys(rows[0]);
  buildPDF("Lamination Film Inward", rangeLabel, cols, rows.map(r => cols.map(c => r[c])));
}
