/**
 * #313 (owner ruling 2026-11-23): panels.aic_rating is stored in kA. The
 * Equipment Specs form saves 42 for "42 kA"; the packet printed it as
 * "0.0 kA" because its formatter divided by 1,000. These tests feed the pages
 * the value the form saves and assert the text the AHJ reads.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { RiserDiagram } from '../services/pdfExport/PermitPacketDocuments';
import { EquipmentSpecsPages } from '../services/pdfExport/EquipmentSpecsDocuments';

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

// "QA Short circuit": MDP 800 A, 480 V 3Φ, AIC rating 42 kA as the form saves it.
const mdp: any = {
  id: 'mdp', project_id: 'p', name: 'MDP', voltage: 480, phase: 3, bus_rating: 800, main_breaker_amps: 800,
  is_main: true, aic_rating: 42, fed_from: null, fed_from_type: 'service', fed_from_transformer_id: null,
  fed_from_meter_stack_id: null, fed_from_circuit_number: null, feeder_breaker_amps: null,
};

describe('#313 AIC rating stored in kA', () => {
  it('E-201 riser prints the MDP node as AIC 42 kA', () => {
    const text = textOf(React.createElement(RiserDiagram, {
      panels: [mdp], transformers: [], feeders: [], projectName: 'QA Short circuit', serviceVoltage: 480, servicePhase: 3,
    } as any));
    expect(text).toContain('AIC 42 kA');
    expect(text).not.toContain('0.0 kA'); // main: AIC 0.0 kA
  });

  it('Equipment Specs sheet prints the MDP AIC column as 42 kA', () => {
    const text = textOf(React.createElement(EquipmentSpecsPages, {
      projectName: 'QA Short circuit', panels: [mdp], transformers: [], circuits: [],
    } as any));
    expect(text).toContain('42 kA');
    expect(text).not.toContain('0.0 kA'); // main: 0.0 kA
  });
});
