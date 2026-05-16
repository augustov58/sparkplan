# One-Line Diagram Professional Symbols Upgrade Plan

**Date:** January 2, 2026
**Goal:** Upgrade production diagram symbols so panels and transformers look professional with proper connection anchors
**File:** `/components/OneLineDiagram.tsx` (2456 lines - monolith per ADR-006)

---

## Current Issues

1. **Misaligned connections** - Busbars don't terminate cleanly on symbols
2. **Simple box symbols** - Panels and transformers are basic rectangles with text
3. **Diagonal connections** - Single-child connections use diagonals instead of orthogonal routing
4. **Floating text** - Transformer details drift outside symbol boundaries
5. **No visual ports** - Connection points are implicit, not explicit

---

## Implementation Strategy

### Phase 1: Extend Constants (Lines 1418-1448)

**Add to DIAGRAM_CONSTANTS:**
```typescript
// Connection anchors
PORT_OFFSET: 10,        // Distance from symbol edge to port center
PORT_RADIUS: 3,         // Visual port circle radius

// Professional panel symbols
PANEL_W: 120,          // Panel card width (was 50)
PANEL_H: 80,           // Panel card height (was 30)
PANEL_HEADER_H: 24,    // Header strip height

MDP_W: 140,            // MDP card width (was 60)
MDP_H: 90,             // MDP card height (was 40)

// Professional transformer symbols
XFMR_W: 100,           // Transformer coil width (was 60)
XFMR_H: 70,            // Transformer coil height (was 35)
XFMR_COIL_W: 20,       // Individual coil width
XFMR_CORE_W: 4,        // Center core width
XFMR_TURNS: 3,         // Number of coil turns

// Typography
HEADER_FONT: 11,       // Header text size
BODY_FONT: 9,          // Body text size
SMALL_FONT: 8,         // Small details
```

**Impact:** These replace existing PANEL/MDP/TRANSFORMER dimensions and add new styling constants.

---

### Phase 2: Add Glyph Rendering Functions (After renderMaskedText ~line 1500)

#### Function 1: `renderPanelGlyph()`

```typescript
interface PanelAnchors {
  topPort: { x: number; y: number };
  bottomPort: { x: number; y: number };
}

const renderPanelGlyph = (
  x: number,           // Center X
  y: number,           // Top Y
  panel: Panel,
  variant: 'panel' | 'mdp' = 'panel'
): { element: JSX.Element; anchors: PanelAnchors } => {
  const width = variant === 'mdp' ? DIAGRAM_CONSTANTS.MDP_W : DIAGRAM_CONSTANTS.PANEL_W;
  const height = variant === 'mdp' ? DIAGRAM_CONSTANTS.MDP_H : DIAGRAM_CONSTANTS.PANEL_H;
  const leftX = x - width / 2;

  // Define ports
  const topPort = {
    x: x,
    y: y - DIAGRAM_CONSTANTS.PORT_OFFSET
  };
  const bottomPort = {
    x: x,
    y: y + height + DIAGRAM_CONSTANTS.PORT_OFFSET
  };

  // Header colors
  const headerBg = variant === 'mdp' ? '#dc2626' : '#3b82f6';
  const headerText = '#ffffff';

  return {
    element: (
      <g key={`panel-${panel.id}`}>
        {/* Outer card */}
        <rect
          x={leftX}
          y={y}
          width={width}
          height={height}
          rx={4}
          fill="white"
          stroke="#1f2937"
          strokeWidth={2}
        />

        {/* Header strip */}
        <rect
          x={leftX}
          y={y}
          width={width}
          height={DIAGRAM_CONSTANTS.PANEL_HEADER_H}
          rx={4}
          fill={headerBg}
        />
        <rect
          x={leftX}
          y={y + 4}
          width={width}
          height={DIAGRAM_CONSTANTS.PANEL_HEADER_H - 4}
          fill={headerBg}
        />

        {/* Header text: Left = name, Right = type */}
        <text
          x={leftX + 8}
          y={y + 16}
          className="fill-white font-bold"
          fontSize={DIAGRAM_CONSTANTS.HEADER_FONT}
        >
          {panel.name}
        </text>
        <text
          x={leftX + width - 8}
          y={y + 16}
          textAnchor="end"
          className="fill-white font-medium"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
        >
          {variant === 'mdp' ? 'MDP' : 'PANEL'}
        </text>

        {/* Body lines */}
        <text
          x={x}
          y={y + 38}
          textAnchor="middle"
          className="fill-gray-700 font-semibold"
          fontSize={DIAGRAM_CONSTANTS.BODY_FONT}
        >
          {panel.voltage}V {panel.phase_count === 3 ? '3Φ' : '1Φ'}
        </text>

        <text
          x={x}
          y={y + 52}
          textAnchor="middle"
          className="fill-gray-600"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
        >
          Bus {panel.bus_rating}A • {panel.main_breaker_amps ? `${panel.main_breaker_amps}A Main` : 'MLO'}
        </text>

        <text
          x={x}
          y={y + 64}
          textAnchor="middle"
          className="fill-gray-500"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
        >
          {panel.circuitCount || 0} ckt • {((panel.totalLoad || 0) / 1000).toFixed(1)} kVA
        </text>

        {/* Location (optional, small italic bottom-right) */}
        {panel.location && (
          <text
            x={leftX + width - 4}
            y={y + height - 4}
            textAnchor="end"
            className="fill-gray-400 italic"
            fontSize={6}
          >
            {panel.location}
          </text>
        )}

        {/* Connection ports (visual circles) */}
        <circle
          cx={topPort.x}
          cy={topPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#4b5563"
          stroke="#1f2937"
          strokeWidth={1}
        />
        <circle
          cx={bottomPort.x}
          cy={bottomPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#4b5563"
          stroke="#1f2937"
          strokeWidth={1}
        />
      </g>
    ),
    anchors: { topPort, bottomPort }
  };
};
```

#### Function 2: `renderTransformerGlyph()`

```typescript
const renderTransformerGlyph = (
  x: number,
  y: number,
  transformer: Transformer
): { element: JSX.Element; anchors: PanelAnchors } => {
  const width = DIAGRAM_CONSTANTS.XFMR_W;
  const height = DIAGRAM_CONSTANTS.XFMR_H;
  const coilW = DIAGRAM_CONSTANTS.XFMR_COIL_W;
  const coreW = DIAGRAM_CONSTANTS.XFMR_CORE_W;

  const leftCoilX = x - width/2 + 10;
  const rightCoilX = x + width/2 - coilW - 10;
  const coreX = x - coreW/2;
  const coilY = y + 20;

  // Define ports
  const topPort = {
    x: x,
    y: y - DIAGRAM_CONSTANTS.PORT_OFFSET
  };
  const bottomPort = {
    x: x,
    y: y + height + DIAGRAM_CONSTANTS.PORT_OFFSET
  };

  return {
    element: (
      <g key={`xfmr-${transformer.id}`}>
        {/* Name above */}
        <text
          x={x}
          y={y + 12}
          textAnchor="middle"
          className="fill-gray-900 font-bold"
          fontSize={DIAGRAM_CONSTANTS.HEADER_FONT}
        >
          {transformer.name}
        </text>

        {/* Left coil (3 turns) */}
        {Array.from({ length: DIAGRAM_CONSTANTS.XFMR_TURNS }).map((_, i) => (
          <ellipse
            key={`left-${i}`}
            cx={leftCoilX + coilW/2}
            cy={coilY + i * 10}
            rx={coilW/2}
            ry={5}
            fill="none"
            stroke="#1f2937"
            strokeWidth={2}
          />
        ))}

        {/* Center core (two vertical bars) */}
        <rect
          x={coreX}
          y={coilY - 5}
          width={coreW}
          height={30}
          fill="#1f2937"
        />
        <rect
          x={coreX + coreW + 2}
          y={coilY - 5}
          width={coreW}
          height={30}
          fill="#1f2937"
        />

        {/* Right coil (3 turns) */}
        {Array.from({ length: DIAGRAM_CONSTANTS.XFMR_TURNS }).map((_, i) => (
          <ellipse
            key={`right-${i}`}
            cx={rightCoilX + coilW/2}
            cy={coilY + i * 10}
            rx={coilW/2}
            ry={5}
            fill="none"
            stroke="#1f2937"
            strokeWidth={2}
          />
        ))}

        {/* kVA pill below coils */}
        <rect
          x={x - 25}
          y={y + 48}
          width={50}
          height={14}
          rx={7}
          fill="#3b82f6"
        />
        <text
          x={x}
          y={y + 58}
          textAnchor="middle"
          className="fill-white font-bold"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
        >
          {transformer.kva_rating} kVA
        </text>

        {/* Voltage conversion inside lower area */}
        <text
          x={x}
          y={y + 70}
          textAnchor="middle"
          className="fill-gray-600 font-medium"
          fontSize={DIAGRAM_CONSTANTS.SMALL_FONT}
        >
          {transformer.primary_voltage}V → {transformer.secondary_voltage}V
        </text>

        {/* Connection ports */}
        <circle
          cx={topPort.x}
          cy={topPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#4b5563"
          stroke="#1f2937"
          strokeWidth={1}
        />
        <circle
          cx={bottomPort.x}
          cy={bottomPort.y}
          r={DIAGRAM_CONSTANTS.PORT_RADIUS}
          fill="#4b5563"
          stroke="#1f2937"
          strokeWidth={1}
        />
      </g>
    ),
    anchors: { topPort, bottomPort }
  };
};
```

---

### Phase 3: Add Port-Based Busbar Function (After renderMaskedText)

```typescript
const renderBusBarFromPorts = (
  parentBottomPort: { x: number; y: number },
  childTopPorts: Array<{ x: number; y: number }>,
  strokeColor: string = '#000000'
): JSX.Element => {
  if (childTopPorts.length === 0) return <></>;

  if (childTopPorts.length === 1) {
    // Single child: Orthogonal elbow (vertical → horizontal → vertical)
    const childPort = childTopPorts[0];
    const busY = parentBottomPort.y + DIAGRAM_CONSTANTS.BUS_OFFSET;

    return (
      <g>
        {/* Vertical drop from parent */}
        <line
          x1={parentBottomPort.x}
          y1={parentBottomPort.y}
          x2={parentBottomPort.x}
          y2={busY}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
        />

        {/* Horizontal run to child X */}
        <line
          x1={parentBottomPort.x}
          y1={busY}
          x2={childPort.x}
          y2={busY}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.BUS_STROKE_WIDTH}
        />

        {/* Vertical drop to child */}
        <line
          x1={childPort.x}
          y1={busY}
          x2={childPort.x}
          y2={childPort.y}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
        />
      </g>
    );
  }

  // Multiple children: Horizontal bus with vertical drops
  const busY = parentBottomPort.y + DIAGRAM_CONSTANTS.BUS_OFFSET;
  const minX = Math.min(...childTopPorts.map(p => p.x));
  const maxX = Math.max(...childTopPorts.map(p => p.x));

  return (
    <g>
      {/* Vertical drop from parent to bus */}
      <line
        x1={parentBottomPort.x}
        y1={parentBottomPort.y}
        x2={parentBottomPort.x}
        y2={busY}
        stroke={strokeColor}
        strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
      />

      {/* Horizontal bus */}
      <line
        x1={minX}
        y1={busY}
        x2={maxX}
        y2={busY}
        stroke={strokeColor}
        strokeWidth={DIAGRAM_CONSTANTS.BUS_STROKE_WIDTH}
      />

      {/* Vertical drops to each child */}
      {childTopPorts.map((port, idx) => (
        <line
          key={idx}
          x1={port.x}
          y1={busY}
          x2={port.x}
          y2={port.y}
          stroke={strokeColor}
          strokeWidth={DIAGRAM_CONSTANTS.VERTICAL_DROP_STROKE_WIDTH}
        />
      ))}
    </g>
  );
};
```

---

### Phase 4: Update renderNodeAndDescendants (Lines ~1650-1850)

**Current code uses:**
```typescript
<rect ... /> // Simple box for panels
<text ...>{panel.name}</text>
```

**Replace with:**
```typescript
const { element: panelGlyph, anchors: panelAnchors } = renderPanelGlyph(
  xPos,
  currentY,
  panel,
  panel.is_main ? 'mdp' : 'panel'
);

// Store anchors for busbar routing
nodeAnchors.set(panel.id, panelAnchors);
```

**For transformers:**
```typescript
const { element: xfmrGlyph, anchors: xfmrAnchors } = renderTransformerGlyph(
  xPos,
  currentY,
  transformer
);

nodeAnchors.set(transformer.id, xfmrAnchors);
```

**Update busbar calls:**
```typescript
// OLD
renderBusBar(xPos, currentY + PANEL_HEIGHT, downstreamPositions, ...)

// NEW
const parentBottomPort = nodeAnchors.get(panel.id)!.bottomPort;
const childTopPorts = downstreamElements.map(el => nodeAnchors.get(el.id)!.topPort);
renderBusBarFromPorts(parentBottomPort, childTopPorts, strokeColor)
```

---

### Phase 5: Update renderFeederLabel (Lines ~1560-1620)

**Current code calculates:**
```typescript
loopY = (feederStartY + feederEndY) / 2
```

**Update to use drop segment:**
```typescript
const renderFeederLabel = (
  feeder: Feeder,
  childTopPort: { x: number; y: number },
  busY: number,
  index: number
) => {
  const dropX = childTopPort.x;
  const dropY1 = busY;
  const dropY2 = childTopPort.y;
  const loopY = (dropY1 + dropY2) / 2;

  // Use left/right alternation based on index
  const offset = index % 2 === 0 ? -20 : 20;

  // ... rest of label rendering
};
```

---

### Phase 6: Update downstreamPositions Structure

**OLD:**
```typescript
downstreamPositions.push({
  x: childX,
  y: childY  // Level Y
});
```

**NEW:**
```typescript
downstreamPositions.push({
  x: childX,
  y: childAnchors.topPort.y  // Port Y, not level Y
});
```

---

## Testing Checklist

After implementation:

- [ ] MDP renders with professional card style (red header)
- [ ] Regular panels render with card style (blue header)
- [ ] Transformers render with coil/core style
- [ ] All symbols have visible port circles
- [ ] Busbars terminate cleanly on ports (no visual shift)
- [ ] Single-child connections use orthogonal elbows (no diagonals)
- [ ] Multi-child connections have horizontal bus with vertical drops
- [ ] Transformer text stays inside symbol boundaries
- [ ] Feeder labels attach to drop segments correctly
- [ ] Manual dragging still works (xPos, yPos)
- [ ] PNG/PDF export still works (viewBox sizing)
- [ ] Unlimited hierarchy depth works (recursion intact)
- [ ] No runtime errors in console

---

## Files Modified

1. `/components/OneLineDiagram.tsx` (2456 lines)
   - Lines 1418-1448: Extended DIAGRAM_CONSTANTS
   - Lines ~1500-1800: Added glyph functions
   - Lines ~1650-1850: Updated renderNodeAndDescendants
   - Lines ~1560-1620: Updated renderFeederLabel
   - Multiple locations: Updated busbar calls

**No database schema changes required** ✅

---

## Rollback Plan

If issues arise:
1. Revert to commit `a23cd29` (jurisdiction feature)
2. Restore from `/components/OneLineDiagram.tsx.backup` (if created)
3. Test existing functionality before re-attempting

---

## Acceptance Criteria

✅ **Professional appearance** - Symbols match preview style (enclosure cards, coil/core transformers)
✅ **Clean connections** - All busbars and drops hit port centers precisely
✅ **No visual artifacts** - No text drift, no misaligned lines, no diagonal connections
✅ **Feature parity** - All existing features work (drag, export, labels, unlimited depth)
✅ **Performance** - No degradation in render time (<100ms for 20-panel diagram)

---

**Next Step:** Execute implementation in OneLineDiagram.tsx monolith per ADR-006.
