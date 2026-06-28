# Salesforce Setup Guide

## Step 1: Create Custom Fields on Case Object

Go to **Setup → Object Manager → Case → Fields & Relationships → New**

| Field Label | API Name | Type | Details |
|-------------|----------|------|---------|
| AI Resolution Notes | AI_Resolution_Notes__c | Rich Text Area | 32,768 characters |
| AI Confidence Score | AI_Confidence_Score__c | Number | Length: 3, Decimal: 2 |
| AI Recommended Action | AI_Recommended_Action__c | Text | Length: 255 |
| AI Resolution Status | AI_Resolution_Status__c | Picklist | Values below |

### AI Resolution Status Picklist Values:
- Pending
- Execute Resolution
- Partially Correct Resolution
- Incorrect Resolution

## Step 2: Add Remote Site Setting

Go to **Setup → Remote Site Settings → New**

| Field | Value |
|-------|-------|
| Remote Site Name | CaseIntelligenceAPI |
| Remote Site URL | https://salesforce-case-intelligence.onrender.com |
| Active | Checked |

## Step 3: Deploy Apex Code

### Option A: Developer Console
1. **Setup → Developer Console**
2. **File → New → Apex Class** → paste `CaseAIResolutionService.cls`
3. **File → New → Apex Trigger** → Name: `CaseAIResolutionTrigger`, sObject: `Case` → paste trigger code

### Option B: VS Code with Salesforce CLI
```bash
sf project deploy start --source-dir salesforce/
```

## Step 4: Add Fields to Page Layout

1. **Setup → Object Manager → Case → Page Layouts**
2. Edit your case layout
3. Drag these fields onto the layout:
   - AI Resolution Notes
   - AI Confidence Score
   - AI Recommended Action
   - AI Resolution Status
4. Save

## Step 5: Test

1. Create a new Case in Salesforce
2. Wait 30-60 seconds (API cold start may take time)
3. Refresh the Case — AI Resolution Notes should be populated
4. To execute: Change **AI Resolution Status** to "Execute Resolution"
5. To revise: Add a comment with feedback, then change status to "Partially Correct Resolution" or "Incorrect Resolution"

## How It Works

### New Case Created:
```
Case Insert → Trigger fires → @future callout to /resolve
→ AI analyzes case + RAG search → Resolution stored on Case
→ AI_Resolution_Status__c = "Pending"
```

### Agent Approves (Execute Resolution):
```
Agent sets AI_Resolution_Status__c = "Execute Resolution"
→ Trigger fires → @future callout to /agent-action {action: "execute"}
→ AI agent executes steps (send email, update records, close case)
```

### Agent Rejects (Partially Correct / Incorrect):
```
Agent adds comment with feedback
→ Sets AI_Resolution_Status__c = "Partially Correct Resolution" or "Incorrect Resolution"
→ Trigger fires → @future callout to /agent-action {action: "partially_correct" or "not_right"}
→ AI revises resolution → Updated notes stored on Case
→ AI_Resolution_Status__c reset to "Pending"
```
