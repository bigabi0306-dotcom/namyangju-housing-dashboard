/** RFC4180 수준의 간이 CSV 파서 (따옴표·줄바꿈·BOM 처리) */
export function parseCSV(text: string): Record<string, string>[] {
  const t = text.replace(/^﻿/, '');
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some((c) => c.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
