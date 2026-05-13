/**
 * Sprint 2B PR-4 — Orlando manifest end-to-end test.
 *
 * Closes H5 / H6 / H7 / H8 / H16 by verifying that:
 *   1. Generating a packet with manifest: orlandoManifest applies Orlando's
 *      generalNotes + codeReferences (not Sprint 2A's static FL-pilot stack).
 *   2. The sheet ID prefix is 'E-' (Orlando default).
 *   3. Upload-slot visibility reflects Orlando.relevantArtifactTypes:
 *      site_plan / cut_sheet / fire_stopping / noc / manufacturer_data /
 *      hvhz_anchoring ON; hoa_letter / survey / Sprint-2C-reserved types OFF.
 *   4. Section toggles respect Orlando.relevantSections + predicates:
 *      nec22087Narrative ON only on existing-service path; availableFaultCurrent
 *      ON only on new-service path; grounding ON only on new-service path;
 *      arcFlash OFF (not in Orlando.relevantSections).
 *
 * These assertions are pure-function: built on top of computeDefaultVisibility
 * + the manifest module, NOT the full PDF render path (which is exercised by
 * tests/permitPacketE2E.test.ts and is too heavy for a per-AHJ smoke test).
 */
import { describe, it, expect } from 'vitest';
import { orlandoManifest } from '../data/ahj/orlando';
import {
  computeDefaultVisibility,
  applyUserOverrides,
  toPacketSectionsPartial,
} from '../data/ahj/visibility';
import { findManifestForJurisdiction, getManifestById } from '../data/ahj/registry';
import { resolveSections } from '../services/pdfExport/packetSections';
import type { AHJContext } from '../data/ahj/types';

// ----------------------------------------------------------------------------
// Test contexts — both Orlando paths
// ----------------------------------------------------------------------------

const orlandoExisting: AHJContext = {
  scope: 'existing-service',
  lane: 'contractor_exemption',
  buildingType: 'single_family_residential',
};

const orlandoNewServiceCommercial: AHJContext = {
  scope: 'new-service',
  lane: 'pe_required',
  buildingType: 'commercial',
};

// ----------------------------------------------------------------------------
// Manifest content
// ----------------------------------------------------------------------------

describe('Orlando manifest — narrative content', () => {
  it('has Orlando-specific general notes (NEC 2020 + VD 3/3/5 + EVSE UL listings)', () => {
    const notes = orlandoManifest.generalNotes.join(' ');
    expect(notes).toMatch(/NFPA-70\s*\(2020 NEC\)/);
    expect(notes).toMatch(/3%/); // VD limits
    expect(notes).toMatch(/UL-2202/); // EVSE UL listing requirement
    expect(notes).toMatch(/UL-2594/);
    expect(notes).toMatch(/firestop/i); // Orlando #8
  });

  it('cites Orlando City Code Chapter 14 in code references', () => {
    expect(orlandoManifest.codeReferences).toContain(
      'Orlando City Code, Chapter 14 (Electrical)',
    );
    expect(orlandoManifest.codeReferences).toContain('NFPA-70 (2020 NEC)');
    expect(orlandoManifest.codeReferences).toContain(
      'Florida Building Code, 8th edition (2023)',
    );
  });

  it('uniformly cites NEC 2020 across all building types (no H34 fork for Orlando)', () => {
    expect(orlandoManifest.necEdition.single_family_residential).toBe('NEC 2020');
    expect(orlandoManifest.necEdition.multi_family).toBe('NEC 2020');
    expect(orlandoManifest.necEdition.commercial).toBe('NEC 2020');
  });

  it('uses default sheet ID prefix E- (Orlando convention)', () => {
    expect(orlandoManifest.sheetIdPrefix).toBe('E-');
  });

  it('declares no subjurisdiction (Orlando is a single AHJ)', () => {
    expect(orlandoManifest.subjurisdiction).toBeUndefined();
  });

  it('has requirements: [] (Sprint 2C M1 will populate)', () => {
    expect(orlandoManifest.requirements).toEqual([]);
  });
});

// ----------------------------------------------------------------------------
// Artifact-type visibility (closes H5 / H6 / H7 / H8 / H16 per-AHJ wiring)
// ----------------------------------------------------------------------------

describe('Orlando manifest — artifact upload slot visibility', () => {
  it('H5 NOC: ON for non-SFR (FL Statute 713 >$5k)', () => {
    const sfr = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    const commercial = computeDefaultVisibility(
      orlandoManifest,
      orlandoNewServiceCommercial,
    );
    expect(sfr.artifactTypes.noc).toBe(false);
    expect(commercial.artifactTypes.noc).toBe(true);
  });

  it('H6 HOA letter: OFF (Pompano-only — Orlando does not require)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.artifactTypes.hoa_letter).toBe(false);
  });

  it('H7 site plan: ON (required by all 5 FL AHJs)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.artifactTypes.site_plan).toBe(true);
  });

  it('H8 cut_sheet + manufacturer_data: ON (Orlando #7 EVSE UL listings)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.artifactTypes.cut_sheet).toBe(true);
    expect(v.artifactTypes.manufacturer_data).toBe(true);
  });

  it('H16 fire_stopping: ON (Orlando #8 both paths)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.artifactTypes.fire_stopping).toBe(true);
  });

  it('H19 hvhz_anchoring: ON (statewide for outdoor EVSE)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.artifactTypes.hvhz_anchoring).toBe(true);
  });

  it('Sprint 2C reserved artifacts: OFF by default', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.artifactTypes.zoning_application).toBe(false);
    expect(v.artifactTypes.fire_review_application).toBe(false);
    expect(v.artifactTypes.notarized_addendum).toBe(false);
    expect(v.artifactTypes.property_ownership_search).toBe(false);
    expect(v.artifactTypes.flood_elevation_certificate).toBe(false);
    expect(v.artifactTypes.private_provider_documentation).toBe(false);
  });
});

// ----------------------------------------------------------------------------
// Section visibility — Orlando matrix line-by-line
// ----------------------------------------------------------------------------

describe('Orlando manifest — section visibility forks on scope', () => {
  it('existing-service path: nec22087Narrative ON, availableFaultCurrent OFF', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.sections.nec22087Narrative).toBe(true);
    expect(v.sections.availableFaultCurrent).toBe(false);
  });

  it('new-service path: nec22087Narrative OFF, availableFaultCurrent ON', () => {
    const v = computeDefaultVisibility(
      orlandoManifest,
      orlandoNewServiceCommercial,
    );
    expect(v.sections.nec22087Narrative).toBe(false);
    expect(v.sections.availableFaultCurrent).toBe(true);
  });

  it('new-service path: grounding ON (Orlando #6 new-service)', () => {
    const v = computeDefaultVisibility(
      orlandoManifest,
      orlandoNewServiceCommercial,
    );
    expect(v.sections.grounding).toBe(true);
  });

  it('existing-service path: grounding OFF (existing grounding stays)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.sections.grounding).toBe(false);
  });

  it('arcFlash OFF (not in Orlando.relevantSections — user can override)', () => {
    const v = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    expect(v.sections.arcFlash).toBe(false);
  });

  it('common sections always ON regardless of scope', () => {
    const existing = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    const newService = computeDefaultVisibility(
      orlandoManifest,
      orlandoNewServiceCommercial,
    );
    for (const v of [existing, newService]) {
      expect(v.sections.tableOfContents).toBe(true);
      expect(v.sections.generalNotes).toBe(true);
      expect(v.sections.revisionLog).toBe(true);
      expect(v.sections.loadCalculation).toBe(true);
      expect(v.sections.voltageDrop).toBe(true);
      expect(v.sections.riserDiagram).toBe(true);
      expect(v.sections.equipmentSchedule).toBe(true);
      expect(v.sections.equipmentSpecs).toBe(true);
      expect(v.sections.panelSchedules).toBe(true);
      expect(v.sections.complianceSummary).toBe(true);
      expect(v.sections.jurisdiction).toBe(true);
    }
  });
});

// ----------------------------------------------------------------------------
// Registry lookup
// ----------------------------------------------------------------------------

describe('Manifest registry', () => {
  it('getManifestById("orlando") returns the Orlando manifest', () => {
    expect(getManifestById('orlando')).toBe(orlandoManifest);
  });

  it('getManifestById is case-insensitive', () => {
    expect(getManifestById('Orlando')).toBe(orlandoManifest);
    expect(getManifestById('ORLANDO')).toBe(orlandoManifest);
  });

  it('returns null for unknown / null / undefined id', () => {
    expect(getManifestById('miami-dade')).toBeNull();
    expect(getManifestById(null)).toBeNull();
    expect(getManifestById(undefined)).toBeNull();
    expect(getManifestById('')).toBeNull();
  });

  it('findManifestForJurisdiction matches by jurisdiction_name', () => {
    expect(
      findManifestForJurisdiction({
        jurisdiction_name: 'City of Orlando',
      }),
    ).toBe(orlandoManifest);
  });

  it('findManifestForJurisdiction matches by ahj_name', () => {
    expect(
      findManifestForJurisdiction({
        ahj_name: 'Orlando Building Dept',
      }),
    ).toBe(orlandoManifest);
  });

  it('findManifestForJurisdiction returns null when no manifest matches', () => {
    expect(
      findManifestForJurisdiction({
        jurisdiction_name: 'Anchorage',
      }),
    ).toBeNull();
    expect(findManifestForJurisdiction(null)).toBeNull();
    expect(findManifestForJurisdiction(undefined)).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// Bridge — manifest visibility flows through resolveSections cleanly
// ----------------------------------------------------------------------------

describe('Orlando manifest — Sprint 2A generator bridge', () => {
  it('resolved sections retain Sprint 2A all-on baseline for Orlando-relevant keys', () => {
    const v = computeDefaultVisibility(
      orlandoManifest,
      orlandoNewServiceCommercial,
    );
    const partial = toPacketSectionsPartial(v);
    const resolved = resolveSections(partial);
    // Things Orlando wants ON
    expect(resolved.tableOfContents).toBe(true);
    expect(resolved.generalNotes).toBe(true);
    expect(resolved.loadCalculation).toBe(true);
    expect(resolved.availableFaultCurrent).toBe(true);
    expect(resolved.grounding).toBe(true);
    expect(resolved.riserDiagram).toBe(true);
    // Things Orlando doesn't want for THIS context
    expect(resolved.nec22087Narrative).toBe(false);
    expect(resolved.arcFlash).toBe(false);
  });

  it('user override flips a manifest-default-OFF section back ON', () => {
    const defaults = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    const state = applyUserOverrides(defaults, {
      sections: { arcFlash: true },
    });
    const resolved = resolveSections(toPacketSectionsPartial(state));
    expect(resolved.arcFlash).toBe(true);
  });

  it('user override flips a manifest-default-ON section to OFF', () => {
    const defaults = computeDefaultVisibility(orlandoManifest, orlandoExisting);
    const state = applyUserOverrides(defaults, {
      sections: { revisionLog: false },
    });
    const resolved = resolveSections(toPacketSectionsPartial(state));
    expect(resolved.revisionLog).toBe(false);
  });
});
