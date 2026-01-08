"""
Database query tools for Pydantic AI agents

These functions are exposed as tools that agents can call to fetch data from Supabase.
"""

from supabase import Client
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


async def get_project_data(supabase: Client, project_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch complete project data including service parameters

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        Project data dict or None
    """
    try:
        response = supabase.table('projects').select('*').eq('id', project_id).single().execute()
        return response.data if response.data else None
    except Exception as e:
        logger.error(f"Error fetching project {project_id}: {e}")
        return None


async def get_all_panels(supabase: Client, project_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all panels for a project with hierarchy information

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        List of panel dicts
    """
    try:
        response = supabase.table('panels').select('*').eq('project_id', project_id).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching panels for project {project_id}: {e}")
        return []


async def get_panel_circuits(supabase: Client, panel_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all circuits for a specific panel

    Args:
        supabase: Supabase client
        panel_id: Panel UUID

    Returns:
        List of circuit dicts
    """
    try:
        response = supabase.table('circuits').select('*').eq('panel_id', panel_id).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching circuits for panel {panel_id}: {e}")
        return []


async def get_all_feeders(supabase: Client, project_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all feeders for a project

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        List of feeder dicts
    """
    try:
        response = supabase.table('feeders').select('*').eq('project_id', project_id).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching feeders for project {project_id}: {e}")
        return []


async def get_all_issues(supabase: Client, project_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all open issues for a project

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        List of issue dicts
    """
    try:
        response = supabase.table('issues').select('*').eq('project_id', project_id).eq('status', 'Open').execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching issues for project {project_id}: {e}")
        return []


async def get_recent_rfis(supabase: Client, project_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fetch recent RFIs for context

    Args:
        supabase: Supabase client
        project_id: Project UUID
        limit: Number of RFIs to fetch

    Returns:
        List of RFI dicts
    """
    try:
        response = (
            supabase.table('rfis')
            .select('*')
            .eq('project_id', project_id)
            .order('created_at', desc=True)
            .limit(limit)
            .execute()
        )
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching RFIs for project {project_id}: {e}")
        return []


async def calculate_total_panel_load(supabase: Client, panel_id: str) -> float:
    """
    Calculate total connected load on a panel

    Args:
        supabase: Supabase client
        panel_id: Panel UUID

    Returns:
        Total load in VA
    """
    try:
        circuits = await get_panel_circuits(supabase, panel_id)
        total_load = sum(c.get('load_va', 0) for c in circuits)
        return total_load
    except Exception as e:
        logger.error(f"Error calculating panel load for {panel_id}: {e}")
        return 0.0


async def get_service_utilization(supabase: Client, project_id: str) -> Dict[str, Any]:
    """
    Calculate current service utilization

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        Dict with service_size, total_load, utilization_percent
    """
    try:
        # Get project service size
        project = await get_project_data(supabase, project_id)
        if not project:
            return {"error": "Project not found"}

        service_size = project.get('service_size', 200)
        voltage = project.get('voltage', 240)
        phases = project.get('phases', 1)

        # Get all panels
        panels = await get_all_panels(supabase, project_id)

        # Calculate total load
        total_load_va = 0
        for panel in panels:
            panel_load = await calculate_total_panel_load(supabase, panel['id'])
            total_load_va += panel_load

        # Calculate service capacity in VA
        if phases == 3:
            service_capacity_va = service_size * voltage * 1.732  # sqrt(3)
        else:
            service_capacity_va = service_size * voltage

        utilization_percent = (total_load_va / service_capacity_va * 100) if service_capacity_va > 0 else 0

        return {
            "service_size": service_size,
            "voltage": voltage,
            "phases": phases,
            "service_capacity_va": service_capacity_va,
            "total_load_va": total_load_va,
            "utilization_percent": utilization_percent
        }

    except Exception as e:
        logger.error(f"Error calculating service utilization for {project_id}: {e}")
        return {"error": str(e)}


async def get_all_circuits(supabase: Client, project_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all circuits for a project (across all panels)

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        List of circuit dicts
    """
    try:
        response = supabase.table('circuits').select('*').eq('project_id', project_id).execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"Error fetching circuits for project {project_id}: {e}")
        return []


async def get_panel_utilization(supabase: Client, panel_id: str) -> Dict[str, Any]:
    """
    Calculate detailed utilization for a specific panel

    Args:
        supabase: Supabase client
        panel_id: Panel UUID

    Returns:
        Dict with detailed panel utilization info
    """
    try:
        # Get panel info
        panel_response = supabase.table('panels').select('*').eq('id', panel_id).single().execute()
        panel = panel_response.data if panel_response.data else {}

        # Get circuits for this panel
        circuits = await get_panel_circuits(supabase, panel_id)

        bus_rating = panel.get('bus_rating', 200)
        voltage = panel.get('voltage', 240)
        phases = panel.get('phase', 1)
        max_spaces = panel.get('spaces', 42)

        # Calculate load
        total_load_va = sum(c.get('load_va', c.get('load_watts', 0)) for c in circuits)
        total_poles_used = sum(c.get('pole', 1) for c in circuits)

        # Calculate capacity
        if phases == 3:
            capacity_va = bus_rating * voltage * 1.732
        else:
            capacity_va = bus_rating * voltage

        capacity_amps = bus_rating
        current_load_amps = total_load_va / voltage if voltage > 0 else 0
        available_amps = capacity_amps - current_load_amps
        utilization_percent = (total_load_va / capacity_va * 100) if capacity_va > 0 else 0

        return {
            "panel_id": panel_id,
            "panel_name": panel.get('name', 'Unknown'),
            "bus_rating_amps": bus_rating,
            "voltage": voltage,
            "phases": phases,
            "capacity_va": capacity_va,
            "current_load_va": total_load_va,
            "current_load_amps": round(current_load_amps, 1),
            "available_amps": round(available_amps, 1),
            "utilization_percent": round(utilization_percent, 1),
            "total_spaces": max_spaces,
            "spaces_used": total_poles_used,
            "spaces_available": max_spaces - total_poles_used,
            "circuit_count": len(circuits),
            "can_add_load": utilization_percent < 80,
            "status": "OK" if utilization_percent < 80 else "WARNING" if utilization_percent < 100 else "OVERLOADED"
        }
    except Exception as e:
        logger.error(f"Error calculating panel utilization for {panel_id}: {e}")
        return {"error": str(e)}


async def check_service_capacity(
    supabase: Client,
    project_id: str,
    additional_load_amps: float
) -> Dict[str, Any]:
    """
    Check if service can accommodate additional load

    Args:
        supabase: Supabase client
        project_id: Project UUID
        additional_load_amps: Proposed additional load in amps

    Returns:
        Dict with pass/fail and detailed capacity analysis
    """
    try:
        # Get current service utilization
        service_util = await get_service_utilization(supabase, project_id)

        if "error" in service_util:
            return {"error": service_util["error"], "can_proceed": False}

        service_size = service_util.get('service_size', 200)
        voltage = service_util.get('voltage', 240)
        current_load_va = service_util.get('total_load_va', 0)
        current_load_amps = current_load_va / voltage if voltage > 0 else 0

        # Calculate new totals
        additional_load_va = additional_load_amps * voltage
        new_total_va = current_load_va + additional_load_va
        new_total_amps = current_load_amps + additional_load_amps

        # Calculate capacity
        capacity_va = service_util.get('service_capacity_va', service_size * voltage)

        # Determine status
        new_utilization = (new_total_va / capacity_va * 100) if capacity_va > 0 else 0
        available_amps = service_size - current_load_amps
        remaining_after_change = service_size - new_total_amps

        # Determine if change can proceed
        can_proceed = new_utilization <= 80  # NEC recommends 80% max continuous
        requires_upgrade = new_utilization > 100
        warning = 80 < new_utilization <= 100

        return {
            "can_proceed": can_proceed,
            "requires_service_upgrade": requires_upgrade,
            "warning": warning,
            "service_size_amps": service_size,
            "current_load_amps": round(current_load_amps, 1),
            "proposed_additional_amps": additional_load_amps,
            "new_total_amps": round(new_total_amps, 1),
            "available_before_change_amps": round(available_amps, 1),
            "remaining_after_change_amps": round(remaining_after_change, 1),
            "current_utilization_percent": round(service_util.get('utilization_percent', 0), 1),
            "new_utilization_percent": round(new_utilization, 1),
            "recommended_service_size": _get_recommended_service_size(new_total_amps) if requires_upgrade else None,
            "verdict": _get_capacity_verdict(new_utilization, remaining_after_change)
        }
    except Exception as e:
        logger.error(f"Error checking service capacity: {e}")
        return {"error": str(e), "can_proceed": False}


def _get_recommended_service_size(required_amps: float) -> int:
    """Get next standard service size that can handle the load"""
    standard_sizes = [100, 125, 150, 200, 225, 320, 400, 600, 800, 1000, 1200]
    # Apply 80% rule - service should be at most 80% loaded
    required_service = required_amps / 0.8
    for size in standard_sizes:
        if size >= required_service:
            return size
    return 1200  # Max standard residential


def _get_capacity_verdict(utilization: float, remaining_amps: float) -> str:
    """Generate human-readable verdict"""
    if utilization > 100:
        return f"REJECT - Service overloaded by {abs(remaining_amps):.0f}A. Service upgrade required."
    elif utilization > 80:
        return f"WARNING - Service at {utilization:.0f}% utilization. Only {remaining_amps:.0f}A margin remaining. Consider upgrade."
    elif utilization > 60:
        return f"APPROVE WITH CAUTION - Service at {utilization:.0f}% utilization. {remaining_amps:.0f}A remaining."
    else:
        return f"APPROVE - Service has adequate capacity. {remaining_amps:.0f}A remaining after change."


async def get_large_loads(supabase: Client, project_id: str, min_amps: int = 20) -> List[Dict[str, Any]]:
    """
    Fetch all large loads (circuits) in the project

    Args:
        supabase: Supabase client
        project_id: Project UUID
        min_amps: Minimum breaker size to consider "large"

    Returns:
        List of large load circuits
    """
    try:
        circuits = await get_all_circuits(supabase, project_id)
        large_loads = [
            {
                "description": c.get('description', 'Unknown'),
                "breaker_amps": c.get('breaker_amps', 0),
                "load_va": c.get('load_va', c.get('load_watts', 0)),
                "load_type": c.get('load_type', 'Unknown'),
                "panel_id": c.get('panel_id')
            }
            for c in circuits
            if c.get('breaker_amps', 0) >= min_amps
        ]
        return sorted(large_loads, key=lambda x: x['breaker_amps'], reverse=True)
    except Exception as e:
        logger.error(f"Error fetching large loads: {e}")
        return []


async def get_grounding_system(supabase: Client, project_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch grounding system details from grounding_details table

    Args:
        supabase: Supabase client
        project_id: Project UUID

    Returns:
        Grounding system data or None
    """
    try:
        # Query grounding_details table instead of projects
        response = supabase.table('grounding_details').select('*').eq('project_id', project_id).single().execute()

        if not response.data:
            return {
                "grounding_electrode_conductor": "Not configured",
                "grounding_electrode_type": "Not configured",
                "electrodes": [],
                "bonding": [],
                "gec_size": "Not specified",
                "notes": ""
            }

        grounding = response.data

        # Format for agent context
        # Map gec_size to grounding_electrode_conductor (what agent expects)
        # Join electrodes array into readable string for grounding_electrode_type
        return {
            "grounding_electrode_conductor": grounding.get('gec_size', 'Not specified'),
            "grounding_electrode_type": ', '.join(grounding.get('electrodes', [])) if grounding.get('electrodes') else 'Not configured',
            "bonding": ', '.join(grounding.get('bonding', [])) if grounding.get('bonding') else 'Not configured',
            "electrodes": grounding.get('electrodes', []),
            "gec_size": grounding.get('gec_size', 'Not specified'),
            "notes": grounding.get('notes', '')
        }
    except Exception as e:
        logger.error(f"Error fetching grounding for project {project_id}: {e}")
        return {
            "grounding_electrode_conductor": "Error fetching data",
            "grounding_electrode_type": "Error fetching data",
            "electrodes": [],
            "bonding": [],
            "gec_size": "Error fetching data",
            "notes": ""
        }
