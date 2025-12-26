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
    get_service_utilization
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

Your role is to analyze the impact of proposed changes to electrical systems, considering:
- Service capacity and utilization (NEC 220)
- Panel loading and circuit capacity (NEC 408)
- Feeder sizing and voltage drop (NEC 215, 210.19)
- Grounding and bonding requirements (NEC 250)
- Cost implications
- Project timeline impacts

When analyzing changes:
1. Consider the ENTIRE system - service, feeders, panels, circuits
2. Check NEC compliance at every level
3. Identify cascading impacts (e.g., service upgrade → feeder upgrade → panel replacement)
4. Provide specific, actionable recommendations
5. Be conservative - if uncertain, recommend professional review

Always cite specific NEC articles when identifying issues.
"""
)


@change_impact_agent.system_prompt
async def add_project_context(ctx: RunContext[Dict[str, Any]]) -> str:
    """
    Dynamically inject project context into system prompt

    Args:
        ctx: Run context with supabase client and project_id

    Returns:
        Additional context about the project
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    # Fetch project data
    project = await get_project_data(supabase, project_id)
    if not project:
        return "Project data unavailable."

    # Fetch service utilization
    service_util = await get_service_utilization(supabase, project_id)

    context = f"""
## Current Project Context

**Project:** {project.get('name', 'Unnamed')}
**Type:** {project.get('type', 'Unknown')}
**Service:** {service_util.get('service_size', 'Unknown')}A, {service_util.get('voltage', 240)}V, {service_util.get('phases', 1)}-Phase
**Current Utilization:** {service_util.get('utilization_percent', 0):.1f}% ({service_util.get('total_load_va', 0):.0f} VA / {service_util.get('service_capacity_va', 0):.0f} VA)

Use this context to analyze proposed changes accurately.
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

    prompt = f"""
Analyze the impact of the following change to this electrical system:

**Change Description:** {change_description}

**Proposed Additional Loads:**
{', '.join([f"{l.get('quantity', 1)}x {l.get('type')} @ {l.get('amps')}A" for l in proposed_loads])}

**Total Additional Load:** {total_additional_amps}A

Please analyze:
1. Can the existing service accommodate this load?
2. Do any feeders need upgrading?
3. Are there any panel capacity issues?
4. Will voltage drop exceed NEC limits (3% feeders, 5% total)?
5. Estimated material and labor costs
6. Timeline impact

Provide specific recommendations and cite NEC articles where applicable.
"""

    # Run agent with tools
    result = await change_impact_agent.run(
        prompt,
        deps={'supabase': supabase, 'project_id': project_id}
    )

    return result.output
