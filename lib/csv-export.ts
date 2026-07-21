// A cell starting with =, +, -, or @ is interpreted as a formula by Excel/
// Sheets when the CSV is opened — prefixing with a quote defuses it while
// keeping the value readable. See the security review: candidate names/bios
// flow into these exports and are not otherwise trusted input.
const FORMULA_TRIGGER_RE = /^[=+\-@]/;

function escapeCsvCell(value: string): string {
  const safe = FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], columns: { key: keyof T; header: string }[]) {
  const lines = [columns.map((c) => c.header).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(String(row[c.key] ?? ""))).join(","));
  }
  return lines.join("\r\n");
}

export function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
