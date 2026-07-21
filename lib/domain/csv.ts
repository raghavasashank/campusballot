const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_CSV_BYTES = 500 * 1024;
const MAX_ROWS = 2000;

export type CsvParseError = { line: number; raw: string; reason: string };
export type CsvParseResult = {
  emails: string[];
  duplicates: string[];
  errors: CsvParseError[];
};

function wholeFileError(reason: string): CsvParseResult {
  return { emails: [], duplicates: [], errors: [{ line: 0, raw: "", reason }] };
}

// Minimal roster format: a header row with an "email" column (any position,
// case-insensitive) plus optional other columns (e.g. "name"), then one
// student per line. ponytail: no quoted-field/RFC4180 support — a plain
// comma split is enough for a roster of bare emails; add a real CSV parser
// if rosters start containing commas inside fields.
export function parseStudentRosterCsv(csv: string): CsvParseResult {
  if (csv.length > MAX_CSV_BYTES) {
    return wholeFileError(`CSV exceeds the ${MAX_CSV_BYTES / 1024}KB size limit.`);
  }

  const lines = csv.split(/\r\n|\r|\n/);
  const headerLine = lines[0] ?? "";
  const headerCells = headerLine.split(",").map((c) => c.trim().toLowerCase());
  const emailIndex = headerCells.indexOf("email");

  if (emailIndex === -1) {
    return wholeFileError("CSV must have a header row with an \"email\" column");
  }

  const dataLineCount = lines.slice(1).filter((l) => l.trim() !== "").length;
  if (dataLineCount > MAX_ROWS) {
    return wholeFileError(`CSV exceeds the ${MAX_ROWS}-row limit.`);
  }

  const emails: string[] = [];
  const duplicates: string[] = [];
  const errors: CsvParseError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "") continue;

    const cells = raw.split(",").map((c) => c.trim());
    if (cells.length <= emailIndex || cells[emailIndex] === "") {
      errors.push({ line: i + 1, raw, reason: "missing email column" });
      continue;
    }

    const email = cells[emailIndex].toLowerCase();
    if (!EMAIL_RE.test(email)) {
      errors.push({ line: i + 1, raw, reason: "invalid email format" });
      continue;
    }

    if (seen.has(email)) {
      if (!duplicates.includes(email)) duplicates.push(email);
      continue;
    }
    seen.add(email);
    emails.push(email);
  }

  return { emails, duplicates, errors };
}
