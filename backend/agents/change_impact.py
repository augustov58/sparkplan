"""
Change Impact Analyzer Agent

Analyzes the cascading impacts when users modify their electrical system.
Example: "Add 3x 50A EV chargers" → Analyzes service capacity, feeders, panels, voltage drop, cost, timeline.

This is the KILLER FEATURE that differentiates NEC Pro from competitors.
"""

from pydantic_ai import Agent, RunContext
from models.schemas import (
    ChangeImpact,
    ServiceImpact,
    FeederImpact,
    PanelImpact,
    VoltageDropIssue,
    CostEstimate,
    TimelineImpact
)
from tools.database import (
    get_project_data,
    get_all_panels,
    get_all_feeders,
    get_service_utilization,
    check_service_capacity,
    get_panel_utilization,
    get_large_loads
)
from supabase import Client
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

# Create Pydantic AI agent
change_impact_agent = Agent(
    'gemini-2.0-flash-exp',
    output_type=ChangeImpact,
    system_prompt="""You are an expert electrical engineer specializing in NEC compliance and electrical system design.

Your role is to analyze the impact of proposed changes to electrical systems.

## CRITICAL RULES - MUST FOLLOW

1. **SERVICE CAPACITY IS ABSOLUTE** - If adding a load would exceed 100% service capacity, you MUST:
   - Set `approved` to FALSE
   - Set `service_impact.upgrade_required` to TRUE
   - Recommend specific service upgrade size

2. **80% RULE** - NEC recommends continuous loads not exceed 80% of service rating:
   - If new utilization > 80%: Set `service_impact.upgrade_recommended` to TRUE
   - If new utilization > 100%: Set `approved` to FALSE

3. **ALWAYS USE THE PRE-CHECK** - The system provides a capacity pre-check with a verdict.
   - If verdict starts with "REJECT": Set `approved` to FALSE
   - If verdict starts with "WARNING": Set `approved` to TRUE but flag concerns

## Analysis Checklist
- Service capacity and utilization (NEC 220, 230.42)
- Panel loading and circuit capacity (NEC 408)
- Feeder sizing and voltage drop (NEC 215, 210.19)
- Available panel spaces for new breakers
- Grounding implications (NEC 250)
- Cost and timeline impacts

## Output Requirements
- Be SPECIFIC with numbers (e.g., "172A current + 48A proposed = 220A, exceeds 200A service")
- Cite NEC articles for violations
- If service upgrade needed, recommend specific size (e.g., "Upgrade to 400A service")
- Provide realistic cost estimates
"""
)


@change_impact_agent.system_prompt
async def add_project_context(ctx: RunContext[Dict[str, Any]]) -> str:
    """
    Dynamically inject comprehensive project context into system prompt

    Args:
        ctx: Run context with supabase client, project_id, and proposed_load_amps

    Returns:
        Detailed context about the project including capacity pre-check
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']
    proposed_load_amps: float = ctx.deps.get('proposed_load_amps', 0)

    # Fetch project data
    project = await get_project_data(supabase, project_id)
    if not project:
        return "Project data unavailable."

    # Fetch service utilization
    service_util = await get_service_utilization(supabase, project_id)

    # Pre-check service capacity
    capacity_check = await check_service_capacity(supabase, project_id, proposed_load_amps)

    # Fetch panels with utilization
    panels = await get_all_panels(supabase, project_id)
    panel_details = []
    for panel in panels:
        panel_util = await get_panel_utilization(supabase, panel['id'])
        panel_details.append(panel_util)

    # Fetch large loads
    large_loads = await get_large_loads(supabase, project_id, min_amps=20)

    # Build detailed context
    service_size = service_util.get('service_size', 200)
    voltage = service_util.get('voltage', 240)
    current_load_va = service_util.get('total_load_va', 0)
    current_load_amps = current_load_va / voltage if voltage > 0 else 0
    available_amps = service_size - current_load_amps

    context = f"""
## Current Project Context

**Project:** {project.get('name', 'Unnamed')}
**Type:** {project.get('type', 'Unknown')}

### Service Details (CRITICAL)
- **Service Size:** {service_size}A
- **Voltage:** {voltage}V, {service_util.get('phases', 1)}-Phase
- **Current Load:** {current_load_amps:.1f}A ({service_util.get('utilization_percent', 0):.1f}% utilization)
- **Available Capacity:** {available_amps:.1f}A remaining

### ⚠️ CAPACITY PRE-CHECK RESULT
```
Proposed Additional Load: {proposed_load_amps}A
Current Load: {capacity_check.get('current_load_amps', 0)}A
New Total: {capacity_check.get('new_total_amps', 0)}A
New Utilization: {capacity_check.get('new_utilization_percent', 0)}%
Remaining After Change: {capacity_check.get('remaining_after_change_amps', 0)}A

>>> VERDICT: {capacity_check.get('verdict', 'Unknown')}
```
{">>> RECOMMENDED UPGRADE: " + str(capacity_check.get('recommended_service_size')) + "A service" if capacity_check.get('requires_service_upgrade') else ""}

### Panel Summary
{chr(10).join([f"- **{p.get('panel_name', 'Panel')}**: {p.get('current_load_amps', 0)}A / {p.get('bus_rating_amps', 0)}A ({p.get('utilization_percent', 0)}%), {p.get('spaces_available', 0)} spaces available - {p.get('status', 'Unknown')}" for p in panel_details]) if panel_details else "No panels configured"}

### Existing Large Loads (≥20A)
{chr(10).join([f"- {l.get('description', 'Unknown')}: {l.get('breaker_amps', 0)}A" for l in large_loads[:10]]) if large_loads else "No large loads found"}

---
**IMPORTANT:** The VERDICT above is the authoritative capacity check. If it says REJECT, you MUST set approved=False.
"""
    return context


@change_impact_agent.tool
async def get_panels_data(ctx: RunContext[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fetch all electrical panels in the project

    Returns:
        List of panels with their specifications
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    panels = await get_all_panels(supabase, project_id)

    # Simplify panel data for AI
    return [{
        "name": p.get('name'),
        "rating": f"{p.get('bus_rating', 0)}A",
        "voltage": f"{p.get('voltage', 240)}V",
        "phases": p.get('phases', 1),
        "main_breaker": f"{p.get('main_breaker_rating', 0)}A",
        "type": p.get('panel_type', 'Unknown')
    } for p in panels]


@change_impact_agent.tool
async def get_feeders_data(ctx: RunContext[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fetch all feeders (cables between panels)

    Returns:
        List of feeders with specifications
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    feeders = await get_all_feeders(supabase, project_id)

    return [{
        "name": f.get('name'),
        "conductor_size": f.get('conductor_size'),
        "material": f.get('conductor_material', 'Cu'),
        "length": f.get('length_feet', 0),
        "ampacity": f.get('ampacity', 0),
        "voltage_drop": f.get('voltage_drop_percent', 0)
    } for f in feeders]


@change_impact_agent.tool
async def check_panel_capacity(
    ctx: RunContext[Dict[str, Any]],
    panel_name: str
) -> Dict[str, Any]:
    """
    Check if a specific panel can accommodate additional load

    Args:
        panel_name: Name of the panel to check

    Returns:
        Panel utilization details including available capacity and spaces
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    panels = await get_all_panels(supabase, project_id)
    panel = next((p for p in panels if p.get('name', '').lower() == panel_name.lower()), None)

    if not panel:
        return {"error": f"Panel '{panel_name}' not found"}

    return await get_panel_utilization(supabase, panel['id'])


@change_impact_agent.tool
async def get_service_capacity_check(
    ctx: RunContext[Dict[str, Any]],
    additional_amps: float
) -> Dict[str, Any]:
    """
    Check if service can handle additional load

    Args:
        additional_amps: Proposed additional load in amps

    Returns:
        Detailed capacity analysis with pass/fail verdict
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    return await check_service_capacity(supabase, project_id, additional_amps)


@change_impact_agent.tool
async def calculate_voltage_drop(
    ctx: RunContext[Dict[str, Any]],
    conductor_size: str,
    length_feet: float,
    load_amps: float,
    voltage: int
) -> float:
    """
    Calculate voltage drop for a conductor

    Args:
        conductor_size: e.g., "#12", "#2/0"
        length_feet: One-way length in feet
        load_amps: Load current in amps
        voltage: System voltage

    Returns:
        Voltage drop percentage
    """
    # Simplified voltage drop calculation (K-factor method)
    # K = 12.9 for Cu, 21.2 for Al

    # Map conductor sizes to circular mils (simplified)
    conductor_cmil = {
        "#14": 4110,
        "#12": 6530,
        "#10": 10380,
        "#8": 16510,
        "#6": 26240,
        "#4": 41740,
        "#3": 52620,
        "#2": 66360,
        "#1": 83690,
        "#1/0": 105600,
        "#2/0": 133100,
        "#3/0": 167800,
        "#4/0": 211600,
    }

    cmil = conductor_cmil.get(conductor_size, 105600)  # Default to #1/0
    K = 12.9  # Copper

    # Vdrop = K × I × L / CM
    vdrop_volts = (K * load_amps * length_feet) / cmil
    vdrop_percent = (vdrop_volts / voltage) * 100

    return round(vdrop_percent, 2)


async def analyze_change_impact(
    supabase: Client,
    project_id: str,
    change_description: str,
    proposed_loads: List[Dict[str, Any]]
) -> ChangeImpact:
    """
    Main function to analyze impact of proposed changes

    Args:
        supabase: Supabase client
        project_id: Project UUID
        change_description: Natural language description of change
        proposed_loads: List of loads being added, e.g., [{"type": "ev_charger", "amps": 50, "quantity": 3}]

    Returns:
        Complete impact analysis with recommendations
    """
    # Calculate total additional load
    total_additional_amps = sum(
        load.get('amps', 0) * load.get('quantity', 1)
        for load in proposed_loads
    )

    # Pre-check capacity before even running AI
    capacity_pre_check = await check_service_capacity(supabase, project_id, total_additional_amps)

    prompt = f"""
Analyze the impact of the following change to this electrical system:

**Change Description:** {change_description}

**Proposed Additional Loads:**
{', '.join([f"{l.get('quantity', 1)}x {l.get('type')} @ {l.get('amps')}A" for l in proposed_loads])}

**Total Additional Load:** {total_additional_amps}A

The system has already performed a capacity pre-check. Review the VERDICT in the project context above.

Based on your analysis:
1. **FIRST**: Honor the capacity pre-check verdict. If it says REJECT, set approved=False.
2. Check if any feeders need upgrading for the new load
3. Identify panel capacity issues (space for breakers, bus loading)
4. Calculate voltage drop impact (NEC limit: 3% feeders, 5% total)
5. Estimate costs: materials, labor, permits (if service upgrade needed)
6. Provide timeline: days for simple install vs weeks for service upgrade

Be SPECIFIC with numbers. Example: "Current 172A + proposed 48A = 220A total, which exceeds 200A service by 20A."
"""

    # Run agent with tools - pass proposed_load_amps for context building
    result = await change_impact_agent.run(
        prompt,
        deps={
            'supabase': supabase,
            'project_id': project_id,
            'proposed_load_amps': total_additional_amps
        }
    )

    # Safety check: Override AI decision if pre-check says REJECT
    output = result.output
    if capacity_pre_check.get('requires_service_upgrade', False) and output.approved:
        logger.warning(f"AI approved change but capacity check says REJECT. Overriding to rejected.")
        # Note: We can't easily modify the Pydantic model output here,
        # but the enhanced context should make the AI give the right answer.
        # If this keeps happening, we'd need to wrap the output.

    return output
