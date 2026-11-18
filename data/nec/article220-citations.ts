import type { NecEdition } from './evse-load';

/**
 * Article 220 sections renumbered between NEC 2020 and NEC 2023 (#237).
 *
 * | Quantity                                   | NEC 2020        | NEC 2023        |
 * |--------------------------------------------|-----------------|-----------------|
 * | Dwelling unit load, 3 VA/ft²               | 220.14(J)       | 220.41          |
 * | Non-dwelling general lighting unit loads   | Table 220.12    | Table 220.42(A) |
 * | General lighting demand factors            | Table 220.42    | Table 220.45    |
 *
 * NEC 2020 moved dwellings out of Table 220.12 into 220.14(J). Sources: ECM
 * Code Basics (Load Calculations, Part 1), the Mike Holt forum, and
 * open-exam-prep study guides. They agree on these rows; confirm against the
 * code book. The non-dwelling receptacle table (220.44 in 2020) is left alone:
 * sources disagree on its 2023 number.
 *
 * The edition is required: a defaulted edition hides a caller that never
 * passes one (Mistake Ledger, the 220.57 rows).
 */
export interface Article220Citations {
  /** Dwelling unit load (3 VA/ft²): the section number, without "NEC" */
  dwellingUnitLoad: string;
  /** Non-dwelling general lighting unit loads by occupancy (VA/ft²) */
  unitLoadTable: string;
  /** General lighting demand factors */
  lightingDemandTable: string;
}

const CITATIONS: Record<NecEdition, Article220Citations> = {
  '2020': {
    dwellingUnitLoad: '220.14(J)',
    unitLoadTable: 'Table 220.12',
    lightingDemandTable: 'Table 220.42',
  },
  '2023': {
    dwellingUnitLoad: '220.41',
    unitLoadTable: 'Table 220.42(A)',
    lightingDemandTable: 'Table 220.45',
  },
};

export function article220Citations(edition: NecEdition): Article220Citations {
  return CITATIONS[edition] ?? CITATIONS['2020'];
}
