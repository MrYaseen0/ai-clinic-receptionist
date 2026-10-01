import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { loadDb, statusLabel } from "@/lib/lab-store";
import { CLINIC } from "@/lib/doctors";
import { seedIfEmpty } from "@/lib/lab-seed";

export const dynamic = "force-dynamic";

/** Draw a simple deterministic barcode from the order id. */
function drawBarcode(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number
) {
  const black = rgb(0, 0, 0);
  let cx = x;
  for (const ch of text) {
    const w = 1 + (ch.charCodeAt(0) % 3);
    page.drawRectangle({ x: cx, y, width: w, height: 34, color: black });
    cx += w + 1.6;
  }
  return cx;
}

/** Real PDF lab report for approved/released orders. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(req);
  if (isRateLimited(`lab-pdf:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  await seedIfEmpty();

  const db = await loadDb();
  const order = db.orders.find((o) => o.id === params.id);
  if (!order)
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "approved" && order.status !== "report_released")
    return NextResponse.json(
      { error: "Report is only available after pathologist approval." },
      { status: 422 }
    );

  const patient = db.patients.find((p) => p.id === order.patientId);
  const tests = order.testIds
    .map((tid) => db.tests.find((t) => t.id === tid))
    .filter(Boolean);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const W = 595;
  const M = 44;
  let y = 800;
  const teal = rgb(0.05, 0.45, 0.55);
  const dark = rgb(0.15, 0.15, 0.15);
  const grey = rgb(0.45, 0.45, 0.45);
  const red = rgb(0.75, 0.1, 0.1);

  const text = (
    s: string,
    x: number,
    yy: number,
    size = 10,
    f = font,
    color = dark
  ) => page.drawText(s, { x, y: yy, size, font: f, color });

  // Header
  text(CLINIC.name + " — Diagnostic Laboratory", M, y, 15, bold, teal);
  y -= 16;
  text(`${CLINIC.address} | ${CLINIC.phone}`, M, y, 9, font, grey);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.5, color: teal });
  y -= 22;
  text("LABORATORY REPORT", M, y, 14, bold);
  text(`Status: ${statusLabel(order.status)}`, W - M - 150, y, 10, font, grey);
  y -= 26;

  // Patient + order box
  const box = (label: string, value: string, x: number, yy: number) => {
    text(label, x, yy, 8, font, grey);
    text(value, x, yy - 13, 10, bold);
  };
  box("Patient", patient?.name || "—", M, y);
  box("Patient ID", patient?.serial || "—", M + 200, y);
  box("Age / Gender", `${patient?.age ?? "—"} / ${patient?.gender ?? "—"}`, M + 330, y);
  y -= 30;
  box("Order No", order.id, M, y);
  box("Sample Date", order.sampleDate, M + 200, y);
  box("Referring Doctor", order.referringDoctor || "—", M + 330, y);
  y -= 30;
  box("Priority", order.priority.toUpperCase(), M, y);
  box("Phone", patient?.phone || "—", M + 200, y);
  // Barcode
  drawBarcode(page, order.barcode, M + 330, y - 8);
  text(order.barcode, M + 330, y - 20, 8, font, grey);
  y -= 44;

  // Results
  let hasCritical = false;
  for (const t of tests) {
    if (!t) continue;
    if (y < 170) {
      // (single-page demo: stop gracefully rather than paginate)
      text("… continued results available in the lab system.", M, y, 9, font, grey);
      break;
    }
    text(`${t.code} — ${t.name}`, M, y, 11, bold, teal);
    y -= 16;
    // table header
    text("Parameter", M, y, 9, bold, grey);
    text("Result", M + 200, y, 9, bold, grey);
    text("Unit", M + 280, y, 9, bold, grey);
    text("Reference Range", M + 350, y, 9, bold, grey);
    text("Flag", M + 480, y, 9, bold, grey);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: grey });
    y -= 14;
    for (const p of t.params) {
      const entries = order.results[t.id] || [];
      const e = entries.find((x) => x.paramKey === p.key);
      const val = e ? String(e.value) : "—";
      const flag = e && e.flag !== "N" ? e.flag : "";
      if (e && (e.flag === "CL" || e.flag === "CH")) hasCritical = true;
      const color = e && (e.flag === "CL" || e.flag === "CH") ? red : dark;
      text(p.name.slice(0, 30), M, y, 9, font, color);
      text(val, M + 200, y, 9, bold, color);
      text(p.unit, M + 280, y, 9, font, color);
      text(`${p.refLow} – ${p.refHigh}`, M + 350, y, 9, font, color);
      if (flag) text(flag, M + 480, y, 9, bold, flag === "L" || flag === "H" ? teal : red);
      y -= 15;
    }
    y -= 8;
  }

  if (hasCritical) {
    text("CRITICAL values are highlighted in red — clinical correlation advised.", M, y, 9, bold, red);
    y -= 20;
  }
  text("Flags: N = Normal, L = Low, H = High, CL = Critical Low, CH = Critical High", M, y, 8, font, grey);
  y -= 18;

  if (order.reviewNote) {
    text("Pathologist note:", M, y, 9, bold);
    y -= 13;
    text(order.reviewNote.slice(0, 120), M, y, 9, font);
    y -= 18;
  }

  // Footer
  page.drawLine({ start: { x: M, y: 90 }, end: { x: W - M, y: 90 }, thickness: 0.8, color: grey });
  text(`Reviewed by: ${order.reviewedBy || "—"}`, M, 72, 9, font, grey);
  text(`Generated: ${new Date().toLocaleString("en-GB")}`, M, 58, 9, font, grey);
  text("This is a computer-generated report.", M, 44, 8, font, grey);

  const bytes = await doc.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.id}-report.pdf"`,
      "Content-Length": String(bytes.length),
    },
  });
}
