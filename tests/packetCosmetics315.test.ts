/**
 * #315 (owner ruling 2026-11-24): packet cosmetics.
 * 1. E-202 prints the main breaker with its unit ("800A"); MLO stays.
 * 2. E-201 appends " (MDP)" to a main panel's title only when its name doesn't say MDP.
 * 4. E-201 prints a node's "AIC N kA" in the node's normal dark text, not dark red.
 * 6. The packet filename uses the local date (the day the pages print).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { EquipmentSchedule, RiserDiagram } from '../services/pdfExport/PermitPacketDocuments';
import { localDateStamp } from '../services/pdfExport/permitPacketGenerator';

/** Every string in the tree, expanding function components (these pages are pure). */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (React.isValidElement(node)) {
    const { type, props } = node as React.ReactElement<{ children?: React.ReactNode }>;
    if (typeof type === 'function' && !(type.prototype && type.prototype.isReactComponent)) {
      return textOf((type as (p: unknown) => React.ReactNode)(props));
    }
    return textOf(props.children);
  }
  return '';
}

/** The style of the element whose own text is exactly `text`. */
function styleOf(node: React.ReactNode, text: string): Record<string, unknown> | undefined {
  if (node === null || node === undefined || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    for (const n of node) { const s = styleOf(n, text); if (s) return s; }
    return undefined;
  }
  if (!React.isValidElement(node)) return undefined;
  const { type, props } = node as React.ReactElement<{ children?: React.ReactNode; style?: Record<string, unknown> }>;
  if (typeof type === 'function' && !(type.prototype && type.prototype.isReactComponent)) {
    return styleOf((type as (p: unknown) => React.ReactNode)(props), text);
  }
  if (props.children === text && props.style) return props.style;
  return styleOf(props.children, text);
}

const panel = (over: Record<string, unknown>): any => ({
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 480, phase: 3, bus_rating: 800, main_breaker_amps: 800,
  is_main: true, aic_rating: null, location: null, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
  fed_from_meter_stack_id: null, fed_from_circuit_number: null, feeder_breaker_amps: null, ...over,
});

const riser = (panels: any[]) => React.createElement(RiserDiagram, {
  panels, transformers: [], feeders: [], projectName: 'QA', serviceVoltage: 480, servicePhase: 3,
} as any);

describe('#315 packet cosmetics', () => {
  it('E-202 prints the main breaker as 800A, and MLO without a unit', () => {
    const text = textOf(React.createElement(EquipmentSchedule, {
      panels: [panel({}), panel({ id: 'lp1', name: 'LP-1', is_main: false, main_breaker_amps: null, bus_rating: 225 })],
      transformers: [], feeders: [], projectName: 'QA',
    }));
    // JSX children split "{v}V" into "480 V"; the breaker is one string
    expect(text).toMatch(/MDP 480 V 3Ø 800 A 800A N\/A/); // main: "800 A 800 N/A"
    expect(text).toMatch(/LP-1 480 V 3Ø 225 A MLO N\/A/);
    expect(text).not.toContain('MLOA');
  });

  it('E-201 names a main panel called MDP once; another name gets " (MDP)"', () => {
    expect(textOf(riser([panel({})]))).not.toContain('MDP (MDP)'); // main: MDP (MDP)
    expect(textOf(riser([panel({ name: 'Main Panel' })]))).toContain('Main Panel (MDP)');
    expect(textOf(riser([panel({ name: 'MDP-1' })]))).not.toContain('MDP-1 (MDP)');
  });

  it("E-201 prints AIC 42 kA in the node's dark text, like the panel name", () => {
    const tree = riser([panel({ aic_rating: 42 })]);
    const aic = styleOf(tree, 'AIC 42 kA');
    const name = styleOf(tree, 'MDP');
    expect(aic).toBeDefined();
    expect(aic!.color).not.toBe('#7c2d12'); // main: dark red
    expect(aic!.color).toBe(name!.color);
  });

  it('the filename date is the local day, not the UTC day', () => {
    expect(localDateStamp(new Date(2026, 10, 23, 23, 30))).toBe('2026-11-23'); // 11:30 PM local
    expect(localDateStamp(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});
