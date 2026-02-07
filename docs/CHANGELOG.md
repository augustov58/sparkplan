# Changelog

All notable changes to NEC Pro Compliance.

---

## 2026-02-04: NEC 220.87 Measurement Path & Smart Defaults

**New Features:**
- **NEC 220.87 Dual-Path Support**: Can now determine building load via calculation (220.87(B)) OR measurement (220.87(A))
  - 12-month utility billing input (kW demand from utility records)
  - 30-day load study input (continuous metering data)
  - Measurement path often shows 30-50% MORE available capacity
- **Building Type Presets**: Smart defaults for common building types
  - Studio apartments, 1BR, 2BR, condos, townhomes, senior living
  - Auto-fills typical sq ft, common area loads, service size
  - "Don't know the details? Select building type" workflow
- **Documentation Updates**:
  - `STRATEGIC_ANALYSIS.md` refocused on Multi-Family EV only
  - `VALIDATION_ANALYSIS.md` updated with NEC 220.87 findings
  - Data collection guide for contractors added

**Files Modified:**
- `services/calculations/multiFamilyEV.ts` - NEC 220.87 measurement path logic
- `components/MultiFamilyEVCalculator.tsx` - Building presets UI, load method selector
- `services/pdfExport/MultiFamilyEVDocuments.tsx` - Shows load determination method

---

## 2026-01-31: Multi-Family EV Bug Fixes & Merge

**Branch**: `feature/multi-family-ev` → Merged to `main`

**Critical EVEMS Bug Fixes:**
- Bug #1: EVEMS showed fewer max chargers than direct connection (backwards!)
  - Added `directAlreadySufficient` check
  - Fixed missing variable references (`canAccommodateAllWithEVEMS`, `maxChargersWithEVEMS`)
- Bug #2: kW per charger exceeded physical charger limits (showed 11.4 kW for 32A @ 240V = 7.68 kW max)
  - Added cap at charger's physical maximum: `Math.min(perEVSEMaxKW, theoreticalKWPerCharger)`

**UI Cleanup:**
- Removed Cost Comparison card from calculator

**Commits:** `97ef322`, `5ed2640`, `4578565`, `68da43a`

---

## 2026-01-21: Multi-Family EV Calculator (Phase 2.5)

**New Features:**
- Multi-Family EV Readiness Calculator implementing NEC 220.84 + 220.57 + 625.42
- Building profile inputs (dwelling units, sq ft, common areas)
- EV charger configuration (Level 1/2, amps, chargers per unit)
- Itemized common area loads with NEC demand factors (220.42, 220.44, 620.14, 430.24)
- Building demand analysis with tiered demand factors
- EV capacity scenarios (with/without EVEMS load management)
- Service upgrade recommendation (none/panel-only/full-service)
- 3-page professional PDF export for city permits
- Integrated into Permit Packet Generator

**Files Created:**
- `services/calculations/multiFamilyEV.ts` (1400+ lines)
- `components/MultiFamilyEVCalculator.tsx` (~1100 lines)
- `services/pdfExport/MultiFamilyEVDocuments.tsx` (692 lines)
- `services/pdfExport/multiFamilyEVPDF.tsx` (84 lines)

---

## 2026-01-15: Feeder Sizing Bugs & UI Improvements

**Commit**: `8f80285`

**Bug Fixes:**
- Fixed transformer source → panel destination dropdown
- Added `getValidPanelDestinationsFromTransformer()` for connectivity validation
- Moved continuous load % slider to load-based sizing only (NEC 215.2(A)(1))
- Fixed transformer destination load aggregation

**UI Improvements:**
- Compact feeder and short circuit cards (50% height reduction)
- Cross-component feeder refresh via custom events

---

## 2026-01-12: AI Chatbot Enhancement & Tools

**New Action Tools:**
- `add_circuit`, `add_panel`, `fill_panel_with_test_loads`, `empty_panel`, `fill_with_spares`

**Read/Check Tools:**
- `get_project_summary`, `check_panel_capacity`, `calculate_feeder_voltage_drop`
- `check_conductor_sizing`, `check_service_upgrade`, `run_quick_inspection`

---

## 2025-12-30: UI/UX Improvements - Issues #24-27

**Issue #24: One-Line Diagram Separation**
- Added `diagramOnly` prop to OneLineDiagram component

**Issue #25: Inline Circuit Addition**
- Inline "+ Add Circuit" row in panel schedule table
- Comprehensive slot validation with multi-pole support

**Issue #26: Circuit Design Layout**
- 2-column layout (320px sidebar + 1fr diagram)
- Sticky diagram stays visible while scrolling

**Issue #27: Site Visit Status + Calendar Integration**
- Status dropdown: Scheduled ↔ In Progress ↔ Completed ↔ Cancelled
- Auto-sync with calendar events

---

## 2025-12-26: Python AI Backend Deployed

**URL**: https://neccompliance-production.up.railway.app

- Python FastAPI backend deployed to Railway
- 4 Pydantic AI agents operational
- Supabase integration configured
- Gemini AI 2.0 connected
- Real-time WebSocket subscriptions enabled

---

## 2025-12-20: Agentic PM System - Phase 0

- RFI Tracking with AI PDF extraction (Gemini Vision)
- Site Visit Logging with drag-and-drop photo upload
- Open Items Dashboard (cross-project aggregation)
- Calendar/Timeline with events, deadlines, meetings

---

## 2025-12-17: Service Upgrade Wizard

**Critical Compliance Fix:** Added 125% multiplier for calculated/manual loads per NEC 220.87
- Four determination methods: Utility Bill, Load Study, Calculated, Manual
- Only actual measurements skip 125% multiplier

---

## 2025-12-16: Short Circuit Calculator

- Service conductor parameters (real-world distance modeling)
- Critical bug fix: 3-phase impedance multiplier (was 40% underestimated)
- Calculation tracking system with results viewer
- PDF export (single calculation or full system report)
- Engineering accuracy per IEEE 141 (Red Book)
