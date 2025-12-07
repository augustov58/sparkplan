# 🔌 Grounding & Bonding Tool - Engineer's Guide

## Overview

The Grounding & Bonding tool helps electrical engineers and inspectors ensure NEC Article 250 compliance for grounding electrode systems and bonding requirements.

---

## 📐 For DESIGN (New Projects)

### Step 1: Navigate to Grounding & Bonding
From your project, click **Grounding** in the sidebar navigation.

### Step 2: Document Electrodes Present (Electrodes Tab)

Review the **available grounding electrodes** at the site and check the ones that exist:

| Electrode Type | When to Select | NEC Reference |
|----------------|----------------|---------------|
| **Metal Underground Water Pipe** | If metal water service ≥10 ft in earth | 250.52(A)(1) |
| **Concrete-Encased (Ufer)** | If 20+ ft of rebar in foundation | 250.52(A)(3) |
| **Ground Ring** | If installed around building | 250.52(A)(4) |
| **Ground Rods** | Most common supplemental electrode | 250.52(A)(5) |

**⚠️ Important Rules:**
- If you select **Water Pipe**, you MUST also select a supplemental electrode (Ufer, rods, etc.) per **NEC 250.53(D)(2)**
- The tool will show a compliance warning if this isn't done

### Step 3: Select GEC Size

The tool **automatically recommends** a GEC size based on your service:

```
Service Size → Recommended GEC (Copper)
───────────────────────────────────────
100A or less → 8 AWG
101-150A     → 6 AWG
151-200A     → 4 AWG  ← Most residential
201-400A     → 2 AWG
401-600A     → 1/0 AWG
601-1000A    → 2/0 AWG
```

Select from the dropdown. If your selection differs from the recommendation, a blue info message appears.

### Step 4: Document Bonding (Bonding Tab)

Check off completed bonding connections:

| Bonding Target | Required? | Notes |
|----------------|-----------|-------|
| **Interior Water Piping** | ✅ Yes | Metal piping inside building |
| **Gas Piping** | Sometimes | Required for CSST or per local code |
| **Structural Metal** | Sometimes | If could become energized |
| **Intersystem Bonding** | ✅ Yes | For telecom, CATV, satellite |

### Step 5: Add Notes

Use the notes field to document specifics:
- "Two 8ft ground rods spaced 6ft apart"
- "Ufer ground in footing at column A-1"
- "IBT at meter base per utility requirements"

### Step 6: Verify Compliance

Click **"Verify NEC 250"** button to run AI analysis that checks:
- Electrode system completeness
- Proper supplementation
- GEC sizing adequacy
- Bonding requirements

---

## 🔍 For INSPECTION (Existing Projects)

### Step 1: Pre-Inspection Checklist

Open the **Electrodes Tab** and verify each checked electrode is actually installed:

| Checkbox | What to Verify in Field |
|----------|------------------------|
| ☑️ Water Pipe | Metal water service enters building, 10+ ft in ground |
| ☑️ Ufer Ground | Rebar connection accessible at foundation |
| ☑️ Ground Rods | Visible rod or marker, proper depth (8ft) |

### Step 2: Check GEC Installation

Refer to the **Sizing Tab** for NEC Table 250.66:
- Verify GEC size matches or exceeds requirement
- Check GEC is unbroken from electrode to service
- Confirm proper connections (irreversible crimps, Cadweld, etc.)

### Step 3: Verify Bonding

On **Bonding Tab**, inspect each checked item:

| Bonding Item | Inspection Points |
|--------------|-------------------|
| Water Piping | Clamp within 5ft of entrance, before any disconnection point |
| Gas Piping | CSST bonding per manufacturer, proper clamp type |
| Structural Steel | Connection to GES, not just to enclosure |
| Intersystem | IBT terminal accessible, proper size |

### Step 4: Use EGC Reference

On **Sizing Tab**, use NEC Table 250.122 quick reference:
- Check EGC size for each circuit OCPD rating
- Common: 20A circuit → 12 AWG copper EGC

### Step 5: Document Findings

Add inspection notes, then click **"Verify NEC 250"** for AI analysis of the complete system.

---

## 📊 Quick Reference Panel

At the bottom of the **Sizing Tab**, find the **Quick Reference** showing:

| Field | Meaning |
|-------|---------|
| **Service Size** | From your MDP main breaker |
| **Recommended GEC** | Calculated per Table 250.66 |
| **Main EGC** | EGC for main service per Table 250.122 |
| **Selected GEC** | What you've configured (green if matches, yellow if different) |

---

## ⚠️ Compliance Warnings

The tool automatically warns about:

1. **"Water pipe electrode must be supplemented"**
   - You selected water pipe but no supplemental electrode
   - Fix: Add ground rods, Ufer, or ground ring

2. **"At least one grounding electrode required"**
   - No electrodes selected
   - Fix: Select all electrodes present at site

3. **"Interior water piping bonding required"**
   - Water piping bonding not checked
   - Fix: Verify and check, or document exception

4. **"Intersystem bonding terminal required"**
   - Communications bonding not checked
   - Fix: Required for all services per NEC 250.94

---

## 💡 Pro Tips

1. **Start with what exists** - Check all electrodes that are physically present, even if not connected yet

2. **Use AI validation** - The "Verify NEC 250" button provides code-specific analysis

3. **Document everything** - Notes field is great for inspection reports

4. **Check sizing tables** - Sizing Tab has complete NEC 250.66 and 250.122 tables for reference

5. **Watch the compliance banner** - Yellow warning at top = issues to address before sign-off