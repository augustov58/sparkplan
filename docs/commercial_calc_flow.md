# Commercial/Industrial Electrical Design Workflow
## NEC 2023 Compliance - Non-Dwelling Occupancies

This document provides a detailed textual flowchart for designing electrical systems for commercial and industrial occupancies following NEC 2023 requirements.

---

## 1. PROJECT SCOPE & REQUIREMENTS GATHERING

### 1.1 Occupancy Classification
```
START: Determine Building Occupancy Type
│
├─ Assembly (NEC 518) → Churches, theaters, restaurants, convention centers
├─ Business → Offices, banks, professional buildings
├─ Educational (NEC 517.3) → Schools, colleges, daycare
├─ Healthcare (NEC 517) → Hospitals, clinics, nursing homes, medical offices
├─ Industrial → Manufacturing, warehouses, workshops
├─ Mercantile → Retail stores, shopping centers, markets
├─ Storage → Warehouses, self-storage, parking garages
├─ Multi-Family (3+ units) → Apartments, condos (see NEC 220.84)
└─ Mixed-Use → Combination of above
```

### 1.2 Building Information Required
```
Collect Building Data:
│
├─ Total Floor Area (sq ft per floor)
├─ Number of Floors / Stories
├─ Ceiling Heights (affects lighting calculations)
├─ Hours of Operation (24/7, business hours, etc.)
├─ Occupant Load (persons per 1000 sq ft)
├─ Special Areas:
│  ├─ Server Rooms / Data Centers
│  ├─ Commercial Kitchens
│  ├─ Clean Rooms / Labs
│  ├─ Mechanical Rooms (HVAC, pumps)
│  ├─ Elevator Machine Rooms
│  └─ Emergency Systems (NEC 700, 701, 702, 708)
│
└─ Architectural Plans:
   ├─ Floor plans with room layouts
   ├─ Reflected ceiling plans
   ├─ Mechanical/HVAC locations
   └─ Site plan (service entrance location)
```

### 1.3 Utility Service Parameters
```
Verify with Utility Company:
│
├─ Available Service:
│  ├─ Single-Phase 120/240V (small commercial)
│  ├─ Three-Phase 120/208V (common commercial)
│  ├─ Three-Phase 277/480V (large commercial/industrial)
│  ├─ Three-Phase 120/240V Delta (industrial)
│  └─ High Voltage (4160V, 13.8kV) → Requires on-site transformer
│
├─ Service Location:
│  ├─ Overhead or Underground
│  ├─ Service Entrance Location
│  └─ Meter Location Requirements
│
└─ Fault Current Available (for SCCR sizing):
   └─ Request utility fault study data
```

### 1.4 Code & Authority Requirements
```
Identify Applicable Codes:
│
├─ National Electrical Code (NEC 2023)
├─ State/Local Amendments to NEC
├─ Building Code (IBC)
├─ Fire Code (NFPA)
├─ Energy Code (ASHRAE 90.1, Title 24, etc.)
├─ ADA Requirements (accessibility)
├─ OSHA Requirements (workplace safety)
└─ Special Codes:
   ├─ NEC 517 (Healthcare Facilities)
   ├─ NEC 518 (Assembly Occupancies)
   ├─ NEC 590 (Temporary Installations)
   └─ NFPA 70E (Arc Flash / Electrical Safety)
```

---

## 2. LOAD CALCULATION (NEC Article 220, Part III & IV)

### 2.1 General Lighting Load (NEC 220.12, Table 220.12)

```
Calculate Lighting Load by Occupancy:
│
├─ Banks: 3.5 VA/sq ft × floor area
├─ Offices: 1.0 VA/sq ft × floor area
├─ Schools: 1.0 VA/sq ft × floor area
├─ Stores: 1.5 VA/sq ft × floor area
├─ Warehouses (storage): 0.25 VA/sq ft × floor area
├─ Warehouses (industrial/commercial): 1.0 VA/sq ft × floor area
├─ Hotels/Motels: 1.0 VA/sq ft × floor area
├─ Hospitals: 2.0 VA/sq ft × floor area
└─ Restaurants: 2.0 VA/sq ft × floor area
│
└─ Example: 10,000 sq ft office
   Lighting Load = 10,000 × 1.0 = 10,000 VA
```

**Note**: Actual lighting fixtures may be less due to LED efficiency, but NEC minimum applies for service sizing.

### 2.2 Receptacle Loads (NEC 220.14)

```
Calculate Receptacle Loads:
│
├─ General Use Receptacles:
│  ├─ Option A (by count): 180 VA per receptacle
│  ├─ Option B (by area): Included in Table 220.12 for some occupancies
│  └─ Option C (actual): List actual receptacle loads if known
│
├─ Commercial/Industrial Receptacles:
│  ├─ Office: 1 duplex per 120 sq ft minimum (180 VA each)
│  ├─ Show Window Lighting: 200 VA per linear foot (NEC 220.14(G))
│  ├─ Sign Outlet: 1200 VA per outlet (NEC 220.14(F))
│  └─ Multi-Outlet Assemblies:
│     ├─ Simultaneous use: 180 VA per 5 ft or fraction
│     └─ Not simultaneous: 180 VA per 1 ft or fraction
│
└─ Demand Factors (NEC 220.44):
   ├─ First 10 kVA @ 100%
   ├─ Remainder @ 50%
   │
   Example: 50 receptacles × 180 VA = 9,000 VA
   Demand = 9,000 × 100% = 9,000 VA (under 10 kVA)

   Example: 100 receptacles × 180 VA = 18,000 VA
   Demand = 10,000 + (8,000 × 50%) = 14,000 VA
```

### 2.3 HVAC Loads (NEC 220.14(C))

```
Calculate HVAC Equipment Load:
│
├─ Air Conditioning / Heat Pump:
│  ├─ Use nameplate FLA (Full Load Amps)
│  ├─ Convert to VA: FLA × Voltage × √3 (3-phase) or × 1 (1-phase)
│  ├─ Apply 125% continuous load factor (NEC 220.14(C))
│  └─ Largest motor: Add 25% to largest motor (NEC 430.24)
│
├─ Electric Heating:
│  ├─ Use nameplate kW rating
│  ├─ Convert to VA (kW × 1000 = VA)
│  └─ Apply 125% continuous load factor
│
├─ Omit Smallest Load (NEC 220.60):
│  └─ Do not include both heating and cooling in load calc
│     (use larger of the two)
│
└─ Example: 10-ton rooftop unit (3-phase, 208V)
   Nameplate: 42 FLA
   Load = 42 × 208 × 1.732 × 1.25 = 18,900 VA
```

### 2.4 Motor Loads (NEC Article 430)

```
Calculate Motor Loads:
│
├─ Individual Motors:
│  ├─ Use Table 430.250 (Single-Phase) or 430.250 (3-Phase) for FLA
│  ├─ Load = FLA × Voltage × √3 (3-phase) or × 1 (1-phase)
│  └─ Largest motor: 125% of FLA (NEC 430.24)
│
├─ Multiple Motors (NEC 430.24):
│  └─ Sum of all motor FLAs + 25% of largest motor FLA
│
├─ Motor Control Centers (MCCs):
│  └─ Sum all connected motor loads with appropriate demand factors
│
└─ Examples:
   ├─ Elevators: Use nameplate data + 25% largest motor
   ├─ Pumps: Sum of all pump motors + 25% largest
   ├─ Fans/Blowers: Dedicated HVAC loads
   └─ Compressors: Include in HVAC or process loads
```

### 2.5 Commercial Kitchen Equipment (NEC 220.56)

```
Calculate Commercial Kitchen Load:
│
├─ Method 1: Nameplate Rating (Use if ≤3 pieces)
│  └─ Sum of all appliance nameplate ratings
│
├─ Method 2: Demand Factors (Use if >3 pieces) - Table 220.56
│  ├─ 6+ units: First 3 @ 100%, Next 3 @ 65%, Remainder @ 25%
│  └─ Example: 8 units totaling 120 kW
│     Demand = (3 × 100%) + (3 × 65%) + (2 × 25%)
│             = 3 + 1.95 + 0.5 = 5.45 demand factor
│     Demand Load = 120 kW × (5.45/8) = 81.75 kW
│
├─ Specific Equipment:
│  ├─ Electric Ranges (commercial)
│  ├─ Ovens (conveyor, convection, deck)
│  ├─ Fryers
│  ├─ Griddles
│  ├─ Steamers
│  ├─ Dishwashers (booster heaters)
│  └─ Walk-in Coolers/Freezers
│
└─ Hood & Ventilation:
   └─ Include exhaust fan motors (typically 3-phase)
```

### 2.6 Water Heating Equipment

```
Calculate Water Heater Load:
│
├─ Electric Water Heaters:
│  ├─ Use nameplate kW rating
│  ├─ Demand Factor (NEC 220.54):
│  │  └─ Commercial: 100% (no demand reduction)
│  └─ Continuous load: Apply 125% factor
│
├─ Heat Pump Water Heaters:
│  └─ Use compressor + resistance element nameplate
│
└─ Example: 80-gallon commercial water heater
   Nameplate: 12 kW (two 6 kW elements)
   Load = 12 kW × 1000 × 1.25 = 15,000 VA
```

### 2.7 Special Loads

```
Identify & Calculate Special Loads:
│
├─ Data Centers / Server Rooms:
│  ├─ IT Load (kW per rack)
│  ├─ Cooling Load (1.5× IT load typical)
│  ├─ UPS System losses (10-15%)
│  └─ Redundancy (N+1, 2N)
│
├─ Medical Equipment (NEC 517):
│  ├─ X-Ray: Momentary rating (NEC 517.73)
│  ├─ MRI: High inrush considerations
│  └─ Critical branch loads
│
├─ Industrial Process Equipment:
│  ├─ Welders: Use duty cycle (NEC 630)
│  ├─ Induction Heating
│  ├─ Furnaces / Kilns
│  └─ CNC Machines / Robotics
│
├─ Electric Vehicle Charging Stations (NEC 625):
│  ├─ Level 2 (7-19 kW per charger)
│  ├─ DC Fast Charge (50-350 kW per charger)
│  └─ Demand factors per NEC 625.41, 625.42
│
├─ Elevators (NEC 620):
│  └─ Use nameplate + 25% largest motor rule
│
└─ Emergency/Standby Systems (NEC 700, 701, 702):
   ├─ Life Safety (NEC 700)
   ├─ Legally Required Standby (NEC 701)
   └─ Optional Standby (NEC 702)
```

### 2.8 Demand Factor Application (NEC 220.40, 220.42)

```
Apply Demand Factors to Total Load:
│
├─ Step 1: Sum All Calculated Loads
│  ├─ Lighting load (at 100% initially)
│  ├─ Receptacle load (with 220.44 demand applied)
│  ├─ HVAC load (larger of heating/cooling at 125%)
│  ├─ Motor loads (sum + 25% largest)
│  ├─ Kitchen equipment (with 220.56 demand if applicable)
│  ├─ Water heating (at 125%)
│  └─ Special loads (at 100% unless specific demand applies)
│
├─ Step 2: Check for Additional Demand Factors
│  ├─ NEC 220.42: Lighting demand for certain occupancies
│  │  └─ Example: Hospital/Hotel lighting >20,000 VA → 50% demand on excess
│  │
│  └─ NEC 220.44: Receptacle demand (already applied above)
│
└─ Step 3: Calculate Total Demand Load
   Total Demand Load (VA) = Sum of all demand loads
```

### 2.9 Service Size Determination (NEC 230.42)

```
Determine Minimum Service Size:
│
├─ Convert Total Demand Load to Amperes:
│  ├─ Single-Phase: Amps = Total VA ÷ Voltage
│  └─ Three-Phase: Amps = Total VA ÷ (Voltage × √3)
│
├─ Apply Safety Margin:
│  └─ Design for 80% utilization (leave 20% spare capacity)
│     Service Size = Calculated Amps ÷ 0.80
│
├─ Round Up to Standard Service Size:
│  └─ Standard sizes: 100A, 150A, 200A, 400A, 600A, 800A, 1000A, 1200A, 1600A, 2000A, 2500A, 3000A, 4000A
│
└─ Example: Office Building
   Total Demand Load = 85,000 VA (208V, 3-phase)
   Calculated Amps = 85,000 ÷ (208 × 1.732) = 236A
   With 20% margin = 236 ÷ 0.80 = 295A
   Selected Service = 400A (next standard size)
```

---

## 3. SERVICE ENTRANCE DESIGN

### 3.1 Service Conductor Sizing (NEC 230.42, Table 310.16)

```
Size Service Entrance Conductors:
│
├─ Step 1: Use Service Size from Load Calculation
│  └─ Example: 400A service determined above
│
├─ Step 2: Select Conductor Based on NEC 310.16
│  ├─ Choose conductor material (Copper or Aluminum)
│  ├─ Choose temperature rating (75°C common, 90°C for derating only)
│  ├─ Apply adjustment factors if needed:
│  │  ├─ Ambient temperature correction (Table 310.15(B)(1))
│  │  └─ Conduit fill adjustment (Table 310.15(C)(1))
│  │
│  └─ Example: 400A service, 75°C Copper
│     Table 310.16 (75°C): 400A requires 500 kcmil Cu or 750 kcmil Al
│
├─ Step 3: Parallel Conductors (if needed for >1000A)
│  └─ NEC 310.10(H): Paralleling requirements
│     ├─ Same length, material, size, insulation
│     ├─ Terminated same manner
│     └─ Minimum size: 1/0 AWG
│
└─ Step 4: Voltage Drop Check (NEC Recommendation: 3% feeder + 2% branch = 5% total)
   └─ For service conductors, target <2% voltage drop
```

### 3.2 Service Grounding (NEC 250, Part III)

```
Design Grounding Electrode System:
│
├─ Grounding Electrode System (NEC 250.50):
│  ├─ Metal Water Pipe (NEC 250.52(A)(1))
│  │  └─ Must bond 10 ft of underground metal water pipe
│  │
│  ├─ + Concrete-Encased Electrode (NEC 250.52(A)(3)) - "Ufer ground"
│  │  └─ #4 AWG Cu (20 ft min) or rebar in footing
│  │
│  ├─ + Ground Ring (NEC 250.52(A)(4)) (if applicable)
│  │  └─ #2 AWG Cu (min), encircling building, 20 ft min
│  │
│  └─ + Ground Rods (NEC 250.52(A)(5))
│     └─ Two 8-ft ground rods, 6 ft apart minimum
│
├─ Grounding Electrode Conductor (GEC) Sizing (NEC 250.66, Table 250.66):
│  └─ Based on largest service conductor
│     Example: 500 kcmil Cu service → #1/0 Cu GEC (Table 250.66)
│
├─ Main Bonding Jumper (MBJ) (NEC 250.28):
│  └─ Located in service disconnect
│  └─ Size per Table 250.102(C)(1)
│
└─ Equipment Grounding Conductor (EGC) (NEC 250.122, Table 250.122):
   └─ Size based on overcurrent device rating
      Example: 400A main breaker → #3 Cu EGC (Table 250.122)
```

### 3.3 Service Disconnect (NEC 230.70-230.95)

```
Select & Install Service Disconnect:
│
├─ Location Requirements (NEC 230.70):
│  ├─ Nearest point of entrance
│  ├─ Readily accessible location
│  └─ Outside or inside near point of entrance
│
├─ Number of Disconnects (NEC 230.71):
│  └─ Maximum 6 switches/breakers per service
│
├─ Main Breaker or Fused Switch:
│  ├─ Type: Molded Case Circuit Breaker (MCCB) or Fused Switch
│  ├─ Rating: Match service size (400A example)
│  ├─ Interrupting Rating (AIR/AIC): Must exceed available fault current (NEC 110.9)
│  │  └─ Typical: 22kA, 42kA, 65kA, or 100kA
│  ├─ Voltage Rating: Match system voltage (208V, 480V, etc.)
│  └─ Features:
│     ├─ Ground Fault Protection (NEC 230.95) - Required for 1000A+ services >150V-to-ground
│     └─ Shunt trip (for fire alarm integration)
│
└─ Service Panel / Switchboard:
   ├─ Bus rating matches service size
   ├─ Number of spaces for branch breakers
   └─ Indoor (NEMA 1) or Outdoor (NEMA 3R) enclosure
```

### 3.4 Short Circuit & Arc Flash Analysis

```
Perform Fault Current Calculation:
│
├─ Step 1: Obtain Utility Fault Current Data
│  └─ Request from utility: Available fault current at service point (kA)
│
├─ Step 2: Calculate Service Entrance Fault Current (NEC 110.9)
│  └─ Account for transformer impedance and conductor impedance
│     Utility Transformer → Service Conductors → Service Panel
│
├─ Step 3: Select Equipment with Adequate Interrupting Rating
│  ├─ Main Breaker AIC ≥ Available Fault Current
│  └─ All downstream breakers AIC ≥ Available Fault Current at location
│
└─ Step 4: Arc Flash Analysis (NFPA 70E)
   ├─ Calculate incident energy (cal/cm²)
   ├─ Determine arc flash boundary
   ├─ Specify required PPE category
   └─ Create arc flash labels for equipment
      Example: "DANGER - Arc Flash Hazard
               Incident Energy: 8 cal/cm² at 18 inches
               PPE Category 2 Required
               Restricted Approach Boundary: 12 inches"
```

---

## 4. PANELBOARD & DISTRIBUTION DESIGN

### 4.1 Panelboard Selection & Layout

```
Design Panelboard System:
│
├─ Determine Number of Panels Needed:
│  ├─ Based on building size/zones
│  ├─ Physical location for voltage drop management
│  ├─ Separate panels for:
│  │  ├─ Normal power
│  │  ├─ Emergency power (NEC 700)
│  │  ├─ Critical branch (healthcare - NEC 517)
│  │  └─ HVAC equipment
│  │
│  └─ Panel Naming Convention:
│     Examples: MDP (Main Distribution Panel), LP1 (Lighting Panel 1),
│               PP1 (Power Panel 1), EP (Emergency Panel)
│
├─ Size Each Panel:
│  ├─ Calculate total branch circuit load on panel
│  ├─ Sum continuous loads × 1.25
│  ├─ Panel main breaker ≥ calculated load
│  ├─ Panel bus rating ≥ main breaker size
│  └─ Number of spaces: Count all branch circuits + 20% spare
│     Standard sizes: 12, 20, 24, 30, 42 spaces (208V/120V)
│                     12, 18, 24, 30, 42 spaces (480V/277V)
│
├─ Panel Specifications:
│  ├─ Voltage: 120/208V 3Φ 4W (common) or 277/480V 3Φ 4W (large commercial)
│  ├─ Bus Rating: 100A, 125A, 225A, 400A, 600A
│  ├─ Main Breaker or Main Lug Only (MLO)
│  ├─ Indoor (NEMA 1) or Outdoor (NEMA 3R)
│  └─ Surface or Flush Mount
│
└─ Panel Location Requirements (NEC 408.36, 408.40):
   ├─ Accessible location (not in bathrooms, clothes closets)
   ├─ Dedicated space (NEC 110.26):
   │  ├─ Working clearance: 36" depth (minimum)
   │  ├─ Width: 30" or panel width, whichever is greater
   │  └─ Height: 6.5 ft from floor or ceiling height
   ├─ Adequate illumination (NEC 110.26(D))
   └─ Avoid wet/damp locations unless rated for it
```

### 4.2 Feeder Design (NEC Article 215)

```
Design Feeders from Service to Panels:
│
├─ Step 1: Calculate Feeder Load
│  ├─ Sum all branch circuit loads on panel
│  ├─ Apply demand factors if applicable:
│  │  └─ Lighting (NEC 220.42), Receptacles (NEC 220.44)
│  ├─ Continuous loads × 1.25
│  └─ Total Feeder Load (VA)
│
├─ Step 2: Size Feeder Conductors (NEC 215.2, Table 310.16)
│  ├─ Convert VA to Amps:
│  │  ├─ Single-Phase: Amps = VA ÷ V
│  │  └─ Three-Phase: Amps = VA ÷ (V × 1.732)
│  ├─ Select conductor from Table 310.16 (75°C column)
│  ├─ Apply derating factors:
│  │  ├─ Ambient temperature (Table 310.15(B)(1))
│  │  └─ Conduit fill >3 current-carrying (Table 310.15(C)(1))
│  │
│  └─ Example: 100A feeder, 208V 3-phase, 75°C Cu
│     Table 310.16: #3 Cu (100A) or #1 Al (100A)
│
├─ Step 3: Size Feeder Overcurrent Protection (NEC 215.3)
│  ├─ Breaker/fuse rating ≥ feeder calculated load
│  ├─ Not exceed conductor ampacity (unless exception)
│  └─ Example: #3 Cu (100A ampacity) → 100A breaker max
│
├─ Step 4: Size Feeder Equipment Grounding Conductor (NEC 250.122)
│  └─ Based on feeder overcurrent device rating
│     Example: 100A breaker → #8 Cu EGC (Table 250.122)
│
├─ Step 5: Voltage Drop Check (NEC 215.2(A)(1) FPN)
│  ├─ Calculate voltage drop: VD = (2 × K × I × L) ÷ CM
│  │  Where: K = 12.9 (Cu) or 21.2 (Al)
│  │         I = Current (amps)
│  │         L = One-way length (feet)
│  │         CM = Circular mils of conductor
│  ├─ Target: ≤3% for feeders (NEC recommendation)
│  └─ If VD exceeds 3%, upsize conductors
│
└─ Step 6: Raceway Sizing (NEC Chapter 9, Annex C)
   ├─ Count conductors: Phase + Neutral + Ground
   ├─ Select conduit type: EMT, RMC, PVC, etc.
   ├─ Use NEC Annex C for conduit fill tables
   └─ Example: (4) #3 Cu THHN in EMT → 1" EMT (Annex C, Table C1)
```

---

## 5. BRANCH CIRCUIT DESIGN (NEC Article 210)

### 5.1 Lighting Branch Circuits

```
Design Lighting Circuits:
│
├─ Circuit Types:
│  ├─ 120V Circuits (offices, small retail):
│  │  └─ 15A or 20A circuits
│  │
│  └─ 277V Circuits (warehouses, large commercial):
│     └─ 20A circuits (common for fluorescent/LED high-bay)
│
├─ Load Calculation per Circuit:
│  ├─ Continuous load: Fixtures × Wattage × 1.25
│  ├─ Max load on circuit:
│  │  ├─ 15A @ 120V = 1,800 VA × 80% = 1,440 VA max continuous
│  │  ├─ 20A @ 120V = 2,400 VA × 80% = 1,920 VA max continuous
│  │  └─ 20A @ 277V = 5,540 VA × 80% = 4,432 VA max continuous
│  │
│  └─ Example: LED fixtures (30W each)
│     20A @ 120V circuit: 1,920 VA ÷ (30W × 1.25) = 51 fixtures max
│
├─ Conductor Sizing (NEC 210.19):
│  ├─ 15A circuit: #14 Cu minimum (NEC 210.19(A))
│  ├─ 20A circuit: #12 Cu minimum
│  └─ Voltage drop: ≤3% for branch circuits (5% total feeder + branch)
│
├─ Lighting Control Requirements:
│  ├─ NEC 210.70: Required lighting outlets (egress, stairways, etc.)
│  ├─ Energy Code (ASHRAE 90.1, Title 24):
│  │  ├─ Occupancy sensors (required in many spaces)
│  │  ├─ Daylight harvesting (for spaces with windows)
│  │  ├─ Automatic shutoff (after hours)
│  │  └─ Multi-level switching (50% ON capability)
│  │
│  └─ Emergency Lighting (NEC 700):
│     ├─ Exit signs
│     ├─ Egress path lighting
│     └─ Transfer to emergency/generator power
│
└─ Special Lighting Circuits:
   ├─ Show Window Lighting (NEC 220.14(G)): 200 VA per linear foot
   ├─ Track Lighting: Specific load calculations
   └─ Sign Lighting: Dedicated 20A circuit (NEC 600.5)
```

### 5.2 Receptacle Branch Circuits

```
Design Receptacle Circuits:
│
├─ General-Use Receptacles (NEC 210.52):
│  ├─ 120V, 15A or 20A circuits
│  ├─ Load assumption: 180 VA per receptacle
│  ├─ Maximum per circuit:
│  │  ├─ 15A circuit: 10 receptacles (1,800 VA ÷ 180)
│  │  └─ 20A circuit: 13 receptacles (2,400 VA ÷ 180)
│  │
│  └─ Spacing Requirements (varies by space type):
│     ├─ Offices: 1 duplex per 120 sq ft
│     ├─ Retail: Per architectural layout
│     └─ Corridors: Every 50 feet
│
├─ Dedicated Receptacle Circuits:
│  ├─ Appliances (refrigerators, microwaves): 20A individual circuits
│  ├─ Copy machines / Printers: 20A individual circuits
│  ├─ Vending machines: 20A individual circuits
│  └─ Computer equipment: Separate circuits from general lighting
│
├─ GFCI Protection Requirements (NEC 210.8):
│  ├─ Bathrooms: All receptacles (NEC 210.8(B)(1))
│  ├─ Rooftops: All receptacles (NEC 210.8(B)(3))
│  ├─ Kitchens: Sinks within 6 ft (NEC 210.8(B)(2))
│  ├─ Outdoors: All 15A & 20A, 150V or less (NEC 210.8(B)(4))
│  └─ Indoor wet locations: All receptacles (NEC 210.8(B)(5))
│
├─ AFCI Protection Requirements (NEC 210.12):
│  └─ Generally NOT required in commercial (mainly dwelling units)
│     Check local amendments
│
└─ Special Receptacles:
   ├─ 208V/240V Single-Phase: HVAC equipment, appliances
   ├─ 480V Three-Phase: Industrial machinery
   └─ Isolated Ground Receptacles (IG): Data centers, medical (NEC 250.146(D))
```

### 5.3 HVAC & Equipment Circuits

```
Design HVAC & Equipment Circuits:
│
├─ Air Conditioning Units:
│  ├─ Use nameplate MCA (Minimum Circuit Ampacity)
│  ├─ Use nameplate MOCP (Maximum Overcurrent Protection)
│  ├─ Conductor ampacity ≥ MCA
│  ├─ Breaker/fuse ≤ MOCP
│  ├─ Disconnect within sight (NEC 440.14)
│  └─ Example: 5-ton rooftop unit
│     Nameplate: MCA = 28A, MOCP = 40A
│     Conductor: #10 Cu (30A ampacity)
│     Breaker: 40A
│
├─ Motors (NEC Article 430):
│  ├─ Use Table 430.250 for FLA (not nameplate)
│  ├─ Conductor: 125% of FLA (NEC 430.22)
│  ├─ Overload protection: 115-125% of FLA (NEC 430.32)
│  ├─ Short-circuit protection: 250-300% of FLA (NEC 430.52, Table 430.52)
│  ├─ Disconnect within sight (NEC 430.102)
│  │
│  └─ Example: 10 HP, 3-phase, 208V motor
│     Table 430.250: FLA = 30.8A
│     Conductor: 30.8 × 1.25 = 38.5A → #8 Cu (50A)
│     Overload: 30.8 × 1.25 = 38.5A overload heater
│     Short-circuit breaker: 30.8 × 2.5 = 77A → 80A breaker
│
├─ Electric Heating:
│  ├─ Use nameplate kW rating
│  ├─ Conductor: 125% of full load (NEC 424.3(B))
│  └─ Thermostat / controls (line voltage or low voltage)
│
└─ Elevators (NEC 620):
   ├─ Dedicated feeder from service or distribution
   ├─ Separate disconnect (within sight of controller)
   └─ Machine room lighting and receptacle (NEC 620.23)
```

---

## 6. CONDUCTOR AMPACITY & VOLTAGE DROP

### 6.1 Conductor Ampacity (NEC 310.16)

```
Determine Conductor Ampacity:
│
├─ Step 1: Select Base Ampacity from Table 310.16
│  ├─ Use 75°C column (most common for commercial)
│  ├─ 90°C column only for derating calculations, not terminal ratings
│  └─ Example: #3 Cu @ 75°C = 100A
│
├─ Step 2: Apply Adjustment Factors
│  │
│  ├─ A. Ambient Temperature Correction (Table 310.15(B)(1)):
│  │   └─ If ambient > 30°C (86°F), apply correction factor
│  │      Example: 40°C ambient, 75°C conductor
│  │      Correction factor = 0.88
│  │      Adjusted ampacity = 100A × 0.88 = 88A
│  │
│  └─ B. Conduit Fill Adjustment (Table 310.15(C)(1)):
│     └─ If >3 current-carrying conductors in raceway
│        Example: 6 current-carrying conductors
│        Adjustment factor = 0.80
│        Adjusted ampacity = 88A × 0.80 = 70.4A
│
├─ Step 3: Verify Adjusted Ampacity ≥ Load
│  └─ If adjusted ampacity too low, upsize conductor
│
└─ Special Conditions:
   ├─ Continuous Loads: Conductor ampacity ≥ load × 1.25 (NEC 210.19)
   ├─ Rooftop Conduit: Add 33°C to ambient (NEC 310.15(B)(3)(c))
   └─ Neutral conductor: May not count as current-carrying if <50% unbalanced load
```

### 6.2 Voltage Drop Calculations

```
Calculate & Minimize Voltage Drop:
│
├─ NEC Recommendations (Informational, not mandatory):
│  ├─ Branch circuits: 3% max
│  ├─ Feeders: 3% max
│  └─ Combined (feeder + branch): 5% max
│
├─ Voltage Drop Formula:
│  │
│  ├─ Single-Phase: VD% = (2 × K × I × L) ÷ (CM × V) × 100
│  │
│  └─ Three-Phase: VD% = (1.732 × K × I × L) ÷ (CM × V) × 100
│     Where:
│       K = 12.9 (Cu) or 21.2 (Al)
│       I = Current (amps)
│       L = One-way distance (feet)
│       CM = Circular mils (from NEC Chapter 9, Table 8)
│       V = System voltage (120V, 208V, 480V, etc.)
│
├─ Example: 100A feeder, 150 ft, #3 Cu (52,620 CM), 208V 3-phase
│  VD% = (1.732 × 12.9 × 100 × 150) ÷ (52,620 × 208) × 100
│       = 3,362,940 ÷ 10,944,960 × 100
│       = 3.07% (exceeds 3% → upsize conductor)
│
├─ Upsize to #2 Cu (66,360 CM):
│  VD% = (1.732 × 12.9 × 100 × 150) ÷ (66,360 × 208) × 100
│       = 3,362,940 ÷ 13,802,880 × 100
│       = 2.44% ✓ (acceptable)
│
└─ Strategies to Reduce Voltage Drop:
   ├─ Upsize conductors (most common)
   ├─ Shorten circuit length (relocate panel)
   ├─ Increase system voltage (120V → 208V or 208V → 480V)
   └─ Use copper instead of aluminum (lower resistance)
```

---

## 7. RACEWAY & BOX FILL CALCULATIONS

### 7.1 Raceway (Conduit) Sizing (NEC Chapter 9)

```
Size Raceways:
│
├─ Step 1: Count All Conductors in Raceway
│  ├─ Phase conductors (A, B, C)
│  ├─ Neutral conductor (if present)
│  ├─ Equipment grounding conductor (if present)
│  └─ Note: Do NOT count "signal" wires (e.g., fire alarm, controls) in fill
│
├─ Step 2: Determine Conductor Areas (NEC Chapter 9, Table 5)
│  └─ Example: (4) #3 THHN Cu conductors
│     Table 5: #3 THHN = 0.0973 in²
│     Total area = 4 × 0.0973 = 0.3892 in²
│
├─ Step 3: Select Raceway Size (NEC Chapter 9, Table 4)
│  ├─ Maximum fill: 40% for 3+ conductors (most common)
│  ├─ Use Annex C tables for quick reference
│  │
│  └─ Example: (4) #3 THHN Cu in EMT
│     Annex C, Table C1 (EMT): 1" EMT (40% fill = 0.346 in²) → Too small
│                                1¼" EMT (40% fill = 0.598 in²) ✓
│
├─ Step 4: Select Raceway Type
│  ├─ EMT (Electrical Metallic Tubing): Most common indoor commercial
│  ├─ RMC (Rigid Metal Conduit): Outdoor, underground, hazardous locations
│  ├─ IMC (Intermediate Metal Conduit): Between EMT and RMC
│  ├─ PVC (Polyvinyl Chloride): Underground, corrosive environments
│  ├─ FMC/LFMC (Flexible Metal Conduit): Equipment connections
│  └─ Cable Tray: Large installations, industrial
│
└─ Special Considerations:
   ├─ Nipples ≤24": 60% fill allowed (NEC 314.16(C)(4))
   ├─ Derating: >3 current-carrying conductors require ampacity adjustment
   └─ Support spacing: Per NEC Table 344.30(B)(2), 358.30(B), etc.
```

### 7.2 Junction Box & Pull Box Sizing (NEC 314.16, 314.28)

```
Size Boxes & Pull Boxes:
│
├─ Junction Boxes (Straight Pulls) - NEC 314.28(A)(1):
│  └─ Length ≥ 8 × Trade Size of Largest Raceway
│     Example: Largest raceway = 2" EMT
│     Minimum box length = 8 × 2" = 16"
│
├─ Junction Boxes (Angle Pulls) - NEC 314.28(A)(2):
│  ├─ Distance from raceway entry to opposite wall ≥ 6 × Trade Size
│  └─ Distance between raceways on same wall ≥ 6 × Trade Size of larger
│
├─ Device Boxes (Switches, Receptacles) - NEC 314.16:
│  ├─ Calculate box fill:
│  │  ├─ Conductors: Count each conductor (Table 314.16(B))
│  │  ├─ Clamps: Add 1 conductor for all clamps
│  │  ├─ Devices: Add 2 conductors per device
│  │  ├─ Ground: Add 1 conductor for all grounds
│  │  └─ Total cubic inches = Count × Conductor cubic inch (Table 314.16(B))
│  │
│  └─ Example: Single-gang switch box
│     (2) #12 conductors in = 2
│     (2) #12 conductors out = 2
│     (1) #12 ground = 1
│     (1) Switch = 2
│     (1) Clamps = 1
│     Total = 8 × 2.25 in³ = 18 in³ required
│     Standard 4"×4"×2⅛" box = 30.3 in³ ✓
│
└─ Box Material:
   ├─ Metal boxes: Must be grounded
   └─ Non-metallic (PVC): Allowed in specific locations
```

---

## 8. SPECIAL EQUIPMENT & SYSTEMS

### 8.1 Emergency & Standby Systems (NEC 700, 701, 702)

```
Design Emergency Power Systems:
│
├─ System Types:
│  │
│  ├─ A. Emergency Systems (NEC 700) - REQUIRED by code/AHJ
│  │   ├─ Required loads:
│  │   │  ├─ Exit signs and egress lighting
│  │   │  ├─ Fire alarm systems
│  │   │  ├─ Fire pumps
│  │   │  ├─ Elevator recall (fire service mode)
│  │   │  └─ Emergency voice/alarm communications
│  │   ├─ Transfer time: ≤10 seconds (NEC 700.12)
│  │   ├─ Separate panel (NEC 700.16)
│  │   └─ Ground fault indication (NEC 700.7)
│  │
│  ├─ B. Legally Required Standby (NEC 701) - Required by code/AHJ
│  │   ├─ Examples: HVAC for smoke control, refrigeration
│  │   ├─ Transfer time: ≤60 seconds (NEC 701.12)
│  │   └─ Separate panel (NEC 701.11)
│  │
│  └─ C. Optional Standby (NEC 702) - Owner discretion
│     ├─ Examples: Process equipment, data centers
│     ├─ No specific transfer time requirement
│     └─ Load shedding permitted (NEC 702.6)
│
├─ Power Sources (NEC 700.12, 701.12):
│  ├─ Generator set (most common)
│  ├─ Battery system (UPS)
│  ├─ Separate utility service
│  └─ Fuel cell
│
├─ Transfer Switch:
│  ├─ Automatic transfer switch (ATS) required for NEC 700/701
│  ├─ Manual transfer allowed for NEC 702
│  ├─ Open transition (break-before-make) or Closed transition
│  └─ Bypass-isolation type for maintenance
│
└─ Generator Sizing:
   ├─ Sum all emergency loads
   ├─ Account for motor starting (largest motor × 6)
   ├─ Add 20-25% margin for future loads
   └─ Typical sizes: 20 kW, 30 kW, 50 kW, 80 kW, 100 kW, 150 kW, 200 kW+
```

### 8.2 Fire Alarm & Life Safety (NEC 760)

```
Design Fire Alarm System:
│
├─ Circuit Classifications (NEC 760.21 vs 760.41):
│  │
│  ├─ A. Power-Limited Fire Alarm (PLFA) - NEC 760 Part III
│  │   ├─ Most common (modern addressable systems)
│  │   ├─ Power supply: Listed PLFA or Class 3 transformer
│  │   ├─ Wiring methods: Simplified (NEC 760.130)
│  │   └─ Conductor types: FPL, FPLR, FPLP (plenum)
│  │
│  └─ B. Non-Power-Limited Fire Alarm (NPLFA) - NEC 760 Part II
│     ├─ Legacy systems, notification appliances >70V
│     ├─ Wiring methods: Same as NEC Chapter 3 (rigid conduit, etc.)
│     └─ Conductor types: Standard building wire (THHN, etc.)
│
├─ Circuit Integrity Requirements:
│  ├─ Survivability (NEC 760.3(D)): Fire alarm circuits must function during fire
│  ├─ CI cable (Circuit Integrity): 2-hour fire rating for emergency voice
│  └─ FHIT (Fire-Resistive Cable Systems): Alternative to CI cable
│
├─ Power Supply (NEC 760.41):
│  ├─ Primary: Normal building power (dedicated 20A circuit)
│  ├─ Secondary: Battery backup (24-hour standby + 15-minute alarm)
│  └─ Supervision: Trouble signal if AC power lost
│
└─ Separation from Other Systems (NEC 760.136):
   ├─ PLFA cables may run with other Class 2/3 circuits
   ├─ Separate raceways from power circuits >70V (unless specific exceptions)
   └─ No fire alarm conductors in electrical panels
```

### 8.3 Data Centers & IT Equipment (NEC 645)

```
Design Data Center Power:
│
├─ Load Calculation:
│  ├─ IT Load (kW):
│  │  ├─ Server racks: kW per rack × number of racks
│  │  ├─ Network equipment: Switches, routers, storage
│  │  └─ Density: Typical 3-8 kW/rack (average), up to 20 kW/rack (high-density)
│  │
│  ├─ Cooling Load (kW):
│  │  ├─ CRAC/CRAH units: Typically 1.3-1.5× IT load
│  │  └─ Hot aisle/cold aisle containment reduces cooling
│  │
│  ├─ UPS Losses (kW):
│  │  └─ UPS efficiency: 90-96% (add 4-10% to load)
│  │
│  └─ Redundancy:
│     ├─ N+1: 1 extra capacity unit
│     └─ 2N: Full duplicate (two independent power paths)
│
├─ Branch Circuit Design:
│  ├─ Individual Rack Circuits:
│  │  ├─ (2) 20A circuits per rack (common for 3-5 kW racks)
│  │  ├─ (2) 30A circuits per rack (for 8-12 kW racks)
│  │  └─ Dual-corded servers: Connect to separate power paths (A/B feeds)
│  │
│  ├─ Receptacle Types:
│  │  ├─ NEMA 5-20R (20A, 120V) - Most common
│  │  ├─ C13/C19 (IEC 320): International standard
│  │  └─ High-density PDUs (Power Distribution Units) in racks
│  │
│  └─ Voltage: 120V or 208V (single-phase or 3-phase)
│
├─ Disconnecting Means (NEC 645.10):
│  ├─ EPO (Emergency Power Off) button required
│  ├─ Location: Near principal exit doors
│  └─ Disconnects all power (including UPS) to IT equipment
│
├─ UPS System:
│  ├─ Online double-conversion (most common for data centers)
│  ├─ Capacity: Size for 100% IT load + 20-30% growth
│  ├─ Battery runtime: 5-15 minutes (until generator starts)
│  └─ Maintenance bypass: Allow UPS service without downtime
│
└─ Grounding (NEC 645.15):
   ├─ Isolated ground receptacles (orange) for sensitive equipment
   ├─ Single-point ground reference (signal reference grid)
   └─ Separate AC equipment ground from signal ground
```

---

## 9. CONTROLS, AUTOMATION & ENERGY MANAGEMENT

### 9.1 Lighting Control Systems

```
Design Lighting Controls (Energy Code Compliance):
│
├─ Control Types:
│  │
│  ├─ A. Occupancy Sensors (ASHRAE 90.1, Title 24):
│  │   ├─ Required locations: Offices, conference rooms, classrooms, restrooms, storage
│  │   ├─ Technologies: PIR (Passive Infrared), Ultrasonic, Dual-technology
│  │   ├─ Time delay: 15-20 minutes typical
│  │   └─ Manual ON / Auto OFF or Auto ON / Auto OFF (code varies)
│  │
│  ├─ B. Daylight Harvesting:
│  │   ├─ Required: In spaces with skylights or large windows (>250 sq ft)
│  │   ├─ Photocell sensors measure daylight
│  │   ├─ Dim or switch OFF lights when daylight sufficient
│  │   └─ Integration with window shades/blinds
│  │
│  ├─ C. Time Clock / Scheduling:
│  │   ├─ Automatic shutoff after hours (ASHRAE 90.1 requirement)
│  │   ├─ Manual override: 2-hour maximum
│  │   └─ Holiday/weekend schedules
│  │
│  ├─ D. Multi-Level Switching:
│  │   ├─ Bi-level switching: 50% ON / 100% ON capability
│  │   ├─ Example: Warehouse with high-bay lighting (alternate rows)
│  │   └─ Task lighting vs. ambient lighting control
│  │
│  └─ E. Dimming:
│     ├─ 0-10V analog dimming (common for LED)
│     ├─ DALI (Digital Addressable Lighting Interface)
│     ├─ DMX512 (theatrical/architectural lighting)
│     └─ Wireless (Zigbee, Bluetooth Mesh)
│
├─ Wiring Requirements (NEC 725):
│  ├─ Class 1 (line-voltage): Standard building wire in conduit
│  ├─ Class 2 (low-voltage): 0-10V, DALI, dry contact
│  │  └─ Separation: 2" from power conductors (unless rated cable or barrier)
│  └─ Wireless: No wiring, but power at devices (batteries or line voltage)
│
└─ Centralized Lighting Control Systems:
   ├─ Building Management System (BMS) integration
   ├─ Web-based control panels
   ├─ Zone-based control (not individual fixtures)
   └─ Energy monitoring and reporting
```

### 9.2 Building Automation Systems (BAS/BMS)

```
Integrate with Building Automation:
│
├─ Systems Controlled:
│  ├─ HVAC (temperature, scheduling, optimization)
│  ├─ Lighting (scheduling, dimming, occupancy)
│  ├─ Access control (door locks, card readers)
│  ├─ Fire alarm (monitoring, integration)
│  ├─ Security (cameras, alarms)
│  └─ Energy management (demand response, load shedding)
│
├─ Communication Protocols:
│  ├─ BACnet (Building Automation and Control Network) - Most common
│  ├─ Modbus (legacy industrial systems)
│  ├─ LonWorks (older buildings)
│  └─ Proprietary protocols (manufacturer-specific)
│
├─ Network Architecture:
│  ├─ IP-based Ethernet (most modern systems)
│  ├─ RS-485 field bus (devices to controllers)
│  ├─ Wireless (Zigbee, Z-Wave, Wi-Fi) for sensors
│  └─ Cloud connectivity (remote monitoring/control)
│
└─ Electrical Considerations:
   ├─ Dedicated IT network for BAS (separate from business network)
   ├─ Uninterruptible power for controllers
   ├─ Surge protection on communication lines
   └─ Separation of low-voltage control from power circuits
```

---

## 10. LABELING, DOCUMENTATION & INSPECTION

### 10.1 Circuit & Panel Labeling (NEC 408.4, 110.22)

```
Label All Electrical Equipment:
│
├─ Panel Schedules:
│  ├─ Typed or neatly printed schedule in panel door
│  ├─ Include:
│  │  ├─ Circuit number
│  │  ├─ Breaker size (amps)
│  │  ├─ Circuit description/location
│  │  ├─ Conductor size (optional but helpful)
│  │  └─ Panel load summary (total kVA, % loaded)
│  │
│  └─ Update after any circuit changes (required)
│
├─ Panel Identification:
│  ├─ Voltage (example: "208Y/120V 3Φ 4W")
│  ├─ Panel name/number (example: "LP-1", "PANEL A")
│  ├─ Main breaker size (example: "225A MAIN")
│  ├─ Short circuit rating (example: "AIC: 42kA")
│  └─ Fed from (example: "FED FROM MDP")
│
├─ Equipment Labels:
│  ├─ Main service disconnect: "SERVICE DISCONNECT"
│  ├─ Emergency panels: Red letters "EMERGENCY SYSTEM" (NEC 700.9(A))
│  ├─ HVAC disconnects: "AIR CONDITIONING DISCONNECT" at unit
│  ├─ Fire pump disconnect: "FIRE PUMP DISCONNECT" (NEC 695.4(B))
│  └─ Generator: "GENERATOR DISCONNECT"
│
├─ Arc Flash Labels (NFPA 70E):
│  ├─ Required on: Service equipment, panelboards >1200A, MCCs, switchboards
│  ├─ Information:
│  │  ├─ Nominal voltage
│  │  ├─ Arc flash boundary
│  │  ├─ Incident energy (cal/cm²)
│  │  ├─ Working distance
│  │  ├─ Required PPE level
│  │  └─ Date of study / next update due
│  │
│  └─ Example label:
│     "⚡ DANGER - Arc Flash Hazard
│      Incident Energy: 12.4 cal/cm² at 18"
│      Arc Flash Boundary: 48"
│      Shock Hazard: 208V
│      Limited Approach: 3 ft 6 in
│      PPE Category: 3
│      Study Date: 12/2025"
│
└─ Wire & Cable Marking:
   ├─ Phasing (A-Black, B-Red, C-Blue or A-Brown, B-Orange, C-Yellow)
   ├─ Neutral: White or Gray
   ├─ Ground: Green or Green/Yellow
   ├─ Voltage system identification at splices/terminations
   └─ Fire alarm circuits: Red jacket or red tape every 10 ft
```

### 10.2 As-Built Drawings & Documentation

```
Create Deliverable Documentation:
│
├─ Electrical Drawings (CAD or PDF):
│  ├─ Site plan showing service entrance
│  ├─ Single-line diagram (one-line) showing power distribution
│  ├─ Panel schedules (for every panel)
│  ├─ Floor plans with:
│  │  ├─ Panel locations
│  │  ├─ Lighting fixture layout
│  │  ├─ Receptacle locations
│  │  ├─ Equipment locations (HVAC, motors, etc.)
│  │  └─ Emergency lighting/exit signs
│  ├─ Riser diagram (vertical distribution in multi-story)
│  └─ Details (typical installations, mounting heights, etc.)
│
├─ Load Calculations:
│  ├─ Complete NEC 220 calculation worksheets
│  ├─ Panel load schedules
│  ├─ Feeder schedules
│  └─ Service load summary
│
├─ Short Circuit & Coordination Study:
│  ├─ Fault current calculations at all panels
│  ├─ Equipment interrupting ratings (AIR/AIC)
│  ├─ Time-current curves (if coordination study performed)
│  └─ Arc flash analysis results
│
├─ Product Submittals:
│  ├─ Panel manufacturer cut sheets
│  ├─ Breaker specifications
│  ├─ Fixture specifications (lighting)
│  ├─ Equipment data sheets (HVAC, motors, etc.)
│  └─ Warranty information
│
└─ Operation & Maintenance Manuals:
   ├─ Panel schedules (laminated copies)
   ├─ As-built drawings
   ├─ Equipment manuals
   ├─ Maintenance schedules
   └─ Emergency contact information
```

### 10.3 Inspection Preparation & Process

```
Prepare for Electrical Inspection:
│
├─ Pre-Inspection Checklist (Self-Audit):
│  │
│  ├─ A. Service Entrance:
│  │   ├─ [ ] Service conductors sized per NEC 230.42
│  │   ├─ [ ] Service disconnect labeled and accessible
│  │   ├─ [ ] Grounding electrode system complete (NEC 250.50)
│  │   ├─ [ ] GEC sized and connected (NEC 250.66)
│  │   ├─ [ ] Main bonding jumper installed (NEC 250.28)
│  │   └─ [ ] Working clearances maintained (NEC 110.26)
│  │
│  ├─ B. Panelboards:
│  │   ├─ [ ] Panels labeled with voltage, phase, fed-from
│  │   ├─ [ ] Panel schedules typed and installed
│  │   ├─ [ ] All breakers labeled (NEC 408.4)
│  │   ├─ [ ] No more than 42 overcurrent devices (NEC 408.36)
│  │   ├─ [ ] Working clearances maintained (NEC 110.26)
│  │   ├─ [ ] Dedicated space above/below panel clear (NEC 110.26(F))
│  │   └─ [ ] Panel securely mounted
│  │
│  ├─ C. Branch Circuits & Wiring:
│  │   ├─ [ ] Conductors sized per NEC 210.19, Table 310.16
│  │   ├─ [ ] Continuous loads: Circuit ≥ load × 1.25
│  │   ├─ [ ] GFCI protection where required (NEC 210.8)
│  │   ├─ [ ] AFCI protection where required (NEC 210.12)
│  │   ├─ [ ] Box fill calculations met (NEC 314.16)
│  │   ├─ [ ] All boxes covered (no missing covers)
│  │   ├─ [ ] Proper wire connectors (wire nuts sized correctly)
│  │   └─ [ ] No damaged insulation or conductors
│  │
│  ├─ D. Grounding & Bonding:
│  │   ├─ [ ] EGC present in all circuits (NEC 250.122)
│  │   ├─ [ ] EGC sized per Table 250.122
│  │   ├─ [ ] Metal boxes bonded (NEC 250.148)
│  │   ├─ [ ] Equipment bonded (metal enclosures, conduit)
│  │   └─ [ ] No neutral-ground bonds in subpanels (NEC 408.20)
│  │
│  ├─ E. Raceways:
│  │   ├─ [ ] Conduit sized per NEC Chapter 9, Annex C
│  │   ├─ [ ] Conduit properly supported (NEC Table 344.30)
│  │   ├─ [ ] Bushing/connectors on all conduit ends
│  │   ├─ [ ] No sharp edges (protect conductors)
│  │   └─ [ ] Proper outdoor/wet location fittings (if applicable)
│  │
│  ├─ F. Specific Equipment:
│  │   ├─ [ ] HVAC disconnects within sight of equipment (NEC 440.14)
│  │   ├─ [ ] Motor disconnects within sight (NEC 430.102)
│  │   ├─ [ ] Emergency lighting tested and functional (NEC 700)
│  │   ├─ [ ] Fire alarm system tested (separate inspection)
│  │   └─ [ ] Exit signs illuminated (NEC 700.16)
│  │
│  └─ G. Documentation Ready:
│     ├─ [ ] Permit posted/visible
│     ├─ [ ] Electrical plans on site
│     ├─ [ ] Panel schedules completed
│     ├─ [ ] Load calculations available
│     └─ [ ] Product approvals (if required by AHJ)
│
├─ Common Inspection Failures (Avoid These):
│  ├─ ❌ Missing panel schedules or incorrect labeling
│  ├─ ❌ Insufficient working clearance (36" depth minimum)
│  ├─ ❌ Undersized conductors (didn't apply 125% for continuous)
│  ├─ ❌ Missing GFCI protection (bathrooms, outdoors, rooftop, etc.)
│  ├─ ❌ Neutral-ground bond in subpanel (code violation)
│  ├─ ❌ Improper conduit fill (too many conductors)
│  ├─ ❌ Missing EGC or undersized EGC
│  ├─ ❌ Open/missing junction box covers
│  ├─ ❌ Incorrect wire colors (using white for hot conductor)
│  └─ ❌ Equipment not listed (UL, ETL, etc.)
│
└─ Inspection Process:
   ├─ Rough-in Inspection (before walls closed):
   │  ├─ Conduit/raceway installation complete
   │  ├─ Boxes installed at correct heights
   │  ├─ Service entrance rough-in complete
   │  └─ Fire alarm rough-in (if applicable)
   │
   ├─ Final Inspection (after finish work):
   │  ├─ All devices installed (switches, receptacles)
   │  ├─ Fixtures installed and operational
   │  ├─ Panels energized and functional
   │  ├─ Labels and schedules complete
   │  └─ Testing complete (continuity, voltage, phasing)
   │
   └─ Re-Inspection (if failed):
      ├─ Correct all noted deficiencies
      ├─ Document corrections made
      └─ Request re-inspection (may incur additional fees)
```

---

## 11. DECISION FLOWCHART SUMMARY

```
COMMERCIAL/INDUSTRIAL DESIGN WORKFLOW:
│
START → Occupancy Classification (NEC 220.40-220.87)
  ↓
Load Calculation (NEC 220 Part III/IV)
  ├─ Lighting (Table 220.12)
  ├─ Receptacles (NEC 220.14, 220.44)
  ├─ HVAC (NEC 220.14(C), 430.24)
  ├─ Kitchen (NEC 220.56)
  ├─ Motors (Article 430)
  └─ Special Loads
  ↓
Service Sizing (NEC 230.42)
  ├─ Calculate total demand (VA)
  ├─ Convert to Amps (3-phase or 1-phase)
  ├─ Apply 80% utilization design margin
  └─ Round to standard service size
  ↓
Service Entrance Design
  ├─ Conductors (Table 310.16)
  ├─ Grounding Electrode System (NEC 250.50)
  ├─ GEC Sizing (Table 250.66)
  ├─ Service Disconnect (NEC 230.70)
  └─ Short Circuit / Arc Flash (NEC 110.9, NFPA 70E)
  ↓
Panelboard Layout
  ├─ Number of panels (zones, distance)
  ├─ Panel sizing (load + 20% spare)
  ├─ Location (accessibility, NEC 110.26)
  └─ Specifications (voltage, bus rating, spaces)
  ↓
Feeder Design (NEC Article 215)
  ├─ Feeder load calculation
  ├─ Conductor sizing (Table 310.16 + derating)
  ├─ Overcurrent protection
  ├─ EGC sizing (Table 250.122)
  ├─ Voltage drop check (≤3%)
  └─ Raceway sizing (Chapter 9, Annex C)
  ↓
Branch Circuit Design (NEC Article 210)
  ├─ Lighting circuits (NEC 210.19, 210.70)
  │  ├─ Continuous load × 1.25
  │  ├─ GFCI where required (NEC 210.8)
  │  └─ Control systems (energy code)
  │
  ├─ Receptacle circuits (NEC 210.52)
  │  ├─ 180 VA per receptacle
  │  ├─ GFCI where required (NEC 210.8)
  │  └─ Dedicated circuits for equipment
  │
  └─ HVAC/Equipment circuits
     ├─ Use nameplate data (MCA, MOCP)
     ├─ Motor rules (Article 430)
     └─ Disconnects within sight
  ↓
Special Systems
  ├─ Emergency/Standby (NEC 700/701/702)
  ├─ Fire Alarm (NEC 760)
  ├─ Data Centers (NEC 645)
  └─ Building Automation (NEC 725)
  ↓
Documentation
  ├─ Electrical drawings (CAD)
  ├─ Load calculations (NEC 220 worksheets)
  ├─ Panel schedules (all panels)
  ├─ Short circuit study (NEC 110.9)
  └─ Arc flash analysis (NFPA 70E)
  ↓
Labeling & Identification
  ├─ Panel schedules in panel doors (NEC 408.4)
  ├─ Circuit labels (NEC 408.4)
  ├─ Equipment labels (voltage, disconnect)
  ├─ Arc flash labels (NFPA 70E)
  └─ Emergency system labels (red letters, NEC 700.9)
  ↓
Inspection
  ├─ Pre-inspection self-audit
  ├─ Rough-in inspection (before walls closed)
  ├─ Final inspection (after finish)
  └─ Address any corrections
  ↓
PROJECT COMPLETE ✓
```

---

## 12. KEY DIFFERENCES: COMMERCIAL VS. RESIDENTIAL

| Aspect | Residential (NEC 220.82/220.84) | Commercial/Industrial |
|--------|----------------------------------|----------------------|
| **Load Calc Method** | Standard or Optional Method (220.82) | General Method (NEC 220 Part III/IV) |
| **Lighting Load** | 3 VA/sq ft (all dwelling units) | Varies by occupancy (Table 220.12) |
| **Demand Factors** | Built into 220.82/220.84 | Applied separately (220.42, 220.44, 220.56) |
| **Voltage** | 120/240V 1Φ (typical) | 120/208V 3Φ or 277/480V 3Φ |
| **Service Size** | 100A, 200A (common) | 200A-3000A+ (varies widely) |
| **Grounding** | Simpler (NEC 250.32) | Complex electrode system (NEC 250.50) |
| **AFCI** | Required most 15/20A circuits (NEC 210.12) | NOT typically required |
| **GFCI** | Extensive (bathrooms, kitchen, outdoors, etc.) | Limited (bathrooms, rooftops, outdoors) |
| **Arc Flash** | Not required | Required (NFPA 70E) for >240V or >50A |
| **Emergency Systems** | Rarely required | Often required (NEC 700/701) |
| **Energy Code** | Minimal controls | Extensive (ASHRAE 90.1, Title 24) |
| **Documentation** | Simple panel schedule | Full drawing set, load calcs, studies |

---

## APPENDIX: QUICK REFERENCE TABLES

### Standard Service Sizes (Amps)
100, 125, 150, 200, 225, 300, 400, 600, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000

### Common Commercial Voltages
- **120/208V 3Φ 4W** - Small commercial, offices, retail (most common)
- **277/480V 3Φ 4W** - Large commercial, industrial, warehouses
- **120/240V 3Φ 4W Delta** - Industrial, older buildings
- **120/240V 1Φ 3W** - Small commercial (similar to residential)

### Conductor Ampacities (75°C Copper, NEC Table 310.16)
| Size | Ampacity | Size | Ampacity | Size | Ampacity |
|------|----------|------|----------|------|----------|
| #14  | 20A      | #4   | 85A      | 3/0  | 200A     |
| #12  | 25A      | #3   | 100A     | 4/0  | 230A     |
| #10  | 35A      | #2   | 115A     | 250  | 255A     |
| #8   | 50A      | #1   | 130A     | 300  | 285A     |
| #6   | 65A      | 1/0  | 150A     | 350  | 310A     |
|      |          | 2/0  | 175A     | 500  | 380A     |

### Equipment Grounding Conductor (EGC) Sizing (Table 250.122, Copper)
| OCPD Rating | Copper EGC | Aluminum EGC |
|-------------|------------|--------------|
| 15A         | #14        | #12          |
| 20A         | #12        | #10          |
| 30A         | #10        | #8           |
| 60A         | #10        | #8           |
| 100A        | #8         | #6           |
| 200A        | #6         | #4           |
| 400A        | #3         | #1           |
| 600A        | #1         | 2/0          |
| 800A        | 1/0        | 3/0          |
| 1000A       | 2/0        | 4/0          |

---

**END OF COMMERCIAL/INDUSTRIAL ELECTRICAL DESIGN WORKFLOW**

**NEC 2023 Compliance**
**Document Version:** 1.0
**Last Updated:** December 2025
