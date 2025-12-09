# Riser Diagram Reference Structure

Based on the reference image, here's the expected layout:

```
Y=30    ┌──────────┐  "480V 3Φ" (utility voltage label)
Y=50    │   UTIL   │  Utility Service (dashed circle)
Y=70    │          │  Vertical line
Y=90    │    M     │  Meter (rectangular box)
Y=120   │          │  Vertical line
Y=170   │   MDP    │  Main Distribution Panel (red box, height ~45)
Y=215   └──────────┘  MDP bottom
Y=225   "480V 3Φ • 200A Bus • 400A Main"  (MDP specs - ABOVE bus bar)
Y=235   "0 circuits"  (MDP circuit count - ABOVE bus bar)
Y=250   ════════════  MDP Bus Bar (horizontal, thick line)
        │         │   Vertical drops from bus bar
Y=320   │   P     │   Panel H1 (blue box)
        │   P     │   Panel H3 (blue box)
```

## Key Issues to Fix:

1. **MDP Labels Position**: Labels should be at y=225-235 (ABOVE the bus bar at y=250)
2. **Bus Bar Position**: Should be at y=250 (not y=245)
3. **Panel Labels**: Should be clearly above panels, not overlapping connection lines
4. **Text Background**: White background should cover text properly
5. **Connection Lines**: Should not overlap text labels

## Current Problems:

1. Bus bar moved to y=245 but should be at y=250
2. MDP labels at y=230-240 are too close to bus bar
3. White background might not be positioned correctly
4. Panel labels might overlap with connection lines

