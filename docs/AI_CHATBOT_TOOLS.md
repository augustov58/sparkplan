# NEC Copilot - AI Chatbot Tools Reference

The NEC Copilot chatbot (bottom-right corner) provides an intelligent assistant that can read project data, perform calculations, and modify your electrical design through natural language commands.

## Overview

The chatbot has three categories of tools:

1. **Read/Check Tools** - Query project data and perform calculations
2. **AI Agent Tools** - Complex analysis using Python backend (Pydantic AI)
3. **Action Tools** - Modify project data (panels, circuits)

All action tools require user confirmation before making changes.

---

## Read/Check Tools

These tools query your project data and perform NEC calculations without modifying anything.

### `get_project_summary`
Get an overview of your project including all panels, circuits, and load information.

**Example commands:**
- "What panels do I have?"
- "Show me the project summary"
- "What's the current load on this project?"

---

### `check_panel_capacity`
Check if a panel can accommodate additional load.

**Example commands:**
- "Can Panel A handle another 5000W?"
- "What's the capacity of the MDP?"
- "Check if Panel H7 can take a 50A load"

**Returns:** Current utilization, available capacity, whether load can be accommodated.

---

### `calculate_feeder_voltage_drop`
Get voltage drop information for feeders.

**Example commands:**
- "What's the voltage drop on feeder F1?"
- "Check voltage drop from MDP to Panel A"

**Returns:** Voltage drop percentage, compliance status, NEC reference.

---

### `check_conductor_sizing`
Verify conductor sizing per NEC Table 310.16.

**Example commands:**
- "Is 10 AWG adequate for a 30A load?"
- "Check conductor sizing for circuit 5 in Panel A"

**Returns:** Ampacity, compliance status, minimum required size.

---

### `check_service_upgrade`
Analyze if a service upgrade is needed.

**Example commands:**
- "Do I need a service upgrade?"
- "What if I add 20kW of load?"
- "Can my 200A service handle the current loads?"

**Returns:** Current utilization, projected utilization, upgrade recommendation.

---

### `run_quick_inspection`
Run a quick NEC compliance check on the project.

**Example commands:**
- "Run an inspection"
- "Check for code violations"
- "Any issues with this project?"

**Returns:** List of issues (critical, warning, info) with NEC references.

---

## AI Agent Tools (Python Backend)

These tools use the Pydantic AI backend for complex analysis.

### `analyze_change_impact`
Analyze the impact of adding new electrical loads.

**Example commands:**
- "What if I add 3 EV chargers at 50A each?"
- "Analyze adding a 15-ton HVAC unit"
- "Impact of adding 10kW solar inverter"

**Returns:** Detailed impact analysis, service upgrade requirements, cost estimates.

---

### `draft_rfi`
Draft a professional Request for Information with NEC references.

**Example commands:**
- "Draft an RFI about transformer sizing"
- "Create an RFI for panel clearance concerns"
- "Write an RFI about the grounding system"

**Returns:** Formatted RFI with subject, question, NEC references, priority.

---

### `predict_inspection`
Predict potential inspection failures.

**Example commands:**
- "What might fail inspection?"
- "Prepare me for the inspection"
- "Predict inspection issues"

**Returns:** Failure likelihood, predicted issues, preparation checklist.

---

## Action Tools (Modify Data)

These tools modify your project data. All require confirmation before executing.

### `add_circuit`
Add a new circuit to a panel.

**Parameters:**
- `panel_name` (required): Panel to add circuit to
- `description` (required): Circuit description
- `breaker_amps` (required): Breaker size (15, 20, 30, etc.)
- `load_watts`: Circuit load in watts
- `poles`: Number of poles (1, 2, or 3)
- `wire_size`: Conductor size (e.g., "12 AWG")

**Example commands:**
- "Add a 20A circuit for kitchen receptacles to Panel A"
- "Add a 50A/2P circuit for EV charger to the MDP"
- "Create a 30A water heater circuit in Panel H7"

---

### `add_panel`
Create a new sub-panel fed from another panel or transformer.

**Parameters:**
- `name` (required): Panel name
- `bus_rating` (required): Bus rating in amps
- `voltage`: Panel voltage (auto-set from source if fed from transformer)
- `phase`: Number of phases (1 or 3)
- `main_breaker`: Main breaker size
- `fed_from_panel`: Name of source panel
- `fed_from_transformer`: Name of source transformer (voltage auto-set)

**Example commands:**
- "Add a 100A panel called Panel H8 fed from the MDP"
- "Create a 225A panel fed from transformer T1"
- "Add a garage sub-panel at 60A from Panel A"

**Note:** When fed from a transformer, voltage is automatically set from the transformer's secondary voltage.

---

### `fill_panel_with_test_loads`
Bulk add test/sample circuits to a panel.

**Parameters:**
- `panel_name` (required): Panel to fill
- `load_type`: Type of loads - "lighting", "receptacle", "motor", "hvac", "mixed" (default)
- `target_utilization`: Target utilization percentage (default: 60%)
- `num_circuits`: Specific number of circuits to add

**Example commands:**
- "Fill the MDP with test loads"
- "Fill Panel H7 with lighting loads to 50%"
- "Add mixed loads to Panel A until 70% utilized"

**Slot Limits:**
- MDP/Main panels: 30 slots maximum
- Branch panels: 42 slots maximum

The tool respects existing circuits and multi-pole slot usage.

---

### `empty_panel`
Remove circuits from a panel (clear/reset). By default, preserves feeder circuits that feed sub-panels.

**Parameters:**
- `panel_name` (required): Panel to empty
- `preserve_feeders`: Keep feeder circuits for sub-panels (default: true)

**Example commands:**
- "Empty panel H7" - Deletes all except feeder breakers
- "Clear the MDP" - Deletes all except feeders to sub-panels
- "Delete all circuits from Panel A including feeders" - Deletes everything

**Feeder Protection:**
- By default, feeder breakers that feed sub-panels are preserved
- The tool identifies feeders by checking `fed_from_circuit_number` on downstream panels
- Multi-pole feeders (2P, 3P) have all their slots protected
- Use `preserve_feeders=false` to delete everything (use with caution)

---

### `fill_with_spares`
Fill remaining empty slots with SPARE circuits (no load, placeholder breakers).

**Parameters:**
- `panel_name` (required): Panel to fill with spares
- `breaker_amps`: Breaker size for spares (default: 20A)

**Example commands:**
- "Fill the rest with spares"
- "Add spare circuits to panel H7"
- "Fill remaining slots in MDP with 15A spares"

**Use case:** Complete a panel schedule by filling all empty positions with labeled SPARE breakers.

---

## Panel Slot Tracking

The chatbot properly tracks panel slot usage:

- **MDP/Main panels**: 30 slots total
- **Branch panels**: 42 slots total
- **Multi-pole circuits**:
  - 1-pole: occupies 1 slot
  - 2-pole: occupies 2 slots (e.g., slots 1 and 3)
  - 3-pole: occupies 3 slots (e.g., slots 1, 3, and 5)

All action tools respect these limits and existing circuit allocations.

---

## Example Conversation Flow

```
User: "What panels do I have?"
Bot: [Lists all panels with utilization percentages]

User: "Fill panel H7 with HVAC loads to 60%"
Bot: "I'll add HVAC test circuits to Panel H7..."
     [Confirms action]
     "Added 8 circuits, panel now at 58% utilization, 12 slots remaining"

User: "Fill the rest with spares"
Bot: "I'll fill the remaining 12 slots with SPARE circuits..."
     [Confirms action]
     "Added 12 SPARE circuits to Panel H7, panel is now full"

User: "Actually, clear panel H7 and start over"
Bot: "I'll remove all 20 circuits from Panel H7..."
     [Confirms action]
     "Removed all circuits, panel is now empty"
```

---

## Tips for Best Results

1. **Be specific with panel names** - Use exact names like "Panel H7" or common abbreviations like "MDP"
2. **Specify load types** - For test loads, mention "lighting", "HVAC", "receptacles", or "mixed"
3. **Include parameters** - Mention breaker sizes, target utilization, or pole counts when relevant
4. **Review before confirming** - Action tools show what they'll do before executing
5. **Use context** - If you just discussed a panel, you can say "fill it with spares" and the bot will understand

---

## Related Documentation

- [AI Agent Architecture](/docs/AI_AGENT_ARCHITECTURE.md) - Backend AI system details
- [Development Guide](/docs/development-guide.md) - Adding new tools
- [Architecture Overview](/docs/architecture.md) - System design
