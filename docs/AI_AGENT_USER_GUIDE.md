# AI Agent Features - User Guide

This guide explains how to use the three AI-powered features in SparkPlan: Change Impact Analyzer, RFI Drafter, and Photo Analyzer.

---

## Prerequisites

**IMPORTANT**: The Python backend must be running for these features to work.

```bash
# In a separate terminal, navigate to the backend directory
cd backend

# Start the FastAPI server (if not already running)
uvicorn main:app --reload --port 8000
```

You should see: `Uvicorn running on http://127.0.0.1:8000`

---

## Feature 1: Change Impact Analyzer

**Purpose**: Analyze cascading effects when you modify electrical systems (e.g., "Can I add 3 EV chargers without upgrading the service?")

### How to Access:
1. Open any project
2. Click **"Tools"** tab in the navigation
3. Scroll to the **"Change Impact Analyzer"** section

### How to Use:

**Step 1: Describe the Change**
- In the "Change Description" field, enter what you're planning to add:
  - Example: *"Add 3x Level 2 EV chargers to parking garage"*
  - Example: *"Install 15-ton rooftop HVAC unit"*
  - Example: *"Add commercial kitchen equipment (3x ovens, 2x fryers)"*

**Step 2: Add Proposed Loads**
- Each load requires:
  - **Equipment type**: "EV Charger", "HVAC Unit", "Heat Pump", etc.
  - **Amps**: The amperage draw (e.g., 50A for Level 2 EV charger)
  - **Qty**: Number of units (e.g., 3 for three chargers)
- Click **"+ Add Load"** to add more equipment

**Step 3: Analyze**
- Click **"Analyze Change Impact"** button
- You'll see a purple gradient button with spinning Sparkles icon
- Wait 5-10 seconds for AI analysis

**Step 4: View Results**
- Success message appears: *"Analysis started! Check the AI Copilot sidebar..."*
- **Open the AI Copilot sidebar** on the right side of the screen
- You'll see a new suggestion card with:
  - **Priority badge** (red = high priority if service upgrade needed)
  - **Confidence score** (e.g., 90%)
  - **Impact summary**: "Service upgrade to 400A required" or "Can accommodate on existing service"
  - **Expandable details**:
    - Service impact (current vs required size, utilization %)
    - Cost estimate ($8,500 - $12,000)
    - Timeline impact (+7 days delay)
    - Step-by-step recommendations with NEC references

**Step 5: Approve or Reject**
- Click **"Approve"** if you agree with the analysis
- Click **"Reject"** if you disagree or it's not relevant
- Approved actions are logged in your project history

---

## Feature 2: RFI Drafter (AI-Generated RFIs)

**Purpose**: Automatically draft professional Request for Information questions with NEC references

### How to Access:
1. Open any project
2. Click **"Project Management"** → **"RFI Manager"**
3. Click **"+ Create RFI"** button

### How to Use:

**Step 1: Choose Creation Mode**
- You'll see three options:
  - **Manual Entry** (traditional form)
  - **PDF Extraction** (extract from architect's RFI)
  - **Draft with AI** ← Click this one

**Step 2: Enter Topic**
- In the "RFI Topic" field, enter what you need to ask about:
  - Example: *"Service entrance grounding question"*
  - Example: *"Panel board location clarification"*
  - Example: *"Conduit routing through structural beam"*

**Step 3: Add Context (Optional)**
- In "Additional Context" field, provide more details:
  - Example: *"Inspector asked about GEC sizing for 400A service. Drawing shows #4 Cu but NEC 250.66 requires #2 Cu."*
  - This helps AI generate more specific questions

**Step 4: Draft RFI**
- Click **"Draft RFI with AI"** button
- Wait 5-10 seconds
- You'll see: *"Check AI Copilot sidebar for results"*

**Step 5: Review AI Draft in Sidebar**
- **Open the AI Copilot sidebar** on the right
- You'll see a new suggestion card showing:
  - **Priority badge** (Urgent/High/Medium/Low)
  - **Subject line** (professionally worded)
  - **Rationale** (why this RFI is needed)
  - **Question section** (detailed question text)
  - **Related NEC articles** (e.g., NEC 250.66, 230.95)
  - **Suggested recipient** (if applicable)

**Step 6: Approve to Create RFI**
- Click **"Approve"** to create the RFI in your project
- The AI-drafted content will be saved to your RFI records
- Click **"Reject"** if the draft needs revision

---

## Feature 3: Photo Analyzer (NEC Violation Detection)

**Purpose**: Upload photos of electrical installations and AI will detect NEC violations, identify equipment, and suggest fixes

### How to Access:
1. Open any project
2. Click **"Project Management"** → **"Site Visits"**
3. Click **"+ Log Site Visit"** button

### How to Use:

**Step 1: Fill Visit Details**
- **Title**: *"Pre-inspection panel review"*
- **Visit Type**: Choose from dropdown (Site Inspection, Progress Review, etc.)
- **Date/Time**: Select when the visit occurred
- **Description**: Brief notes about the visit

**Step 2: Upload Photos**
- Scroll to **"Photos & Documentation"** section
- Click the photo upload area (drag-and-drop zone)
- Select one or more photos from your computer
  - Supported formats: JPG, PNG, HEIC
  - Tip: Take clear, well-lit photos of panels, equipment, conduit runs
- Photos upload to Supabase Storage automatically

**Step 3: Analyze Photos with AI**
- After upload, you'll see a purple box appear:
  - **"AI Photo Analysis Available"**
  - Shows how many photos are ready for analysis
- Click **"Analyze with AI"** button
- Wait 10-20 seconds (Vision AI processes each photo)

**Step 4: View Analysis Results**
- Success message: *"Successfully analyzed 2 photos! Check the AI Copilot sidebar..."*
- **Open the AI Copilot sidebar** on the right
- You'll see a new suggestion card with:

  **Overall Severity Badge**:
  - 🔴 **Critical**: Immediate correction required
  - 🟠 **Warning**: Should be addressed
  - 🔵 **Info**: Informational only

  **NEC Violations Detected** (if any):
  - Click each violation to expand details
  - Shows:
    - Severity (Critical/Warning/Info)
    - NEC article violated (e.g., "NEC 408.36")
    - Description of violation
    - Location in photo (e.g., "Upper left corner, panel H1")
    - Recommendation for fix

  **Equipment Identified**:
  - Lists all equipment detected in photo
  - Shows: Type, Manufacturer, Model, Rating
  - **Condition badge**: Good / Fair / Poor

  **Suggested Actions**:
  - Checklist of immediate actions to take
  - Example: "Replace undersized breaker", "Add missing labels"

  **General Recommendations**:
  - Best practices based on what AI saw
  - NEC compliance tips

**Step 5: Approve or Reject**
- Click **"Approve"** to:
  - Create issues in your project for each violation
  - Log the analysis in project history
- Click **"Reject"** if AI misidentified something

---

## AI Copilot Sidebar

**Location**: Right side of screen (look for purple Sparkles icon)

**What It Does**:
- Shows all pending AI suggestions across all 3 agents
- Real-time updates (no page refresh needed)
- Sorted by priority (red badges = urgent)

**How to Use**:
1. Click the **Sparkles icon** to open/close sidebar
2. Each suggestion card shows:
   - Agent type icon (TrendingUp, MessageSquare, Camera, Shield)
   - Priority badge and confidence score
   - Title and description
   - Expandable specialized view (detailed analysis)
3. Click anywhere on the card to expand/collapse details
4. Use **"Approve"** or **"Reject"** buttons to take action

**Tips**:
- Keep sidebar open while working - new suggestions appear automatically
- High confidence scores (>80%) are usually very accurate
- Rejected suggestions are removed but logged for audit trail

---

## Troubleshooting

### "This feature encountered an error"
- **Cause**: Python backend not running
- **Fix**: Start backend server (see Prerequisites above)

### "Failed to analyze photos: Unknown error"
- **Cause**: Photo file format not supported or too large
- **Fix**: Use JPG/PNG files under 5MB, ensure photo is clear and well-lit

### AI Copilot sidebar is empty
- **Cause**: No pending suggestions yet
- **Expected**: Use one of the 3 AI features first to generate suggestions

### Change Impact Analyzer shows "Project ID not found"
- **Cause**: Routing issue (shouldn't happen after fix)
- **Fix**: Refresh the page and try again

---

## Best Practices

1. **Change Impact Analyzer**:
   - Be specific in change description
   - Include all new loads (don't forget lighting, receptacles)
   - Use for any change >20% of service capacity

2. **RFI Drafter**:
   - Provide context for better questions
   - Review AI draft before approving
   - AI is best for code-related questions (NEC references)

3. **Photo Analyzer**:
   - Take photos in good lighting
   - Get close-ups of panels, labels, connections
   - One photo per panel works best
   - Include context in site visit description

---

## Example Workflows

### Workflow 1: Adding EV Chargers
1. Go to Tools → Change Impact Analyzer
2. Enter: "Add 5x Level 2 EV chargers"
3. Add loads: EV Charger, 50A, Qty: 5
4. Analyze → Check sidebar
5. AI says: "Service upgrade to 600A required, $15k-$22k, +10 days"
6. Approve → Use recommendations to update project plan

### Workflow 2: Pre-Inspection Audit
1. Go to Site Visits → Log Site Visit
2. Title: "Final inspection prep - Panel H1"
3. Upload photos of panel interior
4. Click "Analyze with AI"
5. Sidebar shows: 2 violations detected (missing labels, wrong breaker size)
6. Approve → Creates issues to fix before inspector arrives

### Workflow 3: Code Question for Architect
1. Go to RFI Manager → Create RFI
2. Click "Draft with AI"
3. Topic: "GEC sizing for 400A service"
4. Context: "Drawing shows #4 Cu, but NEC 250.66 table requires #2 Cu"
5. Draft → Sidebar shows professional RFI with NEC references
6. Approve → RFI created and ready to send

---

## Technical Architecture

For developers and technical users, see the following documentation:
- `/docs/AI_AGENT_ARCHITECTURE.md` - Complete system architecture
- `/docs/PYDANTIC_AI_MIGRATION.md` - Backend implementation details
- `/.claude/plans/wild-booping-lerdorf.md` - Full implementation plan

---

**Ready to try the features?** Start with the Change Impact Analyzer - it's the easiest to test!
