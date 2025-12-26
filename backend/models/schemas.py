from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime


# ============================================================================
# CHANGE IMPACT ANALYSIS MODELS
# ============================================================================

class ServiceImpact(BaseModel):
    """Impact on main service"""
    upgrade_needed: bool
    current_size: int  # Amps
    required_size: Optional[int] = None
    utilization_before: float  # Percentage
    utilization_after: float  # Percentage
    reason: Optional[str] = None


class FeederImpact(BaseModel):
    """Impact on feeder cables"""
    feeder_id: str
    feeder_name: str
    upgrade_needed: bool
    current_size: str  # e.g., "#2/0 Cu"
    required_size: Optional[str] = None
    reason: str


class PanelImpact(BaseModel):
    """Impact on electrical panels"""
    panel_id: str
    panel_name: str
    issue_type: str  # e.g., "capacity", "circuit_count", "bus_rating"
    current_value: float
    new_value: float
    threshold: float
    recommendation: str


class VoltageDropIssue(BaseModel):
    """Voltage drop problems"""
    location: str  # Panel or feeder name
    current_drop: float  # Percentage
    new_drop: float  # Percentage
    nec_limit: float  # 3% or 5%
    compliant: bool
    recommendation: str


class CostEstimate(BaseModel):
    """Cost estimation"""
    low: int  # USD
    high: int  # USD
    breakdown: dict  # e.g., {"service_upgrade": 5000, "feeder": 2000}
    assumptions: List[str]


class TimelineImpact(BaseModel):
    """Project timeline impact"""
    delay_days: int
    critical_path_affected: bool
    reason: str


class ChangeImpact(BaseModel):
    """Complete change impact analysis"""
    can_accommodate: bool
    impact_summary: str = Field(..., description="High-level summary of the impact")
    service_impact: Optional[ServiceImpact] = None
    feeder_impacts: List[FeederImpact] = Field(default_factory=list)
    panel_impacts: List[PanelImpact] = Field(default_factory=list)
    voltage_drop_issues: List[VoltageDropIssue] = Field(default_factory=list)
    cost_estimate: Optional[CostEstimate] = None
    timeline_impact: Optional[TimelineImpact] = None
    recommendations: List[str] = Field(default_factory=list)
    change_order_draft: Optional[str] = None


# ============================================================================
# RFI DRAFTER MODELS
# ============================================================================

class RFIDraft(BaseModel):
    """AI-generated RFI draft"""
    subject: str = Field(..., min_length=5, max_length=200)
    question: str = Field(..., min_length=20)
    suggested_recipient: Optional[str] = None
    priority: Literal['Low', 'Medium', 'High', 'Urgent']
    related_nec_articles: List[str] = Field(default_factory=list)
    rationale: str = Field(..., description="Why this RFI is needed")


# ============================================================================
# PHOTO ANALYSIS MODELS
# ============================================================================

class NecViolation(BaseModel):
    """NEC code violation detected in photo"""
    nec_article: str  # e.g., "NEC 408.36"
    description: str
    severity: Literal['Info', 'Warning', 'Critical']
    recommendation: str
    location_in_photo: Optional[str] = None


class Equipment(BaseModel):
    """Equipment identified in photo"""
    type: str  # e.g., "panel", "breaker", "transformer"
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    rating: Optional[str] = None  # e.g., "200A", "480V"
    condition: Literal['Good', 'Fair', 'Poor', 'Unknown']


class PhotoAnalysis(BaseModel):
    """Complete photo analysis result"""
    summary: str = Field(..., description="Overall summary of what's in the photo")
    violations: List[NecViolation] = Field(default_factory=list)
    equipment_identified: List[Equipment] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    severity: Literal['Info', 'Warning', 'Critical']
    requires_correction: bool
    suggested_actions: List[str] = Field(default_factory=list)


# ============================================================================
# PREDICTIVE INSPECTION MODELS
# ============================================================================

class PredictedIssue(BaseModel):
    """Issue that might cause inspection failure"""
    category: str  # e.g., "Grounding", "Panel Schedule", "Voltage Drop"
    description: str
    nec_reference: str
    likelihood: float = Field(..., ge=0.0, le=1.0)
    suggested_fix: str
    estimated_fix_time: str  # e.g., "2 hours", "1 day"


class InspectionPrediction(BaseModel):
    """Prediction of inspection outcome"""
    failure_likelihood: float = Field(..., ge=0.0, le=1.0)
    risk_level: Literal['Low', 'Medium', 'High', 'Critical']
    predicted_issues: List[PredictedIssue] = Field(default_factory=list)
    preparation_checklist: List[str] = Field(default_factory=list)
    estimated_prep_time: str
    confidence: float = Field(..., ge=0.0, le=1.0)


# ============================================================================
# AGENT ACTION MODELS (for database)
# ============================================================================

class AgentActionCreate(BaseModel):
    """Request to create agent action"""
    project_id: str
    action_type: Literal['draft_rfi', 'suggest_change', 'predict_failure', 'flag_violation', 'recommend_upgrade', 'generate_notes']
    agent_name: Literal['rfi_drafter', 'change_impact', 'photo_analyzer', 'predictive_inspector', 'content_generator']
    title: str
    description: str
    reasoning: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    action_data: dict
    impact_analysis: Optional[dict] = None
    priority: int = Field(50, ge=0, le=100)


class AgentActionResponse(BaseModel):
    """Agent action stored in database"""
    id: str
    project_id: str
    user_id: str
    action_type: str
    agent_name: str
    priority: int
    status: Literal['pending', 'approved', 'rejected', 'expired']
    title: str
    description: str
    reasoning: Optional[str]
    confidence_score: Optional[float]
    action_data: dict
    impact_analysis: Optional[dict]
    user_notes: Optional[str]
    rejection_reason: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]
    expires_at: Optional[datetime]
    updated_at: datetime


# ============================================================================
# API REQUEST MODELS
# ============================================================================

class ProposedLoad(BaseModel):
    """A proposed electrical load"""
    type: str  # e.g., "ev_charger", "heat_pump", "hvac"
    amps: float
    quantity: int = 1


class AnalyzeChangeRequest(BaseModel):
    """Request body for change impact analysis"""
    project_id: str
    change_description: str
    proposed_loads: List[ProposedLoad]


class DraftRFIRequest(BaseModel):
    """Request body for RFI drafting"""
    project_id: str
    topic: str
    context: Optional[str] = None


class AnalyzePhotoRequest(BaseModel):
    """Request body for photo analysis"""
    project_id: str
    image_data: str  # base64 encoded or URL
    description: Optional[str] = None


class PredictInspectionRequest(BaseModel):
    """Request body for inspection prediction"""
    project_id: str
