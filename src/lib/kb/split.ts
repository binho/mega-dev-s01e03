// Splits the reports merged into one ticket by the problem each one describes.
// causes.ts places a report by tenant and channel; it has no place for a date that moved by one
// day, so those reports sat under `parser` with a footnote. Here they are a problem of their own.
import notes from '#lib/data/desk-notes.json';
import { causeOf, uniqueById, type Report, type Tenant } from '#lib/kb/causes';

export type Problem = 'parser' | 'hint' | 'shift' | 'unplaced';

export const PROBLEMS: Record<Problem, string> = {
  parser: 'shared parser reads day-first dates month first',
  hint: 'booking-v3 form hint says MM/DD, form reads the tenant’s DD/MM',
  shift: 'date moves by one day (time zone), not a month flip',
  unplaced: 'no tenant on file, or tenant writes month first',
};

const oneDayMove = new Set<string>(notes.oneDayMove);

export function problemOf(r: Report, t: Tenant | undefined): Problem {
  if (oneDayMove.has(r.id)) return 'shift';
  return causeOf(r, t) ?? 'unplaced';
}

export type ProblemGroup = {
  problem: Problem;
  ids: string[];
  tenants: string[];
  firstSeen: string;
  lastSeen: string;
};

export function splitTicket(reports: Report[], ticket: number, tenantOf: (r: Report) => Tenant | undefined): { total: number; groups: ProblemGroup[] } {
  const merged = uniqueById(reports).filter((r) => r.mergedInto === ticket);
  const by = new Map<Problem, Report[]>();
  for (const r of merged) {
    const p = problemOf(r, tenantOf(r));
    by.set(p, [...(by.get(p) ?? []), r]);
  }
  const groups = [...by.entries()]
    .map(([problem, rs]) => {
      const days = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
      return {
        problem,
        ids: rs.map((r) => r.id).sort(),
        tenants: [...new Set(rs.map((r) => r.tenant))].sort(),
        firstSeen: days[0],
        lastSeen: days[days.length - 1],
      };
    })
    .sort((a, b) => b.ids.length - a.ids.length);
  return { total: merged.length, groups };
}
