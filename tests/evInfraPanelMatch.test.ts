/**
 * QA 2026-10-14 finding #26 — "Add EV Infrastructure" re-runs must replace
 * only the EV panel it generated earlier.
 *
 * Pre-fix, addEVInfrastructure deleted every panel matching
 * `name ILIKE '%ev%'`. The MDP is named `${buildingName} MDP`, so a building
 * called "... + EV" (or "Seven Oaks", "Riverview", "Levy") had its MDP, the
 * MDP's circuits and its incoming feeder deleted; "Elevator Panel" went too.
 */
import { describe, it, expect } from 'vitest';
import { selectEVPanelIdsToReplace } from '../services/autogeneration/multiFamilyProjectGenerator';

const panels = [
  { id: 'mdp', name: 'Seven Oaks + EV MDP', is_main: true },
  { id: 'house', name: 'House Panel', is_main: false },
  { id: 'elev', name: 'Elevator Panel', is_main: false },
  { id: 'unit', name: 'Unit 101 Panel', is_main: false },
  { id: 'ev', name: 'EV Sub-Panel', is_main: false },
  { id: 'evEmpty', name: 'EV Panel (Empty)', is_main: false },
  { id: 'renamed', name: 'Garage Chargers', is_main: false },
];

describe('#26 selectEVPanelIdsToReplace', () => {
  it('selects only generated EV panels, never panels that merely contain "ev"', () => {
    expect(selectEVPanelIdsToReplace(panels, []).sort()).toEqual(['ev', 'evEmpty']);
  });

  it('also selects a renamed EV panel via its EV meter link', () => {
    expect(selectEVPanelIdsToReplace(panels, ['renamed', null]).sort()).toEqual(['ev', 'evEmpty', 'renamed']);
  });

  it('never selects the main panel, even if an EV meter points at it', () => {
    expect(selectEVPanelIdsToReplace(panels, ['mdp'])).not.toContain('mdp');
  });
});
