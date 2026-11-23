/**
 * #287 (owner ruling 2026-11-22): the riser legend defines AIC as the
 * equipment's interrupting rating, "Ampere Interrupting Capacity (equipment
 * interrupting rating, NEC 110.9)" — not "Available Interrupting Current",
 * which is the other side of the 110.9 comparison (the available fault current).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { RiserDiagram } from '../services/pdfExport/PermitPacketDocuments';

/** Every string in the tree, expanding function components (the riser's are pure). */
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

const mdp: any = {
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 480, phase: 3, bus_rating: 800, main_breaker_amps: 800,
  is_main: true, aic_rating: null, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
  fed_from_meter_stack_id: null, fed_from_circuit_number: null, feeder_breaker_amps: null,
};

describe('#287 riser legend', () => {
  it('defines AIC as the equipment interrupting rating', () => {
    const text = textOf(React.createElement(RiserDiagram, {
      panels: [mdp], transformers: [], feeders: [], projectName: 'QA Short circuit', serviceVoltage: 480, servicePhase: 3,
    } as any));
    expect(text).toContain('AIC = Ampere Interrupting Capacity (equipment interrupting rating, NEC 110.9)');
    expect(text).not.toContain('Available Interrupting Current');
  });
});
