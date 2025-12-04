# ADR-006: OneLineDiagram as 1614-Line Monolith Component

**Status**: Accepted
**Date**: 2025-12-03
**Decision Makers**: Development Team

---

## Context

The **one-line diagram** is a critical visualization showing electrical system hierarchy:

```
Utility → Meter → MDP → Panels/Transformers → Downstream Panels
```

**Current state**: `OneLineDiagram.tsx` is 1614 lines in a single file.

**Typical React wisdom**: Components >500 lines should be split. This component is **3x that threshold**.

**Decision needed**: Should this component be refactored into smaller pieces?

---

## Decision

**Keep OneLineDiagram.tsx as a single 1614-line component (justified monolith).**

**Rationale**: The tight coupling between SVG rendering logic and electrical hierarchy traversal makes splitting counterproductive.

---

## Alternatives Considered

### Option A: Split by Hierarchy Level
**Description**: Separate components for each rendering level

```typescript
<OneLineDiagram>
  <UtilityRenderer />
  <MeterRenderer />
  <MDPRenderer />
  <Level1PanelsRenderer panels={panelsFedFromMDP} />
  <Level2PanelsRenderer panels={downstreamPanels} />
  <TransformerRenderer transformers={transformers} />
</OneLineDiagram>
```

**Pros**:
- ✅ Each component <300 lines
- ✅ Clear separation by concern

**Cons**:
- ❌ **Props drilling nightmare**: Every component needs X/Y coordinates, colors, line styles, spacing constants
- ❌ **Coordinate synchronization**: Parent must calculate all positions, pass down
- ❌ **Difficult debugging**: Rendering bug requires tracing through 6+ components
- ❌ **Performance**: More React reconciliation overhead (unnecessary re-renders)

**Example props drilling**:
```typescript
<Level1PanelsRenderer
  panels={panels}
  parentX={400}
  parentY={250}
  level={1}
  spacing={140}
  colors={colors}
  strokeWidths={strokeWidths}
  onPanelClick={handlePanelClick}
  onTransformerClick={handleTransformerClick}
/>
```

**Why rejected**: Splitting increases complexity more than it reduces it.

### Option B: Extract Rendering Logic to Utility Functions
**Description**: Keep component, move SVG generation to pure functions

```typescript
// /lib/electrical/svgRenderer.ts
export function renderPanel(panel: Panel, x: number, y: number): JSX.Element {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect ... />
      <text ... />
    </g>
  );
}

// OneLineDiagram.tsx
return (
  <svg>
    {panels.map((p, i) => renderPanel(p, calculateX(i), calculateY(i)))}
  </svg>
);
```

**Pros**:
- ✅ Testable rendering functions (no React needed)
- ✅ Reusable across diagram types

**Cons**:
- ❌ Still 1500+ lines total (just moved to different file)
- ❌ Functions need 10+ parameters (x, y, width, height, color, stroke, etc.)
- ❌ Loses JSX syntax benefits (harder to visualize structure)

**Why rejected**: Marginal benefit, loss of JSX clarity.

### Option C: Canvas API Instead of SVG
**Description**: Use HTML Canvas instead of SVG (imperative API)

**Pros**:
- ✅ Better performance for 100+ elements
- ✅ Smaller DOM

**Cons**:
- ❌ Imperative API (harder to maintain)
- ❌ No accessibility (screen readers can't parse Canvas)
- ❌ No hover/click events on individual elements (must implement manually)
- ❌ Complete rewrite required

**Why rejected**: SVG performance adequate (<50ms render for 20 panels). Canvas overkill.

### Option D: Use Diagram Library (ReactFlow, D3)
**Description**: Use existing library for graph rendering

**Pros**:
- ✅ Auto-layout algorithms
- ✅ Pan/zoom/collision detection built-in

**Cons**:
- ❌ Libraries don't understand electrical conventions (IEEE Std 315)
- ❌ Generic node-edge diagrams don't fit one-line diagram patterns
- ❌ Large bundle size (+200KB)
- ❌ Loss of control over rendering

**Why rejected**: One-line diagrams have specific electrical conventions. Generic libraries poor fit.

---

## Consequences

### Positive Consequences
- ✅ **All logic in one place**: Easier debugging (entire rendering flow visible)
- ✅ **No props drilling**: Variables accessible throughout component
- ✅ **Performance**: Single React component = single reconciliation
- ✅ **Clear control flow**: Linear top-to-bottom rendering logic
- ✅ **Easy coordinate calculations**: Constants shared across all rendering

### Negative Consequences
- ❌ **Long file**: 1614 lines intimidating to new developers
- ❌ **Merge conflicts**: Multiple developers editing same file risk conflicts
- ❌ **Scroll fatigue**: Must scroll to find specific rendering section

### Neutral Consequences
- ℹ️ **Testing strategy**: Integration tests (render full diagram) instead of unit tests (individual components)
- ℹ️ **Code navigation**: Jump-to-definition essential (Cmd+Click function names)

---

## Implementation Notes

**File structure** (`OneLineDiagram.tsx`):

```typescript
// Lines 1-100: Imports, types, interfaces
import { ... } from 'react';
import type { Panel, Transformer, Circuit } from '@/types';

// Lines 100-200: Component state and data fetching
export default function OneLineDiagram() {
  const { panels } = usePanels(projectId);
  const { transformers } = useTransformers(projectId);
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);

  // Lines 200-300: Event handlers
  const handlePanelClick = (panel: Panel) => { ... };
  const handleBreakerChange = (circuitId: string, amps: number) => { ... };

  // Lines 300-550: Constants and helper functions
  const DIAGRAM_CONSTANTS = { ... };
  const getDownstreamElements = (panelId: string) => { ... };
  const renderBusBar = (...) => { ... };

  // Lines 550-1500: SVG rendering (main component body)
  return (
    <svg viewBox="0 0 800 750">
      {/* Utility and meter */}
      <circle cx={400} cy={50} r={20} />

      {/* MDP */}
      <rect x={370} y={170} width={60} height={40} />

      {/* Level 1 panels */}
      {panelsFedFromMain.map((panel, i) => (
        <g key={panel.id}>
          {/* Panel rendering */}
          {/* Recursive downstream rendering */}
        </g>
      ))}

      {/* Transformers */}
      {transformersFedFromMain.map((xfmr, i) => (
        <g key={xfmr.id}>
          {/* Transformer rendering */}
        </g>
      ))}
    </svg>
  );

  // Lines 1500-1614: Circuit editor modal (related to diagram)
  {showCircuitEditor && (
    <CircuitEditorModal ... />
  )}
}
```

**Navigation tips for developers**:
- Use IDE outline view (shows function structure)
- Search for `// Level 1`, `// Level 2` comments
- Jump to DIAGRAM_CONSTANTS for coordinate reference
- Find rendering section by searching `<svg`

**When to refactor**:
- If adding **riser diagram** or **panel schedule diagram** → Extract shared rendering logic to `/lib/electrical/diagramRenderer.ts`
- If file exceeds **2500 lines** → Split circuit editor modal to separate component
- If **Canvas API** needed (100+ panels) → Rewrite as Canvas-based renderer

---

## Compliance & Standards

**IEEE Std 315 compliance**:
- Horizontal bus bars (4px thick)
- Vertical drops (2px thin)
- Symbol standardization (circle = utility, rectangle = panel, trapezoid = transformer)

**React best practices**:
- Single component, clear rendering flow
- Helper functions for repetitive logic (renderBusBar)
- Constants for magic numbers

**Accessibility**:
- SVG elements have `<title>` for screen readers
- Interactive elements (panels, transformers) have click handlers
- Text labels readable at default zoom

---

## Monitoring & Validation

**Metrics to track**:
- Component render time (target: <100ms for 20 panels)
- File length (alert if exceeds 2000 lines)
- Developer time to understand diagram rendering (target: <2 hours)

**Success criteria**:
- ✅ Render performance acceptable (no jank)
- ✅ Developers can debug rendering issues without excessive scrolling
- ✅ No reported confusion about component organization

**Review date**: 2026-06-01 (re-evaluate if file grows beyond 2000 lines)

---

## References

- [When NOT to split components (Dan Abramov)](https://overreacted.io/before-you-memo/)
- [The case for monolithic components](https://www.robinwieruch.de/react-component-size/)
- [IEEE Std 315 - Electrical symbols](https://standards.ieee.org/standard/315-1975.html)

---

## Notes

**Justification for exception to "split at 500 lines" rule**:

1. **Tight coupling**: Rendering logic inherently coupled to hierarchy traversal
2. **Coordinate dependencies**: All elements share coordinate system
3. **Debugging benefit**: Easier to trace rendering flow in one file
4. **Performance**: Single component avoids re-render cascade

**Similar patterns in wild**:
- **React DevTools**: `Profiler.js` is 2000+ lines (justified monolith)
- **Excalidraw**: `Scene.tsx` is 1500+ lines (canvas rendering)
- **VS Code**: Many 2000+ line files for complex rendering

**When pattern breaks down**: If we need multiple diagram types (one-line, riser, panel schedule), THEN extract shared logic. Current verdict: Wait until second diagram type needed.
