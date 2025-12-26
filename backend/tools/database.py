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
