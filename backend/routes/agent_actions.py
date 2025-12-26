"""
API Routes for Agent Actions

RESTful endpoints for triggering AI agents and managing agent suggestions.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from middleware.auth import get_current_user, get_supabase_client
from models.schemas import (
    AgentActionCreate,
    AgentActionResponse,
    ChangeImpact,
    RFIDraft,
    PhotoAnalysis,
    InspectionPrediction,
    AnalyzeChangeRequest,
    DraftRFIRequest,
    AnalyzePhotoRequest,
    PredictInspectionRequest
)
from agents.change_impact import analyze_change_impact
from agents.rfi_drafter import draft_rfi
from agents.photo_analyzer import analyze_photo
from agents.predictive import predict_inspection
from supabase import Client
from typing import List, Dict, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def queue_agent_action(
    supabase: Client,
    user_id: str,
    project_id: str,
    action_type: str,
    agent_name: str,
    title: str,
    description: str,
    action_data: dict,
    reasoning: str = None,
    confidence: float = None,
    impact_analysis: dict = None,
    priority: int = 50
) -> AgentActionResponse:
    """
    Queue an agent action in the database for user approval

    Args:
        supabase: Supabase client
        user_id: User UUID
        project_id: Project UUID
        action_type: Type of action
        agent_name: Which agent generated this
        title: Short title
        description: Detailed description
        action_data: The actual data (RFI draft, impact analysis, etc.)
        reasoning: Why the agent suggests this
        confidence: AI confidence score (0.0-1.0)
        impact_analysis: Optional impact analysis
        priority: 0-100 priority

    Returns:
        Created agent action
    """
    expires_at = datetime.utcnow() + timedelta(hours=72)

    data = {
        "project_id": project_id,
        "user_id": user_id,
        "action_type": action_type,
        "agent_name": agent_name,
        "priority": priority,
        "status": "pending",
        "title": title,
        "description": description,
        "reasoning": reasoning,
        "confidence_score": confidence,
        "action_data": action_data,
        "impact_analysis": impact_analysis,
        "expires_at": expires_at.isoformat()
    }

    response = supabase.table('agent_actions').insert(data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to queue agent action")

    return AgentActionResponse(**response.data[0])


# ============================================================================
# AGENT ENDPOINTS
# ============================================================================

@router.post("/agent-actions/analyze-change", response_model=AgentActionResponse)
async def trigger_change_impact_analysis(
    request: AnalyzeChangeRequest,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Trigger Change Impact Analyzer agent

    Request Body:
        - project_id: Project UUID
        - change_description: What's being added/changed
        - proposed_loads: List of loads [{"type": "ev_charger", "amps": 50, "quantity": 3}]

    Returns:
        Agent action queued for approval
    """
    try:
        # Convert Pydantic models to dicts for agent
        proposed_loads_dict = [load.model_dump() for load in request.proposed_loads]

        # Run agent analysis
        impact: ChangeImpact = await analyze_change_impact(
            supabase=supabase,
            project_id=request.project_id,
            change_description=request.change_description,
            proposed_loads=proposed_loads_dict
        )

        # Queue for user approval
        action = await queue_agent_action(
            supabase=supabase,
            user_id=user['id'],
            project_id=request.project_id,
            action_type="suggest_change",
            agent_name="change_impact",
            title=f"Impact Analysis: {request.change_description}",
            description=impact.impact_summary,
            action_data=impact.model_dump(),
            reasoning=f"Analyzed impact of: {request.change_description}",
            confidence=0.85 if impact.can_accommodate else 0.90,
            impact_analysis=impact.model_dump(),
            priority=80 if not impact.can_accommodate else 60
        )

        return action

    except Exception as e:
        logger.error(f"Error in change impact analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent-actions/draft-rfi", response_model=AgentActionResponse)
async def trigger_rfi_drafter(
    project_id: str,
    topic: str,
    context: str = "",
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Trigger RFI Drafter agent

    Request Body:
        - project_id: Project UUID
        - topic: What the RFI is about
        - context: Additional details (optional)

    Returns:
        Agent action with drafted RFI
    """
    try:
        # Run agent
        rfi_draft: RFIDraft = await draft_rfi(
            supabase=supabase,
            project_id=project_id,
            topic=topic,
            context=context
        )

        # Queue for user approval
        action = await queue_agent_action(
            supabase=supabase,
            user_id=user['id'],
            project_id=project_id,
            action_type="draft_rfi",
            agent_name="rfi_drafter",
            title=f"RFI Draft: {rfi_draft.subject}",
            description=f"AI-generated RFI about {topic}",
            action_data=rfi_draft.model_dump(),
            reasoning=rfi_draft.rationale,
            confidence=0.80,
            priority={"Urgent": 90, "High": 70, "Medium": 50, "Low": 30}.get(rfi_draft.priority, 50)
        )

        return action

    except Exception as e:
        logger.error(f"Error in RFI drafting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent-actions/analyze-photo", response_model=AgentActionResponse)
async def trigger_photo_analyzer(
    project_id: str = Form(...),
    description: str = Form(""),
    photo: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Trigger Photo Analyzer agent

    Form Data:
        - project_id: Project UUID
        - description: What the photo shows (optional)
        - photo: Image file (JPEG, PNG)

    Returns:
        Agent action with photo analysis and detected violations
    """
    try:
        # Read photo
        photo_data = await photo.read()

        # Run vision AI analysis
        analysis: PhotoAnalysis = await analyze_photo(
            supabase=supabase,
            project_id=project_id,
            image_data=photo_data,
            description=description
        )

        # Determine priority based on severity
        priority_map = {"Critical": 95, "Warning": 70, "Info": 40}
        priority = priority_map.get(analysis.severity, 50)

        # Queue for user approval
        action = await queue_agent_action(
            supabase=supabase,
            user_id=user['id'],
            project_id=project_id,
            action_type="flag_violation",
            agent_name="photo_analyzer",
            title=f"Photo Analysis: {len(analysis.violations)} issues found",
            description=analysis.summary,
            action_data=analysis.model_dump(),
            reasoning=f"Detected {len(analysis.violations)} NEC violations in photo",
            confidence=0.75,  # Vision AI is less certain than text analysis
            priority=priority
        )

        return action

    except Exception as e:
        logger.error(f"Error in photo analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent-actions/predict-inspection", response_model=AgentActionResponse)
async def trigger_predictive_inspector(
    project_id: str,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Trigger Predictive Inspector agent

    Request Body:
        - project_id: Project UUID

    Returns:
        Agent action with inspection failure prediction
    """
    try:
        # Run predictive analysis
        prediction: InspectionPrediction = await predict_inspection(
            supabase=supabase,
            project_id=project_id
        )

        # Determine priority based on failure likelihood
        if prediction.failure_likelihood > 0.7:
            priority = 95
        elif prediction.failure_likelihood > 0.4:
            priority = 75
        else:
            priority = 50

        # Queue for user approval
        action = await queue_agent_action(
            supabase=supabase,
            user_id=user['id'],
            project_id=project_id,
            action_type="predict_failure",
            agent_name="predictive_inspector",
            title=f"Inspection Prediction: {prediction.risk_level} Risk",
            description=f"{int(prediction.failure_likelihood * 100)}% likelihood of issues - {len(prediction.predicted_issues)} potential problems identified",
            action_data=prediction.model_dump(),
            reasoning=f"Analyzed project for inspection readiness. Risk level: {prediction.risk_level}",
            confidence=prediction.confidence,
            priority=priority
        )

        return action

    except Exception as e:
        logger.error(f"Error in inspection prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AGENT ACTION MANAGEMENT
# ============================================================================

@router.get("/agent-actions/{project_id}", response_model=List[AgentActionResponse])
async def get_pending_actions(
    project_id: str,
    agent_name: str = None,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Get all pending agent actions for a project

    Query Params:
        - agent_name: Filter by specific agent (optional)

    Returns:
        List of pending agent actions
    """
    try:
        query = supabase.table('agent_actions') \
            .select('*') \
            .eq('project_id', project_id) \
            .eq('user_id', user['id']) \
            .eq('status', 'pending') \
            .order('priority', desc=True) \
            .order('created_at', desc=True)

        if agent_name:
            query = query.eq('agent_name', agent_name)

        response = query.execute()

        return [AgentActionResponse(**action) for action in response.data]

    except Exception as e:
        logger.error(f"Error fetching agent actions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent-actions/{action_id}/approve")
async def approve_action(
    action_id: str,
    user_notes: str = None,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Approve an agent action (user confirms)

    Request Body:
        - user_notes: Optional notes from user

    Returns:
        Success message
    """
    try:
        # Update status
        response = supabase.table('agent_actions') \
            .update({
                "status": "approved",
                "reviewed_at": datetime.utcnow().isoformat(),
                "user_notes": user_notes
            }) \
            .eq('id', action_id) \
            .eq('user_id', user['id']) \
            .execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Agent action not found")

        # TODO: Execute the action (create RFI, update specs, etc.)
        # For now, just approve

        return {"success": True, "message": "Agent action approved"}

    except Exception as e:
        logger.error(f"Error approving action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agent-actions/{action_id}/reject")
async def reject_action(
    action_id: str,
    reason: str = None,
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client)
):
    """
    Reject an agent action (user declines)

    Request Body:
        - reason: Why rejected (optional)

    Returns:
        Success message
    """
    try:
        # Update status
        response = supabase.table('agent_actions') \
            .update({
                "status": "rejected",
                "reviewed_at": datetime.utcnow().isoformat(),
                "rejection_reason": reason
            }) \
            .eq('id', action_id) \
            .eq('user_id', user['id']) \
            .execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Agent action not found")

        return {"success": True, "message": "Agent action rejected"}

    except Exception as e:
        logger.error(f"Error rejecting action: {e}")
        raise HTTPException(status_code=500, detail=str(e))
