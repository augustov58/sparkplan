/**
 * #321 (owner ruling 2026-11-24): Material Take-Off
 * - outlet boxes (60 %) and junction boxes (20 %) from the 1-pole circuits
 *   only, rounded down: Retail 11 one-pole → 6 and 2; Office and Workshop
 *   (feeder and equipment circuits only) → 0 and 0 (main: 7/2, 1/0, 3/1 from
 *   all circuits);
 * - the CSV export escapes cells per RFC 4180, so 3/4" stays in one cell.
 */
import { describe, it, expect } from 'vitest';
import { boxEstimate } from '../services/calculations/racewayFill';
import { csvRow } from '../lib/csv';
import { commercialTemplates, industrialTemplates } from '../data/project-templates';

const template = (name: string) => {
  const t = [...commercialTemplates, ...industrialTemplates].find((x) => x.name === name);
  if (!t) throw new Error(`template ${name} missing`);
  return t.panels.flatMap((p) => p.circuits ?? []);
};

/** A minimal RFC 4180 reader: quoted fields, "" inside them, commas. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

describe('#321 boxes from 1-pole circuits only', () => {
  it('Retail: 11 one-pole of 13 circuits → 6 outlet boxes, 2 junction boxes (main 7, 2)', () => {
    const circuits = template('Retail Store (2500 sq ft)');
    expect(circuits).toHaveLength(13);
    expect(boxEstimate(circuits)).toEqual({ onePoleCircuits: 11, outletBoxes: 6, junctionBoxes: 2 });
  });

  it('Office and Workshop: feeder / equipment circuits only → no boxes (main 1/0 and 3/1)', () => {
    expect(boxEstimate(template('Office Building (5000 sq ft)'))).toEqual({ onePoleCircuits: 0, outletBoxes: 0, junctionBoxes: 0 });
    expect(boxEstimate(template('Small Workshop/Light Manufacturing'))).toEqual({ onePoleCircuits: 0, outletBoxes: 0, junctionBoxes: 0 });
  });

  it('rounds down: 4 one-pole → 2 outlet, 0 junction; 5 → 3, 1', () => {
    expect(boxEstimate([1, 1, 1, 1, 3].map((pole) => ({ pole })))).toEqual({ onePoleCircuits: 4, outletBoxes: 2, junctionBoxes: 0 });
    expect(boxEstimate([1, 1, 1, 1, 1].map((pole) => ({ pole })))).toEqual({ onePoleCircuits: 5, outletBoxes: 3, junctionBoxes: 1 });
  });
});

describe('#321 CSV cells per RFC 4180', () => {
  it('doubles a quote inside a cell, so 3/4" reads back as one cell', () => {
    const line = csvRow(['Conduit', 'EMT Conduit', '3/4"', 1, 'sticks', '1 circuit @ ~10ft, 40% fill']);
    expect(line).toBe('Conduit,EMT Conduit,"3/4""",1,sticks,"1 circuit @ ~10ft, 40% fill"'); // main: "3/4"" (unescaped)
    expect(parseCsvLine(line)).toEqual(['Conduit', 'EMT Conduit', '3/4"', '1', 'sticks', '1 circuit @ ~10ft, 40% fill']);
  });

  it('keeps 5/8" x 8ft in one cell and empty values empty', () => {
    const cells = parseCsvLine(csvRow(['Grounding', 'Ground Rod (8ft)', '5/8" x 8ft', 2, 'ea', null]));
    expect(cells).toEqual(['Grounding', 'Ground Rod (8ft)', '5/8" x 8ft', '2', 'ea', '']);
  });
});
