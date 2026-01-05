# Calculator Improvements Plan

**Based on:** EV Installer Research & Case Studies
**Date:** January 4, 2026
**Goal:** Make calculators faster, simpler, and more valuable for EV installers

---

## 🎯 Overview

Our research revealed that **speed beats accuracy for initial quoting**. Contractors need:
1. ✅ **Fast answers** (60 seconds, not 15 minutes)
2. ✅ **Simple inputs** (no utility bills, no complex options)
3. ✅ **Mobile-friendly** (quote from phone on job sites)
4. ✅ **Practical solutions** (circuit sharing, load management)

---

## 📊 Current State Assessment

### Service Upgrade Calculator (Existing)
**Location:** `/components/ServiceUpgradeWizard.tsx`, `/services/calculations/serviceUpgrade.ts`

**Current features:**
- ✅ NEC 220.87 compliant (4 determination methods)
- ✅ Handles single-phase and three-phase
- ✅ Supports 60A-400A services
- ✅ Load templates (25+ common loads)
- ✅ Panel schedule integration

**Problems identified from research:**
- ❌ **Too complex** - Four determination methods confuse users
- ❌ **Utility bill method** - Contractors never use this (<1% of time)
- ❌ **30-day load study** - Contractors never use this (expensive equipment)
- ❌ **Not mobile-optimized** - Small text, too many fields
- ❌ **No circuit sharing option** - Missing $400 alternative to $3,000 upgrade
- ❌ **No cost estimates** - Contractors can't quote accurately

---

## 🚀 Proposed Changes (Prioritized)

---

## PRIORITY 1: Simplify Service Upgrade Calculator ⚡

**Goal:** Default to "Quick Check" mode - 60-second answer with minimal inputs

**Effort:** 6-8 hours
**Impact:** 🔥 HIGH - This is our hero feature for EV installers
**Status:** 🟡 Enhancement to existing feature

### Changes to UI (`/components/ServiceUpgradeWizard.tsx`)

#### Change 1.1: New "Mode Selector" at Top

Add toggle at the top of calculator:

```typescript
<div className="mb-6 bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
  <div className="flex items-center justify-between">
    <div>
      <h4 className="font-semibold text-gray-900">Quick Check</h4>
      <p className="text-sm text-gray-600">Fast answer from basic info (recommended)</p>
    </div>
    <button
      onClick={() => setMode('advanced')}
      className="text-sm text-electric-600 hover:text-electric-700"
    >
      Switch to Advanced Mode →
    </button>
  </div>
</div>
```

**Quick Check Mode (DEFAULT):**
- Hide "Existing Load Determination Method" dropdown
- Always use "Calculated" method (NEC 220.82)
- Show simplified input form (see below)
- Remove utility bill and load study options entirely

**Advanced Mode (Hidden until clicked):**
- Show all four NEC 220.87 methods
- Show detailed panel schedule integration
- Show manual load entry fields

#### Change 1.2: Simplified Input Form (Quick Check Mode)

**Current:** 15+ input fields across multiple sections
**New:** 8 core inputs in a single card

```typescript
interface QuickCheckInputs {
  // Section 1: Service (always visible)
  serviceRating: number;        // 100A, 150A, 200A dropdown
  voltage: number;              // 240V default
  phase: 1 | 3;                 // Single default

  // Section 2: Home Size
  squareFeet: number;           // Number input or size selector

  // Section 3: Major Appliances (checkboxes)
  heating: 'electric' | 'gas';
  cooling: 'none' | '2-ton' | '3-ton' | '4-ton' | '5-ton';
  range: 'electric' | 'gas';
  waterHeater: 'electric-40gal' | 'electric-50gal' | 'electric-80gal' | 'gas';
  dryer: 'electric' | 'gas';

  // Section 4: New Load (EV Charger)
  evCharger: string;            // Template dropdown or custom amps
}
```

**Visual Layout:**

```
┌─────────────────────────────────────────────────┐
│ Quick Check: Service Upgrade Calculator         │
├─────────────────────────────────────────────────┤
│                                                  │
│ 1. EXISTING SERVICE                              │
│    Service Size: [200A ▼]  Voltage: 240V        │
│    Phase: ○ Single  ○ Three-phase               │
│                                                  │
│ 2. HOME SIZE                                     │
│    Square Feet: [2,400] or                      │
│    Quick Select: [ Small ] [ Medium ] [ Large ] │
│                                                  │
│ 3. MAJOR APPLIANCES                              │
│    Heat:    ○ Electric  ● Gas                   │
│    Cooling: ● 3-Ton A/C  ○ None                 │
│    Range:   ● Electric   ○ Gas                  │
│    Water:   ● Electric (50 gal)  ○ Gas          │
│    Dryer:   ● Electric   ○ Gas                  │
│                                                  │
│ 4. NEW EV CHARGER                                │
│    [Tesla Wall Connector (48A) ▼]               │
│                                                  │
│    [Calculate Service Capacity →]               │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Change 1.3: Enhanced Results Display

**Add three result scenarios with clear visual indicators:**

```typescript
// Result Component
interface ServiceUpgradeResult {
  status: 'ok' | 'near-capacity' | 'upgrade-needed';
  currentLoad: number;          // Amps
  withEVCharger: number;        // Amps
  serviceRating: number;        // Amps
  utilization: number;          // Percentage
  availableHeadroom: number;    // Amps

  // NEW: Solutions array
  solutions: Solution[];
}

interface Solution {
  type: 'no-action' | 'circuit-sharing' | 'load-management' | 'service-upgrade';
  title: string;
  description: string;
  cost: { min: number; max: number };
  timeline: string;
  recommended: boolean;
}
```

**Visual Results (3 Scenarios):**

**Scenario A: ✅ No Upgrade Needed (Utilization ≤ 80%)**
```
┌─────────────────────────────────────────────────┐
│ ✅ NO SERVICE UPGRADE NEEDED                    │
├─────────────────────────────────────────────────┤
│                                                  │
│ Current Load:        156A                       │
│ With EV Charger:     186A                       │
│ Service Rating:      200A                       │
│ Utilization:         78% ████████░░             │
│ Available Headroom:  54A                        │
│                                                  │
│ RECOMMENDED ACTION:                              │
│ Install EV charger on existing 200A service     │
│                                                  │
│ Required Circuit:                                │
│ • Breaker: 60A double-pole                      │
│ • Wire: #6 AWG copper (or #4 aluminum)          │
│ • Conduit: 3/4" EMT                             │
│                                                  │
│ [Generate Permit Packet] [Add to Project]      │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Scenario B: ⚠️ Near Capacity (80-100%)**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ NEAR CAPACITY - OPTIONS AVAILABLE            │
├─────────────────────────────────────────────────┤
│                                                  │
│ Current Load:        168A                       │
│ With EV Charger:     198A                       │
│ Service Rating:      200A                       │
│ Utilization:         94% ██████████             │
│ Available Headroom:  12A                        │
│                                                  │
│ ⚠️ Close to capacity - consider these options:  │
│                                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ OPTION 1: Circuit Sharing (Recommended)  │   │
│ │ Share circuit with dryer using NeoCharge │   │
│ │ Cost: $1,850                              │   │
│ │ Timeline: 1 day                           │   │
│ │ [Learn More] [Select This Option]        │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ OPTION 2: Load Management System          │   │
│ │ Install smart panel (Tesla Neurio)       │   │
│ │ Cost: $2,400                              │   │
│ │ Timeline: 1 day                           │   │
│ │ [Learn More] [Select This Option]        │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ OPTION 3: Service Upgrade                 │   │
│ │ Upgrade to 225A service                   │   │
│ │ Cost: $2,800-$3,500                       │   │
│ │ Timeline: 2-3 days                        │   │
│ │ [Learn More] [Select This Option]        │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Scenario C: ❌ Upgrade Required (>100%)**
```
┌─────────────────────────────────────────────────┐
│ ❌ SERVICE UPGRADE REQUIRED                     │
├─────────────────────────────────────────────────┤
│                                                  │
│ Current Load:        182A                       │
│ With EV Charger:     232A                       │
│ Service Rating:      200A                       │
│ Utilization:         116% ████████████░         │
│ Overload:            32A                        │
│                                                  │
│ ⚠️ Cannot install without upgrade or load mgmt  │
│                                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ OPTION 1: Service Upgrade (Recommended)  │   │
│ │ Upgrade to 300A service                   │   │
│ │ Cost: $3,800-$5,200                       │   │
│ │ Timeline: 3-5 days                        │   │
│ │ [View Details] [Add to Quote]            │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ OPTION 2: EVEMS Load Management           │   │
│ │ Install load sharing controller           │   │
│ │ Cost: $2,200-$2,800                       │   │
│ │ Timeline: 1-2 days                        │   │
│ │ Note: Charges slower during peak use      │   │
│ │ [View Details] [Add to Quote]            │   │
│ └──────────────────────────────────────────┘   │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### Change 1.4: Mobile Optimization

**Current issue:** Too many fields, small text, hard to use on phone

**Fix:**
- Stack inputs vertically on mobile (currently side-by-side)
- Increase touch targets to 44px minimum
- Use native select dropdowns (not custom components)
- Add "Quick Entry" mode with larger buttons

```typescript
// Mobile-first input component
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  {/* Stacks on mobile, 2-column on desktop */}
  <div className="form-field">
    <label className="text-base font-medium">Service Size</label>
    <select className="h-12 text-lg">
      {/* Larger tap targets */}
    </select>
  </div>
</div>
```

#### Change 1.5: Remove Unused Features (Clean Up)

**Remove from default view:**
- ❌ "12-month utility billing" option (contractors never use)
- ❌ "30-day load study" option (contractors never use)
- ❌ Manual existing load entry (use calculated)
- ❌ Panel schedule integration from main view (move to Advanced)

**Keep in Advanced Mode** (for power users):
- ✅ Panel schedule integration
- ✅ Manual load entry
- ✅ Detailed appliance nameplates

---

## PRIORITY 2: Add Circuit Sharing Calculator 🔌

**Goal:** Show contractors the $400 alternative to $3,000 panel upgrade

**Effort:** 8-10 hours
**Impact:** 🔥 HIGH - Competitive differentiator (no competitor has this)
**Status:** 🆕 New feature

### What is Circuit Sharing?

**Devices:**
- NeoCharge Smart Splitter ($450)
- DCC-9 by Enel X ($400)
- Tesla Wall Connector with load sharing (built-in)

**How it works:**
- EV charger and dryer (or HVAC) share the same circuit
- Smart controller ensures only ONE device operates at a time
- If dryer starts, EV charging pauses temporarily
- Resumes charging when dryer finishes

**Use case:** Customer has no panel capacity, but doesn't want to spend $3,000+ on service upgrade

### Implementation

#### File Structure:
```
/components/CircuitSharingCalculator.tsx  (NEW - UI component)
/services/calculations/circuitSharing.ts   (NEW - calculation logic)
/types.ts                                  (UPDATE - add types)
```

#### Types (add to `/types.ts`):

```typescript
export interface CircuitSharingInput {
  serviceRating: number;              // 100A, 150A, 200A
  currentUtilization: number;         // Percentage
  proposedEVCharger: number;          // Amps

  // Circuit to share with
  shareWith: 'dryer' | 'hvac' | 'none';
  sharedCircuitAmps: number;          // 30A (dryer), 40A (HVAC)

  // Usage patterns
  dryerUsagePattern: 'daytime' | 'evening' | 'variable';
  evChargingSchedule: 'overnight' | 'daytime' | 'flexible';
}

export interface CircuitSharingResult {
  compatible: boolean;
  savingsVsUpgrade: number;          // Dollars saved
  device: 'NeoCharge' | 'DCC-9' | 'Tesla';
  deviceCost: number;
  installationCost: number;
  totalCost: number;

  // Comparison
  upgradeAlternative: {
    newServiceSize: number;          // 200A, 225A, 300A
    cost: { min: number; max: number };
    timeline: string;
  };

  // Limitations
  limitations: string[];             // Array of usage restrictions
  warnings: string[];                // Array of potential issues
}
```

#### Calculation Logic (`/services/calculations/circuitSharing.ts`):

```typescript
export function calculateCircuitSharing(
  input: CircuitSharingInput
): CircuitSharingResult {

  // Check compatibility
  const compatible = checkCompatibility(input);

  // Calculate costs
  const deviceCost = getDeviceCost(input.shareWith);
  const installationCost = 1200; // Average installation
  const totalCost = deviceCost + installationCost;

  // Calculate upgrade alternative
  const upgradeAlternative = calculateUpgradeAlternative(
    input.serviceRating,
    input.currentUtilization,
    input.proposedEVCharger
  );

  const savingsVsUpgrade =
    (upgradeAlternative.cost.min + upgradeAlternative.cost.max) / 2 - totalCost;

  // Identify limitations based on usage patterns
  const limitations = identifyLimitations(input);
  const warnings = identifyWarnings(input);

  return {
    compatible,
    savingsVsUpgrade,
    device: recommendDevice(input.shareWith),
    deviceCost,
    installationCost,
    totalCost,
    upgradeAlternative,
    limitations,
    warnings
  };
}

function checkCompatibility(input: CircuitSharingInput): boolean {
  // Must have compatible circuit to share
  if (input.shareWith === 'none') return false;

  // EV charger must be ≤ 50A (circuit sharing device limit)
  if (input.proposedEVCharger > 50) return false;

  // Shared circuit must be adequate size
  if (input.shareWith === 'dryer' && input.sharedCircuitAmps < 30) return false;
  if (input.shareWith === 'hvac' && input.sharedCircuitAmps < 40) return false;

  return true;
}

function getDeviceCost(shareWith: 'dryer' | 'hvac' | 'none'): number {
  if (shareWith === 'dryer') return 450;  // NeoCharge
  if (shareWith === 'hvac') return 400;   // DCC-9
  return 0;
}

function identifyLimitations(input: CircuitSharingInput): string[] {
  const limitations: string[] = [];

  if (input.dryerUsagePattern === 'evening' &&
      input.evChargingSchedule === 'overnight') {
    limitations.push(
      "If dryer runs during overnight charging, EV charging will pause temporarily"
    );
  }

  if (input.shareWith === 'hvac') {
    limitations.push(
      "EV charging pauses when HVAC operates (may extend charging time)"
    );
  }

  limitations.push(
    "Only one device (EV or shared appliance) operates at a time"
  );

  return limitations;
}

function identifyWarnings(input: CircuitSharingInput): string[] {
  const warnings: string[] = [];

  // Check usage pattern conflicts
  if (input.dryerUsagePattern === 'evening' &&
      input.evChargingSchedule === 'overnight') {
    // Overlap likely - warn user
    warnings.push(
      "⚠️ Dryer and EV charging times overlap - expect slower EV charging"
    );
  }

  if (input.currentUtilization > 90) {
    warnings.push(
      "⚠️ Panel near capacity - circuit sharing recommended but consider future loads"
    );
  }

  return warnings;
}
```

#### UI Component (`/components/CircuitSharingCalculator.tsx`):

```typescript
export const CircuitSharingCalculator: React.FC = () => {
  const [input, setInput] = useState<CircuitSharingInput>({
    serviceRating: 200,
    currentUtilization: 94,
    proposedEVCharger: 48,
    shareWith: 'dryer',
    sharedCircuitAmps: 30,
    dryerUsagePattern: 'daytime',
    evChargingSchedule: 'overnight'
  });

  const result = calculateCircuitSharing(input);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold">Circuit Sharing Calculator</h3>
        <p className="text-sm text-gray-600">
          Install EV charger without panel upgrade - share circuit with dryer or HVAC
        </p>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Service info */}
        <div>
          <label>Current Service Size</label>
          <select value={input.serviceRating} onChange={...}>
            <option value={100}>100A</option>
            <option value={150}>150A</option>
            <option value={200}>200A</option>
          </select>
        </div>

        <div>
          <label>Current Utilization</label>
          <input type="number" value={input.currentUtilization} />
          <span className="text-xs">% (from Service Upgrade Calculator)</span>
        </div>

        {/* EV Charger */}
        <div className="col-span-2">
          <label>EV Charger Size</label>
          <select value={input.proposedEVCharger} onChange={...}>
            <option value={32}>32A (Level 2 Standard)</option>
            <option value={40}>40A (Level 2 Fast)</option>
            <option value={48}>48A (Tesla Wall Connector)</option>
            <option value={50}>50A (ChargePoint Home Flex)</option>
          </select>
        </div>

        {/* Share With */}
        <div className="col-span-2">
          <label>Share Circuit With:</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setInput({...input, shareWith: 'dryer'})}
              className={`p-4 border-2 rounded-lg ${
                input.shareWith === 'dryer'
                  ? 'border-electric-500 bg-electric-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-medium">Electric Dryer</div>
              <div className="text-sm text-gray-600">30A circuit</div>
              <div className="text-xs text-gray-500 mt-1">
                Most common option
              </div>
            </button>

            <button
              onClick={() => setInput({...input, shareWith: 'hvac'})}
              className={`p-4 border-2 rounded-lg ${
                input.shareWith === 'hvac'
                  ? 'border-electric-500 bg-electric-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="font-medium">HVAC System</div>
              <div className="text-sm text-gray-600">40A+ circuit</div>
              <div className="text-xs text-gray-500 mt-1">
                Less common
              </div>
            </button>
          </div>
        </div>

        {/* Usage Patterns */}
        <div>
          <label>When do you run the dryer?</label>
          <select value={input.dryerUsagePattern} onChange={...}>
            <option value="daytime">Daytime (9am-6pm)</option>
            <option value="evening">Evening (6pm-11pm)</option>
            <option value="variable">Variable times</option>
          </select>
        </div>

        <div>
          <label>When will EV charge?</label>
          <select value={input.evChargingSchedule} onChange={...}>
            <option value="overnight">Overnight (11pm-7am)</option>
            <option value="daytime">Daytime</option>
            <option value="flexible">Flexible</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {result.compatible ? (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-green-900 mb-2">
                ✅ Circuit Sharing Compatible
              </h4>

              {/* Cost Comparison */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Circuit Sharing</div>
                    <div className="text-2xl font-bold text-green-600">
                      ${result.totalCost.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {result.device} device + installation
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-600">Service Upgrade</div>
                    <div className="text-2xl font-bold text-gray-400 line-through">
                      ${result.upgradeAlternative.cost.min.toLocaleString()}-
                      ${result.upgradeAlternative.cost.max.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Upgrade to {result.upgradeAlternative.newServiceSize}A
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-sm font-medium text-green-600">
                    💰 Saves ${result.savingsVsUpgrade.toLocaleString()} vs. upgrade
                  </div>
                </div>
              </div>

              {/* Recommended Device */}
              <div className="bg-white rounded-lg p-4 mb-4">
                <div className="font-medium mb-2">Recommended Device:</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{result.device}</div>
                    <div className="text-sm text-gray-600">
                      Shares {input.shareWith === 'dryer' ? '30A dryer' : '40A HVAC'} circuit
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-electric-600">
                      ${result.deviceCost}
                    </div>
                    <div className="text-xs text-gray-500">device cost</div>
                  </div>
                </div>
              </div>

              {/* How It Works */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="font-medium text-blue-900 mb-2">How It Works:</div>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Only ONE device operates at a time (EV or {input.shareWith})</li>
                  <li>• If dryer starts, EV charging pauses temporarily</li>
                  <li>• Charging resumes automatically when dryer finishes</li>
                  <li>• Most owners never notice the sharing (charges overnight)</li>
                </ul>
              </div>

              {/* Limitations */}
              {result.limitations.length > 0 && (
                <div className="bg-yellow-50 rounded-lg p-4 mb-4">
                  <div className="font-medium text-yellow-900 mb-2">
                    ⚠️ Limitations:
                  </div>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    {result.limitations.map((limitation, idx) => (
                      <li key={idx}>• {limitation}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4 mb-4">
                  {result.warnings.map((warning, idx) => (
                    <div key={idx} className="text-sm text-orange-800">
                      {warning}
                    </div>
                  ))}
                </div>
              )}

              {/* CTAs */}
              <div className="flex gap-3">
                <button className="btn-primary">
                  Add to Quote
                </button>
                <button className="btn-secondary">
                  Learn More About {result.device}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-red-900 mb-2">
                ❌ Circuit Sharing Not Compatible
              </h4>
              <p className="text-sm text-red-800 mb-3">
                Circuit sharing won't work for this installation. Consider:
              </p>
              <ul className="text-sm text-red-800 space-y-1 mb-4">
                <li>• Service upgrade to {result.upgradeAlternative.newServiceSize}A</li>
                <li>• Load management system (Tesla Neurio, Lumin)</li>
                <li>• Smaller EV charger (32A instead of 48A)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

#### Integration Points:

1. **Add to Calculators Page** (`/components/Calculators.tsx`):
```typescript
<button
  onClick={() => setActiveTab('circuit-sharing')}
  className="sidebar-button"
>
  <Split className="w-4 h-4" />
  Circuit Sharing
</button>
```

2. **Link from Service Upgrade Results:**
When service upgrade shows "Near Capacity" or "Upgrade Needed":
```typescript
<button onClick={() => openCircuitSharingCalculator()}>
  💡 See if circuit sharing can save $2,500
</button>
```

---

## PRIORITY 3: Add Service Upgrade Cost Estimator 💰

**Goal:** Help contractors quote accurately without guessing

**Effort:** 6-8 hours
**Impact:** 🟡 MEDIUM-HIGH - Helps win jobs with accurate quotes
**Status:** 🆕 New feature (or enhancement to results)

### Implementation

Add regional pricing database and display in Service Upgrade Results.

#### Cost Database (`/data/serviceUpgradeCosts.ts`):

```typescript
export interface ServiceUpgradeCost {
  region: string;
  state: string;
  fromService: number;     // 100A, 150A
  toService: number;       // 200A, 225A, 300A, 400A
  costRange: {
    min: number;
    max: number;
  };
  timeline: string;        // "2-3 days", "3-5 days"
  utilityInvolvement: boolean;
  notes?: string;
}

export const serviceUpgradeCosts: ServiceUpgradeCost[] = [
  // California
  {
    region: 'San Diego, CA',
    state: 'CA',
    fromService: 100,
    toService: 200,
    costRange: { min: 3800, max: 5200 },
    timeline: '3-5 days',
    utilityInvolvement: true,
    notes: 'Higher costs due to permit fees ($500+) and utility coordination'
  },
  {
    region: 'Los Angeles, CA',
    state: 'CA',
    fromService: 100,
    toService: 200,
    costRange: { min: 4200, max: 5800 },
    timeline: '3-5 days',
    utilityInvolvement: true
  },
  {
    region: 'San Francisco, CA',
    state: 'CA',
    fromService: 100,
    toService: 200,
    costRange: { min: 4500, max: 6500 },
    timeline: '4-6 days',
    utilityInvolvement: true,
    notes: 'Highest costs in state due to labor rates'
  },

  // Texas
  {
    region: 'Austin, TX',
    state: 'TX',
    fromService: 100,
    toService: 200,
    costRange: { min: 2800, max: 3800 },
    timeline: '2-3 days',
    utilityInvolvement: true
  },
  {
    region: 'Houston, TX',
    state: 'TX',
    fromService: 100,
    toService: 200,
    costRange: { min: 2500, max: 3500 },
    timeline: '2-3 days',
    utilityInvolvement: true
  },
  {
    region: 'Dallas, TX',
    state: 'TX',
    fromService: 100,
    toService: 200,
    costRange: { min: 2800, max: 3600 },
    timeline: '2-3 days',
    utilityInvolvement: true
  },

  // Florida
  {
    region: 'Miami, FL',
    state: 'FL',
    fromService: 100,
    toService: 200,
    costRange: { min: 3200, max: 4500 },
    timeline: '3-4 days',
    utilityInvolvement: true
  },
  {
    region: 'Tampa, FL',
    state: 'FL',
    fromService: 100,
    toService: 200,
    costRange: { min: 2800, max: 3800 },
    timeline: '2-3 days',
    utilityInvolvement: true
  },
  {
    region: 'Orlando, FL',
    state: 'FL',
    fromService: 100,
    toService: 200,
    costRange: { min: 2900, max: 3900 },
    timeline: '2-3 days',
    utilityInvolvement: true
  },

  // Add more regions as data becomes available
];

export function getServiceUpgradeCost(
  region: string,
  fromService: number,
  toService: number
): ServiceUpgradeCost | null {
  return serviceUpgradeCosts.find(
    cost =>
      cost.region === region &&
      cost.fromService === fromService &&
      cost.toService === toService
  ) || null;
}

// Fallback: National average if region not found
export function getNationalAverageCost(
  fromService: number,
  toService: number
): ServiceUpgradeCost {
  const multiplier = toService / fromService;
  const baseCost = 3000; // Average 100A → 200A upgrade

  return {
    region: 'National Average',
    state: 'US',
    fromService,
    toService,
    costRange: {
      min: Math.round(baseCost * multiplier * 0.9),
      max: Math.round(baseCost * multiplier * 1.3)
    },
    timeline: '2-4 days',
    utilityInvolvement: true,
    notes: 'Estimate based on national averages. Actual costs vary by region.'
  };
}
```

#### Update Service Upgrade Results:

Add cost estimate section when upgrade is needed:

```typescript
{result.status === 'upgrade-needed' && (
  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
    <h5 className="font-semibold text-blue-900 mb-3">
      💰 Estimated Service Upgrade Cost
    </h5>

    <div className="bg-white rounded-lg p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm text-gray-600">
          Upgrade from {currentService}A to {recommendedService}A
        </div>
        <div className="text-xl font-bold text-electric-600">
          ${cost.min.toLocaleString()} - ${cost.max.toLocaleString()}
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <div>• Timeline: {cost.timeline}</div>
        <div>• Includes: New meter, panel, service conductors, permit</div>
        {cost.utilityInvolvement && (
          <div>• Requires utility coordination</div>
        )}
      </div>

      {cost.notes && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-600">
            ℹ️ {cost.notes}
          </div>
        </div>
      )}
    </div>

    <div className="mt-3">
      <label className="text-sm text-gray-700">
        Select your region for accurate pricing:
      </label>
      <select
        value={selectedRegion}
        onChange={e => setSelectedRegion(e.target.value)}
        className="mt-1 w-full"
      >
        <option value="">National Average</option>
        <optgroup label="California">
          <option value="San Diego, CA">San Diego</option>
          <option value="Los Angeles, CA">Los Angeles</option>
          <option value="San Francisco, CA">San Francisco</option>
        </optgroup>
        <optgroup label="Texas">
          <option value="Austin, TX">Austin</option>
          <option value="Houston, TX">Houston</option>
          <option value="Dallas, TX">Dallas</option>
        </optgroup>
        <optgroup label="Florida">
          <option value="Miami, FL">Miami</option>
          <option value="Tampa, FL">Tampa</option>
          <option value="Orlando, FL">Orlando</option>
        </optgroup>
      </select>
    </div>
  </div>
)}
```

---

## PRIORITY 4: Load Templates Library 📚

**Goal:** Pre-populated scenarios for instant calculations

**Effort:** 4-6 hours
**Impact:** 🟡 MEDIUM - Speeds up quoting
**Status:** ✅ Partially exists, needs expansion

### Expand Existing Templates

**Current:** 25+ load templates in Service Upgrade Wizard
**Add:** EV-specific templates

```typescript
export const evInstallerTemplates = [
  {
    id: 'typical-2000sqft-gas-heat',
    name: 'Typical 2,000 sq ft Home (Gas Heat)',
    description: 'Most common California home profile',
    inputs: {
      squareFeet: 2000,
      heating: 'gas',
      cooling: '3-ton',
      range: 'electric',
      waterHeater: 'gas',
      dryer: 'electric'
    }
  },
  {
    id: 'typical-2000sqft-electric-heat',
    name: 'Typical 2,000 sq ft Home (Electric Heat)',
    description: 'Common in Pacific Northwest',
    inputs: {
      squareFeet: 2000,
      heating: 'electric',
      cooling: '2-ton',
      range: 'electric',
      waterHeater: 'electric-50gal',
      dryer: 'electric'
    }
  },
  {
    id: 'all-electric-efficient',
    name: 'All-Electric Home (Efficient)',
    description: 'Heat pump HVAC, heat pump water heater',
    inputs: {
      squareFeet: 2400,
      heating: 'heat-pump',
      cooling: 'heat-pump',
      range: 'induction',
      waterHeater: 'heat-pump',
      dryer: 'heat-pump'
    }
  },
  {
    id: 'older-home-100a',
    name: 'Older Home (100A Service)',
    description: 'Built pre-1980, likely needs upgrade',
    inputs: {
      serviceRating: 100,
      squareFeet: 1600,
      heating: 'gas',
      cooling: '2-ton',
      range: 'gas',
      waterHeater: 'gas',
      dryer: 'gas'
    }
  }
];
```

### Quick Template Selector UI:

```typescript
<div className="mb-6">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Quick Start Templates
  </label>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {evInstallerTemplates.map(template => (
      <button
        key={template.id}
        onClick={() => applyTemplate(template)}
        className="p-3 border-2 border-gray-200 rounded-lg hover:border-electric-500 hover:bg-electric-50 transition-colors text-left"
      >
        <div className="font-medium text-gray-900">{template.name}</div>
        <div className="text-xs text-gray-600 mt-0.5">
          {template.description}
        </div>
      </button>
    ))}
  </div>
</div>
```

---

## LOWER PRIORITY ENHANCEMENTS

### Priority 5: Sub-Panel Decision Tree (4-6 hours)
- Visual flowchart: "Should I add sub-panel or upgrade service?"
- Decision factors: Panel capacity, physical space, cost

### Priority 6: Load Management System Sizer (10-12 hours)
- Tesla Neurio, Lumin Smart Panel sizing
- Commercial EVEMS for apartments
- Calculates how many chargers can share available capacity

### Priority 7: NEC Version Selector (2-3 hours)
- Support NEC 2017, 2020, 2023, 2026
- Different demand factors by version
- Jurisdiction database integration

---

## 📊 Implementation Priority Summary

| Priority | Feature | Effort | Impact | Status | Deploy |
|----------|---------|--------|--------|--------|--------|
| 🥇 **1** | Simplify Service Upgrade UI | 6-8h | 🔥 HIGH | Enhancement | Week 1 |
| 🥇 **2** | Circuit Sharing Calculator | 8-10h | 🔥 HIGH | New | Week 2 |
| 🥈 **3** | Cost Estimator | 6-8h | 🟡 MED-HIGH | New | Week 2 |
| 🥈 **4** | Load Templates | 4-6h | 🟡 MEDIUM | Enhancement | Week 1 |
| 🥉 **5** | Sub-Panel Decision Tree | 4-6h | 🟢 MEDIUM | New | Week 3 |
| 🥉 **6** | Load Management Sizer | 10-12h | 🟢 MEDIUM | New | Week 4 |
| 🥉 **7** | NEC Version Selector | 2-3h | 🟢 LOW | Enhancement | Week 4 |

**Total Effort:**
- **Priority 1-2 (Critical):** 14-18 hours
- **Priority 3-4 (Important):** 10-14 hours
- **Priority 5-7 (Nice-to-have):** 16-21 hours
- **Grand Total:** 40-53 hours

---

## 🚀 Recommended Launch Plan

### Phase 1: MVP (Week 1-2) - 24-32 hours
1. ✅ Simplify Service Upgrade Calculator (6-8h)
2. ✅ Add Load Templates (4-6h)
3. ✅ Circuit Sharing Calculator (8-10h)
4. ✅ Cost Estimator (6-8h)

**Result:** Competitive with UNIQUE features (circuit sharing)

### Phase 2: Polish (Week 3-4) - 16-21 hours
5. Sub-Panel Decision Tree (4-6h)
6. Load Management Sizer (10-12h)
7. NEC Version Selector (2-3h)

**Result:** Most comprehensive EV installer tool on market

---

## ✅ Success Metrics

### Quantitative:
- Calculator completion time: < 60 seconds (currently ~5-10 minutes)
- Mobile usability: 90%+ tasks completable on phone
- Conversion rate: 15-20% free trial → Pro tier

### Qualitative:
- User feedback: "Faster than driving to job site"
- Contractor quote accuracy: <5% variance from actual
- Circuit sharing discovery: 30% of "upgrade needed" scenarios have sharing option

---

**Next Step:** Start with Priority 1 (Simplify UI) - shall I begin implementation?
