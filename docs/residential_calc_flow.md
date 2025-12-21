**Residential Electrical Design Workflow (NEC 2023) - Textual Flowchart (Improved & Extended)**

--- START OVERALL PROCESS ---

**1. Project Scope & Requirements (NEC 90 + local)**
   (Start)
      ↓
   +<Decision>------------------------------------+
   | AHJ using an NEC edition other than 2023?   |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Annotate local-amendment     |       |
   | differences                  |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Include EV charging, PV back-feed,          |
   | or generator Day-1?                         |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+      +-[Process]--------------------+
   | Add to load calculations     |      | Note as "future provision"   |
   | & equipment list             |      | in design                    |
   +------------------------------+      +------------------------------+
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Classify dwelling: 1-family, 2-family, or    |
   | multifamily unit                             |
   +----------------------------------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Identify all structures: house, attached &   |
   | detached garages, sheds, ADU, pool equip.    |
   +----------------------------------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Determine service type & entry: overhead vs  |
   | underground; meter & main/disconnect        |
   | locations                                   |
   +----------------------------------------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Special conditions? (flood/wind/wildfire/   |
   | coastal, etc.)                              |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Note additional requirements (elevated |  |
   | equipment, outdoor ratings, etc.)      |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Collect building data: sq ft, rooms, HVAC,   |
   | appliance list, owner wishes                 |
   +----------------------------------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Obtain utility service data: fault-current,  |
   | meter base specs, CT requirements            |
   +----------------------------------------------+
                        |
                        ↓
   (End Section 1) → Proceed to Load Calculation

---

**2. Load Calculation (NEC 220)**
   (Start Section 2)
      ↓
   +<Decision>------------------------------------+
   | Eligible and choosing Optional Dwelling      |
   | Method 220.82?                               |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Perform dwelling load calc per 220.82  |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Single-family dwelling?                     |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+      +-[Process]--------------------+
   | General lighting: 3 VA/ft²   |      | Use multifamily method       |
   | Small-appliance: 2x1500 VA   |      | (220.84)                     |
   | Laundry: 1500 VA             |      +------------------------------+
   | Continuous loads x 125%      |                 |
   | Largest motor/HVAC x 125%    |                 |
   | Range/dryer demand factors   |                 |
   +------------------------------+                 |
      |                                           |
      +-----------------+-------------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Sum all VA, convert → amperes @ 120/240 V    |
   +----------------------------------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Calculate neutral load separately per 220.61 |
   | /220.82 and record as "Calculated Neutral    |
   | Load"                                       |
   +----------------------------------------------+
                        |
                        ↓
   (End Section 2) → Export "Calculated Service Load"

---

**3. Service Conductors & Grounding (NEC 230 & 250)**
   (Start Section 3 - with Calculated Service Load)
      ↓
   +-[Process]------------------------------------+
   | Select next-higher standard OCPD size (240.6)|
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Size ungrounded conductors from T310.12      |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Size grounded (neutral) conductor based on   |
   | calculated neutral load and 250.24(C)        |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Service > 400 A?                            |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Use T310.16 + temp/adj       |       |
   | factors (310.15)             |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Size grounding-electrode conductor (250.66)  |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Metal water pipe electrode present           |
   | & >= 10 ft buried?                           |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Bond within 5 ft of entrance |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Provide at least two electrodes (250.53(A)(2))|
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Provide intersystem bonding termination and  |
   | bond required metal piping/structural steel  |
   | to the grounding electrode system            |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | For 1- and 2-family dwellings, provide a     |
   | readily accessible emergency disconnect per  |
   | 230.85 and clearly label it                  |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Provide service-level SPD where required or  |
   | specified; note SPD data with service calcs  |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Using available fault current, verify AIC    |
   | ratings of service disconnects and panels    |
   +----------------------------------------------+
      ↓
   (End Section 3) → Go to Panelboard Layout

---

**4. Panelboard Layout & Main OCPD (NEC 408, 210, 240)**
   (Start Section 4)
      ↓
   +-[Process]------------------------------------+
   | Choose panel style (MB vs MBSS), >=42 spaces |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Verify panel location meets 110.26 working   |
   | clearances and 240.24 accessibility          |
   | (not in clothes closets or bathrooms)        |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Allocate required dwelling circuits per      |
   | 210.11 before general-use circuits           |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Future capacity needed (EV/PV/ESS/additions)?|
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Reserve spaces and ampacity margin     |  |
   | for future loads (target ≥ ~20% spare) |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | PV back-feed bus > 120% of bus rating?      |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Downsize main breaker or     |       |
   | use center-feed bus (705.12) |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Draft preliminary circuit schedule; ~20% spare|
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Label for AFCI/GFCI/dual-function breakers   |
   +----------------------------------------------+
      ↓
   (End Section 4) → Move to Branch Circuits

---

**5. Branch-Circuit Design (NEC 210 & 240)**
   (Start Section 5)
      ↓
   +-[Process]------------------------------------+
   | Provide required dwelling branch circuits per|
   | 210.11 (2+ small appliance, laundry, bath,   |
   | garage, outdoor, etc.)                       |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Lay out receptacles per 210.52 (rooms, halls,|
   | kitchen counters, islands, peninsulas)       |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Use tamper-resistant receptacles in dwelling |
   | unit areas required by 406.12                |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Any multi-wire branch circuits (shared       |
   | neutral)?                                    |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Keep MWBC conductors in same cable/    |  |
   | raceway; use common-trip or handle     |  |
   | ties per 210.4(B)                      |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Assign dedicated circuits for range, dryer,  |
   | dishwasher/disposal, water heater, and other |
   | major appliances per nameplate/NEC           |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Kitchen/dining small-appliance counter?     |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | 20 A branch; GFCI required   |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Bathroom receptacle?                        |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | 20 A GFCI                    |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Motor load > 1/8 hp?                        |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Size conductors 125% of FLA  |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Size conductors per 310.16; select OCPD      |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Apply AFCI (210.12) & GFCI (210.8) required  |
   +----------------------------------------------+
      ↓
   (End Section 5) → Next: Conductor Ampacity

---

**6. Conductor Ampacity & Voltage-Drop (NEC 310)**
   (Start Section 6 - Verify/adjust conductor sizes from Steps 3 & 5 based on installation conditions)
      ↓
   +<Decision>------------------------------------+
   | Ambient ≠ 30°C OR > 10 ft from termination? |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Temp-correct ampacity        |       |
   | (310.15(B)(1))               |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Conduits/cables subject to rooftop or other  |
   | high sun-heated ambient conditions?          |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Apply rooftop/high-ambient correction  |  |
   | factors per applicable NEC table       |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | > 3 current-carrying conductors in raceway? |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Apply adjustment factors     |       |
   | (310.15(C)(1))               |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Confirm corrected/derated ampacity does not  |
   | exceed terminal rating or allowed conductor  |
   | temperature column (60/75/90°C as applicable)|
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+ <--- (Re-check Point)
   | Compute voltage-drop (%VD) for feeder/branch |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | %VD > 3% branch OR > 5% total?              |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Up-size conductor & re-check |       |
   | [Return to Re-check Point]   |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   (End Section 6) → To Raceway & Box Fill

---

**7. Raceway & Box Fill (NEC Chap 9, 300, 312, 314)**
   (Start Section 7 - Verify physical fit for final conductor sizes in raceways/boxes)
      ↓
   +<Decision>------------------------------------+
   | Conduit type = PVC/EMT/ENT?                 |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       | (Other Rules Apply)
   | Pull-fill % from Table 1     |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Compute total conductor cross-section        |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | >= 4 conductors in raceway?                 |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+      +-[Process]--------------------+
   | Use 40% fill rule            |      | Use 53% (1) or 31% (2) rule |
   +------------------------------+      +------------------------------+
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Box-fill per 314.16: count volumes, select box|
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Verify total bends between pull points in    |
   | each raceway do not exceed 360°              |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Any raceways or cables installed underground?|
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Check burial depth and cover per 300.5 |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Provide physical protection per 300.4: nail  |
   | plates, sleeves where cables near edges      |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+
   | Gutters or wireways used?                    |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Check fill and conductor limits per    |  |
   | 366/376                                |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   (End Section 7) → Proceed to Special Equipment

---

**8. Special Equipment (EVSE, PV, Gen, HVAC)**
   (Start Section 8)
      ↓
   +<Decision>------------------------------------+
   | Level-2 EVSE present?                       |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Treat as continuous x 125%   |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | PV back-feed?                               |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Comply w/ 120% bus rule;     |       |
   | add DC disconnect            |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Energy storage system (battery/ESS) present? |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Design ESS per 706; coordinate with    |  |
   | service/PV; provide required           |  |
   | disconnects and labeling               |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Pool, spa, or hot tub present?               |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]------------------------------+  |
   | Provide GFCI circuits and bonding per  |  |
   | NEC 680 (equipotential grid, metallic  |  |
   | parts, etc.)                           |  |
   +----------------------------------------+  |
      |                                      |
      +-----------------+--------------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | For HVAC equipment, size branch circuits and |
   | OCPD using MCA/MOP nameplate data (e.g., 440)|
   +----------------------------------------------+
                        |
                        ↓
   +<Decision>------------------------------------+
   | Standby or emergency generator?             |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Classify generator as        |       |
   | optional/emergency and       |       |
   | select service-rated or      |       |
   | non-service-rated transfer   |       |
   | equipment accordingly        |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   (End Section 8) → On to Controls & Lighting

---

**9. Controls, Lighting & Energy-Code Coordination (NEC 210.70 + IECC)**
   (Start Section 9)
      ↓
   +<Decision>------------------------------------+
   | Jurisdiction enforces IECC/ASHRAE?          |
   +---------------------------------------------+
      | Yes                                  | No
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Specify auto-off, hi-eff lamps|       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | NEC 210.70: Switched luminaire/control req'd |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Coordinate smoke & CO detector locations and |
   | circuits with building code; ensure required |
   | power source and interconnection             |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Provide convenient switching (3-way/4-way)   |
   | at stairways and long corridors for safety   |
   +----------------------------------------------+
      ↓
   (End Section 9) → Next: Labeling & Docs

---

**10. Labeling, Documentation & Inspection**
   (Start Section 10)
      ↓
   +-[Process]------------------------------------+
   | Mark fault current & date on service equip.  |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Finalize one-line, panel directory, calcs    |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Apply required labels/placards for PV, ESS,  |
   | generators, and service disconnects per NEC |
   | and AHJ requirements                         |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Compile owner documentation: one-line, panel |
   | schedules, load calcs, equipment manuals,    |
   | fault current/SPD data                       |
   +----------------------------------------------+
      ↓
   +<Decision>------------------------------------+ <--- (Rough-in Re-inspect Point)
   | Rough-in inspection passed?                 |
   +---------------------------------------------+
      | No                                   | Yes
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Remedy defects → re-inspect  |       |
   | [Return to Rough-in Point]   |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+ <--- (Service Re-inspect Point)
   | Service inspection passed?                  |
   +---------------------------------------------+
      | No                                   | Yes
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Remedy defects → re-inspect  |       |
   | [Return to Service Point]    |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +<Decision>------------------------------------+ <--- (Final Re-inspect Point)
   | Final inspection passed?                    |
   +---------------------------------------------+
      | No                                   | Yes
      ↓                                      ↓
   +-[Process]--------------------+       |
   | Remedy defects → re-inspect  |       |
   | [Return to Final Point]      |       |
   +------------------------------+       |
      |                                   |
      +-----------------+-----------------+
                        |
                        ↓
   +-[Process]------------------------------------+
   | Run final QA checklist: verify 210.11/210.52 |
   | circuits, AFCI/GFCI/SPD coverage, emergency  |
   | disconnect, labeling, and clearances         |
   +----------------------------------------------+
      ↓
   +-[Process]------------------------------------+
   | Issue Certificate of Occupancy               |
   +----------------------------------------------+
      ↓
   (End) → Project closed

--- END OVERALL PROCESS ---
