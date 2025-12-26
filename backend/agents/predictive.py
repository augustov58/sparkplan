"""
Predictive Inspector Agent

Predicts likelihood of inspection failures based on current project state.
Analyzes all aspects of the electrical system to identify high-risk issues before inspection.
"""

from pydantic_ai import Agent, RunContext
from models.schemas import InspectionPrediction, PredictedIssue
from tools.database import (
    get_project_data,
    get_all_panels,
    get_all_feeders,
    get_all_issues,
    get_service_utilization,
    get_grounding_system,
    get_panel_circuits
)
from supabase import Client
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Create Pydantic AI agent
predictive_inspector_agent = Agent(
    'gemini-2.0-flash-exp',
    output_type=InspectionPrediction,
    system_prompt="""You are a seasoned electrical inspector with 20+ years of experience conducting NEC compliance inspections.

Your role is to predict potential inspection failures by analyzing:
1. **Service Capacity** - Proper sizing, overcurrent protection
2. **Panel Loading** - Circuit count, bus loading, labeling
3. **Grounding & Bonding** - NEC Article 250 compliance
4. **Voltage Drop** - NEC 210.19(A) and 215.2 compliance
5. **Circuit Protection** - Proper conductor protection per 240.4
6. **Documentation** - Panel schedules, load calculations, one-line diagrams
7. **Common Violations** - Typical issues that fail inspections

Risk Assessment:
- **Critical**: Will definitely fail inspection, safety hazard
- **High**: Very likely to fail, major code violation
- **Medium**: May fail depending on inspector, needs review
- **Low**: Minor issue, unlikely to fail but worth noting

For each predicted issue:
- Cite specific NEC article
- Explain why it would fail
- Provide specific fix with time estimate
- Calculate likelihood (0.0-1.0)

Be practical - focus on issues inspectors actually care about, not theoretical edge cases.
"""
)


@predictive_inspector_agent.system_prompt
async def add_project_context(ctx: RunContext[Dict[str, Any]]) -> str:
    """
    Build comprehensive project context for analysis

    Args:
        ctx: Run context with supabase client and project_id

    Returns:
        Detailed project state
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    # Fetch all project data
    project = await get_project_data(supabase, project_id)
    panels = await get_all_panels(supabase, project_id)
    feeders = await get_all_feeders(supabase, project_id)
    issues = await get_all_issues(supabase, project_id)
    service_util = await get_service_utilization(supabase, project_id)
    grounding = await get_grounding_system(supabase, project_id)

    if not project:
        return "Project data unavailable."

    # Calculate panel circuit counts
    panel_circuit_counts = {}
    for panel in panels:
        circuits = await get_panel_circuits(supabase, panel['id'])
        panel_circuit_counts[panel['name']] = len(circuits)

    context = f"""
## Project Snapshot

**Project:** {project.get('name', 'Unnamed')}
**Type:** {project.get('type', 'Unknown')}
**Phase:** {project.get('project_phase', 'Design')}

### Service
- **Size:** {service_util.get('service_size', 200)}A @ {service_util.get('voltage', 240)}V, {service_util.get('phases', 1)}-Phase
- **Utilization:** {service_util.get('utilization_percent', 0):.1f}% ({service_util.get('total_load_va', 0):.0f} VA / {service_util.get('service_capacity_va', 0):.0f} VA)

### Panels ({len(panels)})
{chr(10).join([f"- {p.get('name')}: {p.get('bus_rating', 0)}A panel, {panel_circuit_counts.get(p.get('name'), 0)} circuits" for p in panels]) if panels else "No panels configured"}

### Feeders ({len(feeders)})
{chr(10).join([f"- {f.get('name')}: {f.get('conductor_size')} {f.get('conductor_material', 'Cu')}, {f.get('length_feet', 0)}ft, {f.get('voltage_drop_percent', 0):.2f}% Vdrop" for f in feeders[:5]]) if feeders else "No feeders configured"}

### Grounding System
- **GEC:** {grounding.get('grounding_electrode_conductor', 'Not specified') if grounding else 'Not configured'}
- **Electrode Type:** {grounding.get('grounding_electrode_type', 'Not specified') if grounding else 'Not configured'}

### Open Issues ({len(issues)})
{chr(10).join([f"- [{i.get('severity', 'Unknown')}] {i.get('description', 'No description')[:60]}..." for i in issues[:5]]) if issues else "No open issues"}

Analyze this complete system for potential inspection failures.
"""
    return context


@predictive_inspector_agent.tool
async def check_panel_compliance(
    ctx: RunContext[Dict[str, Any]],
    panel_name: str
) -> Dict[str, Any]:
    """
    Check if a specific panel meets NEC requirements

    Args:
        panel_name: Name of panel to check

    Returns:
        Compliance status and violations
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    panels = await get_all_panels(supabase, project_id)
    panel = next((p for p in panels if p.get('name', '').lower() == panel_name.lower()), None)

    if not panel:
        return {"error": f"Panel '{panel_name}' not found"}

    # Get circuits
    circuits = await get_panel_circuits(supabase, panel['id'])
    circuit_count = len(circuits)

    # Calculate total load
    total_load_va = sum(c.get('load_va', 0) for c in circuits)

    # Get panel capacity
    bus_rating = panel.get('bus_rating', 200)
    voltage = panel.get('voltage', 240)
    phases = panel.get('phases', 1)

    if phases == 3:
        capacity_va = bus_rating * voltage * 1.732
    else:
        capacity_va = bus_rating * voltage

    utilization = (total_load_va / capacity_va * 100) if capacity_va > 0 else 0

    # Check violations
    violations = []

    # NEC 408.36 - Max 42 poles
    if circuit_count > 42:
        violations.append(f"Exceeds 42 circuit maximum (NEC 408.36): {circuit_count} circuits")

    # NEC 408.30 - 80% continuous load limit
    if utilization > 80:
        violations.append(f"Exceeds 80% continuous load limit (NEC 408.30): {utilization:.1f}%")

    return {
        "panel_name": panel_name,
        "circuit_count": circuit_count,
        "utilization_percent": utilization,
        "bus_rating": bus_rating,
        "compliant": len(violations) == 0,
        "violations": violations
    }


@predictive_inspector_agent.tool
async def check_voltage_drop_compliance(ctx: RunContext[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Check all feeders for voltage drop compliance

    Returns:
        List of voltage drop violations
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    feeders = await get_all_feeders(supabase, project_id)

    violations = []

    for feeder in feeders:
        vdrop = feeder.get('voltage_drop_percent', 0)

        # NEC 210.19(A) - 3% branch circuits, 5% total
        # NEC 215.2(A)(1) - Feeder to panel
        if vdrop > 3:  # Feeder limit
            violations.append({
                "feeder": feeder.get('name', 'Unknown'),
                "voltage_drop": vdrop,
                "limit": 3.0,
                "article": "NEC 210.19(A) / 215.2(A)(1)",
                "severity": "High" if vdrop > 5 else "Medium"
            })

    return violations


async def predict_inspection(
    supabase: Client,
    project_id: str
) -> InspectionPrediction:
    """
    Main function to predict inspection outcome

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        Complete inspection prediction with recommendations
    """
    prompt = """
Analyze this electrical project and predict the likelihood of passing/failing inspection.

Consider:
1. Service sizing and protection
2. Panel loading and circuit counts
3. Grounding and bonding system completeness
4. Voltage drop on feeders
5. Open issues and their severity
6. Documentation completeness
7. Common inspection failure points

For each predicted issue:
- Explain WHY it would likely fail inspection
- Cite the specific NEC article
- Provide a specific, actionable fix
- Estimate time to fix (be realistic: "2 hours", "1 day", etc.)
- Assign likelihood (0.0-1.0) based on severity and how strict inspectors typically are

Calculate overall failure likelihood:
- If Critical issues exist: 0.8-1.0
- If High issues exist: 0.5-0.8
- If only Medium issues: 0.2-0.5
- If only Low issues: 0.0-0.2

Provide a preparation checklist with specific tasks to complete before inspection.
"""

    # Run agent with tools
    result = await predictive_inspector_agent.run(
        prompt,
        deps={'supabase': supabase, 'project_id': project_id}
    )

    return result.output
