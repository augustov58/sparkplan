"""
Photo Analyzer Agent

Uses Gemini Vision AI to analyze electrical installation photos and detect NEC violations.
This is a UNIQUE capability that competitors don't have.
"""

from pydantic_ai import Agent, RunContext, BinaryContent
from models.schemas import PhotoAnalysis, NecViolation, Equipment
from tools.database import get_project_data, get_all_panels
from supabase import Client
from typing import Dict, Any
import logging
from PIL import Image
import io

logger = logging.getLogger(__name__)

# Create Pydantic AI agent with multimodal support
photo_analyzer_agent = Agent(
    'gemini-2.0-flash-exp',
    output_type=PhotoAnalysis,
    system_prompt="""You are an expert electrical inspector with deep knowledge of the National Electrical Code (NEC).

Your role is to analyze photos of electrical installations and identify:
1. **NEC Code Violations** - Cite specific articles (e.g., NEC 408.36, 250.122)
2. **Equipment Details** - Identify panels, breakers, transformers, conduit, etc.
3. **Safety Concerns** - Highlight any dangerous conditions
4. **Installation Quality** - Note workmanship issues
5. **Compliance Status** - Overall assessment

When analyzing photos:
- Be thorough but practical - focus on significant issues
- Cite specific NEC articles for violations
- Consider the context (residential vs commercial, indoor vs outdoor)
- Rate severity appropriately:
  - **Critical**: Immediate safety hazard, will fail inspection
  - **Warning**: Code violation, needs correction
  - **Info**: Best practice suggestion, not a violation
- Provide actionable recommendations

NEC Articles to Watch For:
- **408.36**: Panel max circuits (42 poles)
- **408.30**: Panel bus loading (80% max continuous)
- **110.26**: Working clearances (3ft min)
- **110.3(B)**: Equipment listing and labeling
- **250.8**: Grounding connections (proper terminations)
- **314.16**: Box fill calculations
- **110.12**: Workmanship
- **300.4**: Protection against physical damage
- **312.6**: Deflection of conductors
"""
)


@photo_analyzer_agent.system_prompt
async def add_project_context(ctx: RunContext[Dict[str, Any]]) -> str:
    """
    Add project-specific context for more accurate analysis

    Args:
        ctx: Run context with supabase client and project_id

    Returns:
        Project context string
    """
    supabase: Client = ctx.deps['supabase']
    project_id: str = ctx.deps['project_id']

    # Fetch project data
    project = await get_project_data(supabase, project_id)
    if not project:
        return "Project data unavailable."

    # Get panels for reference
    panels = await get_all_panels(supabase, project_id)

    context = f"""
## Project Context

**Project:** {project.get('name', 'Unnamed')}
**Type:** {project.get('type', 'Unknown')} Installation
**Service:** {project.get('service_size', 200)}A, {project.get('voltage', 240)}V, {project.get('phases', 1)}-Phase
**NEC Edition:** {project.get('nec_edition', '2023')}

**Panels in System:**
{chr(10).join([f"- {p.get('name')}: {p.get('bus_rating', 0)}A, {p.get('voltage', 240)}V" for p in panels[:5]]) if panels else "No panels configured"}

Use this context when analyzing the photo - if you can identify specific equipment, reference it.
"""
    return context


@photo_analyzer_agent.tool
async def get_nec_requirements(
    ctx: RunContext[Dict[str, Any]],
    equipment_type: str
) -> Dict[str, Any]:
    """
    Get NEC requirements for specific equipment types

    Args:
        equipment_type: Type of equipment (e.g., "panel", "transformer", "conduit")

    Returns:
        Relevant NEC requirements
    """
    # Simplified NEC requirements lookup
    requirements = {
        "panel": {
            "articles": ["408.30", "408.36", "408.40", "110.26"],
            "key_requirements": [
                "Max 42 poles per panel (408.36)",
                "80% max continuous load (408.30)",
                "Working clearance 3ft min (110.26)",
                "Proper labeling required (408.4)"
            ]
        },
        "service_entrance": {
            "articles": ["230.70", "230.79", "230.90", "230.95"],
            "key_requirements": [
                "Disconnect must be readily accessible (230.70)",
                "Rating must match service conductors (230.79)",
                "Overload protection required (230.90)",
                "Proper grounding required (250.24)"
            ]
        },
        "transformer": {
            "articles": ["450.3", "450.4", "450.5"],
            "key_requirements": [
                "Overcurrent protection required (450.3)",
                "Disconnecting means required (450.4)",
                "Grounding required (450.5)"
            ]
        },
        "grounding": {
            "articles": ["250.50", "250.52", "250.53", "250.66"],
            "key_requirements": [
                "Grounding electrode system required (250.50)",
                "Proper electrode types (250.52)",
                "GEC sizing per 250.66",
                "Bonding jumpers properly sized (250.102)"
            ]
        },
        "conduit": {
            "articles": ["300.4", "314.16", "352.10"],
            "key_requirements": [
                "Protection against physical damage (300.4)",
                "Proper fill calculations (314.16)",
                "Proper support and securement (352.30)"
            ]
        }
    }

    equipment_lower = equipment_type.lower()

    for key, reqs in requirements.items():
        if key in equipment_lower:
            return reqs

    return {
        "articles": [],
        "key_requirements": ["No specific requirements found for this equipment type"]
    }


async def analyze_photo(
    supabase: Client,
    project_id: str,
    image_data: bytes,
    description: str = ""
) -> PhotoAnalysis:
    """
    Main function to analyze an electrical installation photo

    Args:
        supabase: Supabase client
        project_id: Project UUID
        image_data: Photo bytes (JPEG, PNG, etc.)
        description: Optional context about what the photo shows

    Returns:
        Complete photo analysis with violations and recommendations
    """
    # Load image with PIL to get dimensions and format
    try:
        img = Image.open(io.BytesIO(image_data))
        width, height = img.size
        format_str = img.format or "Unknown"
    except Exception as e:
        logger.error(f"Error loading image: {e}")
        width, height, format_str = 0, 0, "Unknown"

    prompt = f"""
Analyze this electrical installation photo and provide a detailed inspection report.

**Photo Details:**
- Dimensions: {width}x{height}px
- Format: {format_str}
{f"**User Description:** {description}" if description else ""}

Please identify:
1. All equipment visible in the photo (panels, breakers, transformers, conduit, etc.)
2. Any NEC code violations with specific article citations
3. Safety concerns or workmanship issues
4. Equipment ratings if visible (amperage, voltage, manufacturer)
5. Overall compliance status

Be specific - cite NEC articles, describe exact locations, and provide actionable recommendations.
If the photo quality is poor or equipment is not clearly visible, note this in your analysis.
"""

    # Run agent with vision capabilities
    # Pass list with text prompt and binary image data (per Pydantic AI docs)
    result = await photo_analyzer_agent.run(
        [
            prompt,
            BinaryContent(data=image_data, media_type='image/png')
        ],
        deps={'supabase': supabase, 'project_id': project_id}
    )

    return result.output


async def analyze_photo_from_url(
    supabase: Client,
    project_id: str,
    image_url: str,
    description: str = ""
) -> PhotoAnalysis:
    """
    Analyze photo from Supabase Storage URL

    Args:
        supabase: Supabase client
        project_id: Project UUID
        image_url: Supabase Storage URL
        description: Optional context

    Returns:
        Photo analysis
    """
    import httpx

    # Download image from Supabase Storage
    async with httpx.AsyncClient() as client:
        response = await client.get(image_url)
        if response.status_code != 200:
            raise Exception(f"Failed to download image: {response.status_code}")

        image_data = response.content

    return await analyze_photo(supabase, project_id, image_data, description)
