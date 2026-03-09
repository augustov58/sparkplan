# Week 1 Launch Kit - Ready-to-Use Promotion Materials

**Created:** February 15, 2026
**Purpose:** Copy-paste-ready forum posts, demo video script, and DM templates
**Reference:** [DISTRIBUTION_PLAYBOOK.md](../DISTRIBUTION_PLAYBOOK.md)

---

## Part 1: Forum Posts (Mike Holt + Reddit)

### Post A: "Multi-Family EV Charging — The Math Most Electricians Get Wrong"

**Target thread:** Any post asking about MF EV load calcs, "is it even possible?", or NEC 220.84 confusion.

**Where to post:** Mike Holt Forum (Electrical Code Questions), Reddit r/electricians

---

**Post body:**

I see this question come up a lot and the answers are usually wrong, so let me break down the actual NEC math.

**The scenario:** 35-unit apartment building, existing 800A 120/208V 3-phase service. Property manager wants to add Level 2 EV chargers. Is it feasible?

**The wrong answer (and what most people calculate):**
35 units x 7,200 VA per EVSE (NEC 220.57) = 252,000 VA
252,000 / (208 x 1.732) = 699A just for EV charging
Add that to existing building load and you're way past 800A.
Conclusion: "Not feasible. Service upgrade to 1,600A. $200K+ project."

**The right answer — NEC 220.84 demand factors:**

What people forget is that NEC 220.84 gives you significant demand factor reductions for multi-family dwellings. You don't calculate at 100% for all 35 units.

Here's the actual breakdown:

```
Per-unit load (NEC 220.84):
  General lighting: 1,200 sq ft x 3 VA = 3,600 VA
  Small appliance + laundry: 4,500 VA
  Range: 8,000 VA (Table 220.55)
  A/C: 5,000 VA
  Water heater: 4,500 VA
  Per-unit total: 25,600 VA

NEC 220.84 demand factors for 35 units:
  First 3 units: 100% = 76,800 VA
  Units 4-5: 65% = 33,280 VA
  Units 6-7: 50% = 25,600 VA
  Units 8-10: 40% = 30,720 VA
  Units 11-35: 35% = 224,000 VA
  Total demanded dwelling load: 390,400 VA

Common area loads: ~45,000 VA
EV load (35 x 7,200 VA): 252,000 VA

Total building demand: ~687,400 VA
At 208V 3-phase: ~1,908A
```

That's still over 800A, BUT — this is where NEC 220.87 measurement path changes everything.

**NEC 220.87(A) — Measurement path:**
If you can get the building's actual peak demand from utility billing data (12 months) or a 30-day load study, the numbers often tell a very different story.

Typical multi-family buildings operate at 40-60% of their calculated demand. If this building actually peaks at 480A instead of the calculated 650A+ for dwelling loads, you suddenly have 320A available for EV charging.

320A at 208V 3-phase = ~115,000 VA = roughly 16 Level 2 chargers without any service upgrade.

Add an EVEMS (NEC 625.42) to manage charging schedules and you can often serve all 35 parking spaces from that same 320A allocation — the system throttles individual chargers based on real-time building load.

**Bottom line:** The answer to "can we add EV chargers to a 35-unit building?" is almost always yes. The question is how many and what infrastructure you need.

Most contractors quote the service upgrade immediately because they don't know about the demand factor + measurement path combination. That's a $200K quote that should be a $40K-60K EVEMS installation.

Happy to share more detail on the NEC references if anyone's working on a project like this.

---

### Post B: "NEC 220.87 Measurement vs Calculation — When to Use Which"

**Target thread:** Any post about service upgrades, "do I need to upgrade to add EV?", existing load determination.

---

**Post body:**

Quick breakdown because I see confusion on this constantly.

NEC 220.87 gives you two paths for determining existing building demand:

**Path 1: Calculation (220.87(B))**
- Standard NEC 220 calculation from panel schedule
- Uses demand factors, nameplate ratings, square footage
- Result: Conservative (worst-case assumptions)
- Apply 125% multiplier to the calculated existing load, then add new loads

**Path 2: Measurement (220.87(A))**
- Actual peak demand from 12-month utility billing OR 30-day load study
- Uses real metered data
- Result: Often shows 30-50% MORE available capacity than calculation
- Apply 125% multiplier to the measured peak, then add new loads

**Real example I ran recently:**

A contractor had a 200A residential service. Homeowner wanted a 48A EV charger (Tesla Wall Connector).

Calculation path:
- Existing calculated load: 168A
- x 125% = 210A
- Plus EV charger: 48A
- Total: 258A → Exceeds 200A service. Upgrade needed.

Measurement path (pulled 12 months of utility bills):
- Actual peak demand: 94A (summer, A/C running full blast + cooking)
- x 125% = 117.5A
- Plus EV charger: 48A
- Total: 165.5A → Within 200A service. No upgrade needed.

Same house. Same charger. One path says upgrade ($3,500-5,000), the other says you're fine.

The measurement path is code-compliant (NEC 220.87(A)), but most contractors don't use it because:
1. They don't know about it (not heavily taught in apprenticeship)
2. Getting utility bills from the homeowner adds friction
3. Many AHJs haven't seen it before and push back

That said, every AHJ I've submitted with utility billing data has accepted it. You just need to present it clearly — show the 12-month billing data, identify the peak month, calculate the peak demand from kWh, and apply the 125% multiplier.

For multi-family, the measurement path is often the difference between "project killed" and "project approved." NEC 220.84 demand factors help on the calculation side, but measurement data almost always shows even more available capacity.

If you're bidding MF EV work and NOT offering the measurement path, you're leaving money on the table — both yours and your customer's.

---

### Post C: "EVEMS Sizing — NEC 625.42 Explained Simply" (Reddit r/electricians or r/evcharging)

**Target thread:** Any post about EV load management, "how many chargers can I fit?", or EVEMS questions.

---

**Post body:**

Seeing more questions about EVEMS (Electric Vehicle Energy Management Systems) so here's the quick version of how NEC 625.42 works for sizing.

**The key concept:** With an EVEMS, you size to the system's managed output (setpoint), NOT to the total connected charger load.

**Example:**
- 10 chargers, each rated 40A = 400A total connected load
- EVEMS setpoint: 100A (this is all the building has available)
- NEC 625.42 lets you size the infrastructure for 100A, not 400A

The EVEMS controller dynamically distributes that 100A across whichever chargers are active. If 5 cars are plugged in, each gets 20A. If 2 are plugged in, each gets 50A (capped at charger max of 40A, so 40A each with 20A headroom).

**Why this matters for service sizing:**

Without EVEMS: 10 x 40A = 400A of service capacity needed for EV
With EVEMS: 100A of service capacity needed for EV

That's the difference between a $60K service upgrade and zero upgrade needed.

**What inspectors want to see in the permit package:**
1. EVEMS manufacturer spec sheet showing it's listed/certified
2. Load management diagram showing the setpoint configuration
3. Calculation showing building available capacity justifies the setpoint
4. NEC 625.42 reference in your load calculation

Most inspectors have seen these by now, especially in CA, NY, and CO. If yours hasn't, bring the NEC reference — it's pretty clear.

The math is straightforward but the documentation is where contractors get stuck. You need to show the inspector that your EVEMS setpoint + existing building load doesn't exceed service capacity.

---

## Part 2: Demo Video Script (5-8 minutes)

### Title Options (pick one):
- "NEC 220.84 Multi-Family EV Load Calculation — Step by Step"
- "Multi-Family EV Charging: The Calculation Most Electricians Get Wrong"
- "How to Size EV Charging for a 35-Unit Building (NEC 220.84 + 220.87)"

### Thumbnail:
Split screen — left side shows "35 Units x 40A = IMPOSSIBLE" crossed out in red, right side shows "NEC 220.84 = FEASIBLE" in green with a checkmark.

---

### Script

**[0:00 - 0:30] Hook**

"A contractor posted online last week asking if he could add EV chargers to a 35-unit apartment building with an 800-amp service. Every answer said 'impossible — you need a service upgrade to 1,600 amps.' That's a $200,000 project that kills the deal.

But that answer is wrong. NEC 220.84 demand factors and the 220.87 measurement path change the math completely. Let me show you exactly how."

**[0:30 - 1:30] Set up the problem**

[Screen: Open SparkPlan Multi-Family EV Calculator]

"Here's the scenario. 35-unit apartment building, California — so they're required to have EV-ready parking under the 2026 mandate. Existing service is 800 amps, 120/208V, 3-phase.

Let me plug in the building details:
- 35 dwelling units
- Average unit size: 1,200 square feet
- Standard appliances — electric range, A/C, water heater
- Each unit gets a Level 2 EVSE at 7,200 VA per NEC 220.57"

[Screen: Fill in the calculator fields]

**[1:30 - 3:00] Show the calculation path**

"Watch what happens when I run this through the NEC 220.84 demand factors."

[Screen: Click calculate, show results]

"The per-unit load comes out to about 25,600 VA. But NEC 220.84 applies tiered demand factors — first 3 units at 100%, next 2 at 65%, next 2 at 50%, and so on. By the time you get to unit 35, you're at 35% demand.

The total demanded load is about 687,000 VA or roughly 1,908 amps. Still over the 800-amp service, but notice — the dwelling load alone is only about 390,000 VA thanks to demand factors. That's 1,083 amps, well within the service.

The EV load at 252,000 VA is what pushes it over. So the question becomes: can we reduce the EV demand?"

**[3:00 - 4:00] Show EVEMS solution**

"This is where EVEMS — Electric Vehicle Energy Management System — comes in. NEC 625.42 lets you size EV infrastructure to the system's managed output, not the total connected load.

[Screen: Show EVEMS section of calculator]

If the building's actual available capacity is, say, 200 amps for EV charging, the EVEMS distributes that across all active chargers. During off-peak hours when only 5 cars are charging, each gets 40A — full speed. During peak when 20 cars are plugged in, each gets 10A — slower but still adds 60+ miles overnight.

The infrastructure is sized for 200A, not 700A. That's a massive difference in cost."

**[4:00 - 5:30] Show the measurement path**

"But here's the real game-changer — NEC 220.87, the measurement path.

[Screen: Toggle to measurement path in calculator]

Instead of calculating the building's existing demand from nameplate data, I can use actual utility billing data. Real buildings almost never run at calculated capacity. This 35-unit building might calculate at 1,080A of dwelling demand but actually peak at 480A.

That means the available capacity for EV charging is 800A minus 480A = 320 amps. With an EVEMS managing 320A across 35 chargers, every resident gets overnight charging without touching the service.

Zero service upgrade. Zero utility involvement. The installation goes from $200K to $40-60K."

**[5:30 - 6:30] Show the PDF output**

"And here's the part inspectors care about — the permit documentation.

[Screen: Click Generate PDF, show the 3-page output]

Page 1: Building summary with all the inputs
Page 2: Full NEC 220.84 demand factor breakdown with every code reference
Page 3: EVEMS sizing with the managed load calculation

This is what you hand to the AHJ. Every number is tied to a specific NEC article. I've submitted these in California and they've been accepted.

The whole process from entering building data to having a permit-ready PDF takes about 5 minutes."

**[6:30 - 7:00] Call to action**

"If you're doing multi-family EV work — or turning it down because the numbers don't work — run your project through this calculator. The demand factors and measurement path usually make 'impossible' projects feasible.

Link is in the description. There's a free tier so you can try it on an actual project before deciding if it's worth it.

Drop a comment if you have a project you want me to run through — I'll walk through the numbers."

---

### Production Notes:
- Screen record with OBS or Loom
- Narrate over the screen recording — no need for face cam
- Keep cursor movements deliberate and slow so viewers can follow
- Pause briefly on results screens so people can read the numbers
- Export at 1080p, upload to YouTube with timestamps in description
- Add chapters: Problem (0:00), Setup (0:30), Demand Factors (1:30), EVEMS (3:00), Measurement Path (4:00), PDF Output (5:30)

---

## Part 3: DM Outreach Templates

### Template A: Forum User Who Asked About MF EV (Mike Holt / Reddit)

> Hey [Name],
>
> I saw your post about the [X-unit] building EV project. I actually built a calculator that handles exactly this — NEC 220.84 demand factors + EVEMS sizing + the 220.87 measurement path.
>
> Would you want me to run your numbers through it? No cost — I'm looking for feedback from contractors who are actually doing this work.
>
> If you can share the unit count, existing service size, and whether you have utility billing data, I can send you back a full calculation with NEC references in about 10 minutes.

---

### Template B: Forum User Who Said "Not Feasible" / Turned Down a Job

> Hey [Name],
>
> I noticed your post about turning down the [X-unit building] project because the EV load numbers didn't work. I wanted to check — did you factor in NEC 220.84 demand factors? They make a huge difference for multi-family.
>
> For example, a 35-unit building that calculates at 700A for EV at face value comes down to about 200A with demand factors + EVEMS. No service upgrade needed.
>
> I have a tool that runs these calculations automatically if you want me to re-check your project. Free — just want to know if the numbers would have changed your bid.

---

### Template C: LinkedIn — California EV Contractor

> Hi [Name],
>
> I noticed your company does EV installations in [City/Region]. With the California 2026 multi-family EV mandate, are you seeing more requests for multi-unit buildings?
>
> I built a calculation tool specifically for multi-family EV load sizing — handles NEC 220.84 demand factors, EVEMS right-sizing (NEC 625.42), and the 220.87 measurement path. Generates permit-ready PDF documentation.
>
> Would you be open to trying it on a current project? No cost — I'm collecting feedback from contractors in the field.

---

### Template D: Follow-Up After Delivering Free Calculation

> Hey [Name],
>
> Following up on the [X-unit] calculation I sent over. A couple questions if you have a minute:
>
> 1. Did the numbers match what you expected, or were they different from your manual calculation?
> 2. Would you use the PDF output in a permit submission as-is?
> 3. Is this the kind of thing you'd pay $49/month for if you're doing this work regularly?
>
> Honest feedback is more useful than polite answers — tell me what sucks about it too.

---

### Template E: Short Reddit Comment Reply

Use this when replying to someone in a thread (not a DM):

> The demand factors under NEC 220.84 change the math significantly for multi-family. For [X] units you're looking at roughly [Y]% demand factor on the dwelling load. Combined with an EVEMS (NEC 625.42) to manage the charging allocation, most buildings can support EV without a service upgrade.
>
> Happy to run the specific numbers if you share the building details.

---

## Execution Checklist

### This Week:
- [ ] Search Mike Holt Forum for active threads (search: "220.84", "multi-family EV", "service upgrade multi unit")
- [ ] Post 2-3 helpful answers using Post A/B/C above (adapt to the specific thread)
- [ ] Set up forum signature with SparkPlan link
- [ ] Search Reddit r/electricians for recent MF EV threads
- [ ] Post 1-2 helpful comments using Post C or Template E
- [ ] Record demo video using the script above
- [ ] Upload to YouTube with SEO-optimized title and description
- [ ] Identify 5-10 forum users to DM using Templates A/B

### Next Week:
- [ ] Send DMs to identified contractors (Templates A/B/C)
- [ ] Deliver free calculations to anyone who responds
- [ ] Follow up with Template D after delivering calculations
- [ ] Post 2-3 more forum answers based on new threads

### Success Metrics (Week 1):
- Forum posts made: 3-5
- Reddit comments: 2-3
- Demo video uploaded: 1
- DMs sent: 5-10
