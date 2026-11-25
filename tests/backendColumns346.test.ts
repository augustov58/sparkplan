/**
 * #346: the Python backend read columns that don't exist (projects.voltage /
 * phases / service_size, panels.phases / main_breaker_rating, feeders.length_feet
 * …) and fell back to defaults, so every service was 240 V 1-phase. CI runs only
 * these tests, so this one checks the backend's row reads against the database
 * types: every `project|panel|feeder|circuit.get('key')` names a real column.
 *
 * Covers rows held in variables with those names; a row in a short name
 * (`p`, `f`, `c`) isn't checked. Name a DB row after its table.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const TABLE_OF: Record<string, string> = { project: 'projects', panel: 'panels', feeder: 'feeders', circuit: 'circuits' };

function columns(table: string): Set<string> {
  const src = readFileSync('lib/database.types.ts', 'utf8');
  const row = new RegExp(`\\n      ${table}: \\{\\n        Row: \\{\\n([\\s\\S]*?)\\n        \\}`).exec(src);
  if (!row) throw new Error(`no Row type for ${table}`);
  return new Set([...row[1]!.matchAll(/^\s{10}(\w+)\??:/gm)].map(m => m[1]!));
}

function pythonFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? (e.name === '__pycache__' || e.name === 'tests' ? [] : pythonFiles(join(dir, e.name)))
      : e.name.endsWith('.py') ? [join(dir, e.name)] : []);
}

describe('#346 backend column reads', () => {
  const cols = Object.fromEntries(Object.values(TABLE_OF).map(t => [t, columns(t)]));
  const reads = pythonFiles('backend').flatMap(file =>
    readFileSync(file, 'utf8').split('\n').flatMap((line, i) =>
      [...line.matchAll(/\b(project|panel|feeder|circuit)(?:\.get\(|\[)['"](\w+)['"]/g)].map(m => ({
        where: `${file}:${i + 1}`, table: TABLE_OF[m[1]!]!, key: m[2]!,
      }))));

  it('finds the reads it checks (guard for the scan itself)', () => {
    expect(reads.length).toBeGreaterThan(20);
    expect(reads.some(r => r.table === 'projects' && r.key === 'service_voltage')).toBe(true);
  });

  it('every read names a column of its table', () => {
    const unknown = reads.filter(r => !cols[r.table]!.has(r.key)).map(r => `${r.where} ${r.table}.${r.key}`);
    expect(unknown).toEqual([]); // main: projects.voltage, projects.phases, panels.phases, panels.spaces, …
  });
});
