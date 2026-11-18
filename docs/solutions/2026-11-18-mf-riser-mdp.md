# The multifamily riser skipped the MDP (#220)

**Problem:** on "QA MF feeders", the MDP is fed from a meter stack ("CT Cabinet") and the house and unit panels are fed from the MDP (and have feeders MDP → panel). E-201's `buildRiserTree` had a meter-stack branch that hung each *metered* panel straight off the stack ("Meter N: MLO"). The MDP was never drawn, so the MDP → panel feeders had no edge to label. The riser disagreed with E-301 and the Feeders page. The legend also promised "design load in kVA" on labels that show the voltage drop.

## Approach

1. **The topology question already had an answer.** CLAUDE.md (Panel Hierarchy) and ADR-005: "MDP is always the structural root in tree layout; Meter stack is visual-only". The data and E-301 follow it. The riser now puts the MDP's own subtree under the stack. `buildPanelSubtree` walks feeders first (so their labels land on the edges), then `fed_from` links.
2. **Keep what the old drawing carried.** Each panel's meter position moves onto its node (line 4). A panel fed from the stack itself, not through the MDP, keeps its meter edge.
3. **Move the labels below the bus (found by the verifier).** A label sat 8 units above the bus line, but the label font has a 7 pt floor (`MIN_LABEL_FONT`). The deeper meter-stack riser scales to 0.72, so the gap shrank under the text height and the label sat on the line. The parent's trunk, above the bus, also crossed labels left of center (on other risers too). Below the bus, beside each child's drop, there's half a V_GAP of room and no trunk.
4. **Make the legend say what the labels show:** conductor, length and voltage drop, or the design load in kVA when no drop is computed (`buildFeederLabel`).

## Verification

- E-201 on "QA MF feeders": UTILITY → CT Cabinet → MDP → four panels; F-Unit101 / F-House labels; Meter 1–4 tags; the new legend; 20 pages. Rendered to PNG; a riser without a stack is unchanged.
- `tests/e2e/issues/issue-220.spec.ts` fails on `main`. Independent verifier.

## Reusable lessons

- **A drawing with its own special case for one topology drifts from the data model.** Route it through the same subtree builder.
- **Offsets in drawing units collide with a minimum font size once the drawing scales.** Put labels where there's room at any scale.
- **Before calling something "a decision", look for an ADR.** "MDP is the structural root" answered this one.
