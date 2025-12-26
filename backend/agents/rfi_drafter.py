"""
RFI Drafter Agent

Generates AI-drafted Request for Information (RFI) questions based on project context.
Helps contractors quickly create professional RFI submissions.
"""

from pydantic_ai import Agent, RunContext
from models.schemas import RFIDraft
from tools.database import (
    get_project_data,
    get_recent_rfis,
    get_all_issues,
    get_all_panels
)
from supabase import Client
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Create Pydantic AI agent
rfi_drafter_agent = Agent(
    'gemini-2.0-flash-exp',
    output_type=RFIDraft,
    system_prompt="""You are a professional electrical project coordinator specializing in RFI (Request for Information) documentation.

Your role is to draft clear, professional RFI questions that:
1. Are specific and answerable
2. Reference relevant NEC articles when applicable
3. Include necessary context for the recipient
4. Are appropriately prioritized based on project impact
5. Follow industry standard RFI format

When drafting RFIs:
- Be concise but include all necessary details
- Use professional language
- Avoid yes/no questions - ask for specific information or clarification
- Consider the recipient's perspective (architect, engineer, inspector, etc.)
- Identify potential project impacts if the question isn't resolved

RFI Priority Guidelines:
- **Urgent**: Blocks critical path, safety concern, or inspection required
- **High**: Affects design decisions, schedule impact, or cost implications
- **Medium**: Clarification needed but has workarounds
- **Low**: Nice to know, documentation purposes, future reference
"""
)


@rfi_drafter_agent.system_prompt
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

    # Get recent RFIs for context
    recent_rfis = await get_recent_rfis(supabase, project_id, limit=3)

    # Get open issues
    issues = await get_all_issues(supabase, project_id)

    context = f"""
## Current Project Context

**Project:** {project.get('name', 'Unnamed')}
**Type:** {project.get('type', 'Unknown')}
**Service:** {project.get('service_size', 200)}A, {project.get('voltage', 240)}V, {project.get('phases', 1)}-Phase
**Status:** Active

**Recent RFIs ({len(recent_rfis)}):**
{chr(10).join([f"- {rfi.get('subject', 'No subject')} (Status: {rfi.get('status', 'Unknown')})" for rfi in recent_rfis]) if recent_rfis else "No recent RFIs"}

**Open Issues ({len(issues)}):**
{chr(10).join([f"- {issue.get('description', 'No description')[:60]}..." for issue in issues[:3]]) if issues else "No open issues"}

Use this context to ensure the RFI is relevant and doesn't duplicate recent questions.
"""
    return context


@rfi_drafter_agent.tool
async def get_panel_info(ctx: RunContext[Dict[str, Any]], panel_name: str) -> Dict[str, Any]:
    """
    Get detailed information about a specific panel

    Args:
        panel_name: Name of the panel (e.g., "Panel H1", "MDP")

    Returns:
        Panel specifications
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    panels = await get_all_panels(supabase, project_id)

    # Find matching panel
    panel = next((p for p in panels if p.get('name', '').lower() == panel_name.lower()), None)

    if not panel:
        return {"error": f"Panel '{panel_name}' not found"}

    return {
        "name": panel.get('name'),
        "type": panel.get('panel_type'),
        "rating": f"{panel.get('bus_rating', 0)}A",
        "voltage": f"{panel.get('voltage', 240)}V",
        "phases": panel.get('phases', 1),
        "main_breaker": f"{panel.get('main_breaker_rating', 0)}A",
        "location": panel.get('location', 'Not specified')
    }


@rfi_drafter_agent.tool
async def lookup_nec_article(ctx: RunContext[Dict[str, Any]], topic: str) -> List[str]:
    """
    Look up relevant NEC articles for a given topic

    Args:
        topic: Topic to search for (e.g., "grounding", "panel sizing", "voltage drop")

    Returns:
        List of relevant NEC article numbers
    """
    # Simplified NEC article lookup
    nec_references = {
        "grounding": ["250.50", "250.52", "250.53", "250.66"],
        "bonding": ["250.92", "250.94", "250.96"],
        "panel": ["408.30", "408.36", "408.40"],
        "panel sizing": ["408.30", "408.36"],
        "service": ["230.42", "230.79", "230.90"],
        "feeder": ["215.2", "215.3", "215.10"],
        "voltage drop": ["210.19(A)", "215.2(A)(1)"],
        "conductor sizing": ["310.16", "240.4(D)"],
        "egc": ["250.122", "250.118"],
        "grounding electrode": ["250.50", "250.52", "250.53"],
        "transformer": ["450.3", "450.4", "450.5"],
        "ev charging": ["625.40", "625.42", "625.44"],
        "solar": ["690.8", "690.12", "690.15"],
        "emergency": ["700.12", "700.16", "700.27"],
    }

    topic_lower = topic.lower()

    # Find matching articles
    for key, articles in nec_references.items():
        if key in topic_lower:
            return articles

    return []


async def draft_rfi(
    supabase: Client,
    project_id: str,
    topic: str,
    context: str = ""
) -> RFIDraft:
    """
    Main function to draft an RFI

    Args:
        supabase: Supabase client
        project_id: Project UUID
        topic: Brief description of what the RFI is about
        context: Additional context or details

    Returns:
        Complete RFI draft
    """
    prompt = f"""
Draft a professional RFI (Request for Information) for the following:

**Topic:** {topic}

**Additional Context:** {context if context else "None provided"}

Please create:
1. A clear, specific subject line (max 200 characters)
2. A professional question that includes:
   - What information is needed
   - Why it's needed (impact on design/construction/schedule)
   - Any relevant technical details
   - Reference to NEC articles if applicable
3. Suggested recipient (if identifiable from topic)
4. Appropriate priority level
5. List of related NEC articles
6. Brief rationale for why this RFI is necessary

Make the question specific enough to get a useful answer, but concise enough to be quickly understood.
"""

    # Run agent with tools
    result = await rfi_drafter_agent.run(
        prompt,
        deps={'supabase': supabase, 'project_id': project_id}
    )

    return result.output
