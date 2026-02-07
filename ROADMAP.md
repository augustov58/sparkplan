# NEC Pro Compliance - Roadmap

## Current Phase: 2.5 (Multi-Family EV) - COMPLETE

---

## Phase 0: Basic Project Management - COMPLETE (Dec 2025)
- RFI Tracking with AI PDF extraction
- Site Visit Logging with photo upload
- Open Items Dashboard (cross-project)
- Calendar/Timeline with events

---

## Phase 1: AI Killer Features - COMPLETE (Dec 2025)
- Inspector Mode AI (pre-inspection audit)
- Enhanced NEC Assistant (context-aware)
- Permit Packet Generator (Tier 1 + Tier 2)
- Arc Flash Calculator
- Short Circuit Calculator

---

## Phase 2: EV Niche Domination - COMPLETE (Dec 2025)
- EVEMS Load Management Calculator (NEC 625.42)
- Service Upgrade Wizard (NEC 220.87, 230.42)
- Utility Interconnection Forms (code complete, UI hidden)
- EV Panel Templates (4× & 8× Level 2, 2× DC Fast)

---

## Phase 2.5: Multi-Family EV Domination - COMPLETE (Jan 2026)

**Strategic Focus:** Highest-pain, highest-WTP segment. Contractors turning down $10K-50K jobs - we automate the $2-10K engineering calculation.

| Feature | NEC Reference | Status |
|---------|---------------|--------|
| Multi-Family EV Calculator | 220.84 + 220.57 + 625.42 | Complete |
| NEC 220.87 Measurement Path | 220.87(A) | Complete |
| Building Type Presets | - | Complete |
| Common Area Load Itemization | 220.42, 220.44, 620.14, 430.24 | Complete |
| PDF Export (Standalone) | - | Complete |
| Permit Packet Integration | - | Complete |

**Key Features:**
- NEC 220.84 multi-family demand factors (23-45% based on unit count)
- NEC 220.57 per-EVSE load calculation (max of 7,200 VA or nameplate)
- NEC 625.42 EVEMS right-sizing (size to setpoint, not full connected load)
- Dual-path load determination: Calculation (220.87(B)) OR Measurement (220.87(A))
- Measurement path often shows 30-50% MORE available capacity

---

## Phase 2.6: Enhanced AI Chatbot - COMPLETE (Jan 2026)

| Feature | Status | Impact |
|---------|--------|--------|
| Conversation Memory | Complete | Multi-turn conversations |
| Agentic Actions (12 tools) | Complete | Execute calculations via chat |
| Streaming Responses | Pending | Faster perceived response |
| Core NEC Tables RAG | Pending | Accurate table lookups |
| Full NEC RAG | Pending | Complete knowledge base |

---

## Permit Packet Generator - Tier 2

| Feature | Status |
|---------|--------|
| Short Circuit Calculator | Complete |
| Arc Flash Calculator | Complete |
| Grounding Plan (NEC 250) | Complete |
| Equipment Specification Sheets | Complete |
| Voltage Drop Report | Complete |
| Jurisdiction Requirement Wizard | Complete (6 jurisdictions) |

**Result:** 100% commercial permit readiness

---

## NEXT UP: Multi-Family Project Population (Phase 2.7)

**The missing link:** MF EV Calculator → Project Panels/Circuits → Permit Packet

### Workflow Gap Today
```
MF EV Calculator → gives you numbers (PDF)
                 → BUT cannot populate project panels/circuits
                 → Permit Packet can't include the actual design
```

### Target Workflow
```
MF EV Calculator → "Apply to Project" button
                 → Auto-generates: service entrance, meter stack, house panel,
                   EV sub-panel, unit feeders, EVEMS circuits
                 → Permit Packet includes complete multi-family design
```

### Step 1: Multi-Family Dwelling Calculator Enhancement (18-25h)

NEC 220.84 engine exists in `residentialLoad.ts` but needs integration with project population.

| Feature | Effort | Status |
|---------|--------|--------|
| NEC 220.84 Calculation Engine | 8-10h | Exists (residentialLoad.ts) |
| Unit Count & Load Aggregation | 4-6h | Exists (residentialLoad.ts) |
| Load Category Breakdown | 2-3h | Exists (multiFamilyEV.ts) |
| Multi-Family PDF Reports | 4-6h | Partial (MF EV PDF exists) |
| **Connect to Project Population** | 6-8h | **NOT STARTED** |

### Step 2: Auto-Generation Features (30-40h)

| Feature | Effort | Description |
|---------|--------|-------------|
| Multi-Family Circuit Auto-Gen | 8-12h | Generate apartment load schedules |
| EVEMS Circuit Templates | 4-6h | Pre-designed EV infrastructure |
| Unit Feeder Auto-Sizing | 3-4h | Size feeders from house panel to units |
| Meter Room Panel Generation | 6-8h | CT cabinet + house panels |
| Database Schema Updates | 2-3h | Building/unit relationships |
| Multi-Family Permit PDFs | 8-10h | Unit-specific panel schedules |

---

## Phase 3: Design Copilot (Future)

AI-powered auto-design: "Design 15,000 sq ft medical office with X-ray room" → Complete electrical design

- Building type classifier
- Load schedule generator
- Panel layout optimizer

**Estimate:** 40-50 hours | **Impact:** Revolutionary

---

## Phase 4: Solar + Storage Expansion (Future)

- Battery energy storage (NEC 706)
- Hybrid inverter configuration
- Net metering calculations

---

## NEC Compliance Features

### Implemented

| Feature | NEC Reference |
|---------|---------------|
| Load Calculations | 220.82, 220.84 |
| Conductor Sizing | 310.16, Table 310.16 |
| Voltage Drop | Chapter 9, Table 9 |
| Demand Factors | 220.42, 220.44, 220.55 |
| Feeder Sizing | Article 215 |
| EGC Sizing | 250.122 |
| Grounding System | Article 250 |
| EV Charging | Article 625 |
| Solar PV | Article 690 |
| Short Circuit Analysis | NEC 110.9, IEEE 141 |
| EVEMS Load Management | NEC 625.42 |
| Service Upgrade Analysis | NEC 220.87, 230.42 |
| Arc Flash Analysis | NFPA 70E |
| Multi-Family EV Analysis | NEC 220.84 + 220.57 + 625.42 |

### Planned

| Feature | NEC Reference | Priority |
|---------|---------------|----------|
| Selective Coordination | 700.27, 701.27 | Medium |
| Motor Starting | Article 430 | Medium |
| Harmonic Analysis | - | Low |
