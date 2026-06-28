/**
 * CaseAIResolutionTrigger
 *
 * Fires on:
 * 1. After Insert - Sends new case to AI for resolution proposal
 * 2. After Update - When agent changes AI_Resolution_Status__c:
 *    - "Execute Resolution" → Executes AI steps on Salesforce
 *    - "Partially Correct Resolution" → Revises resolution with feedback
 *    - "Incorrect Resolution" → Rethinks resolution entirely
 */
trigger CaseAIResolutionTrigger on Case (after insert, after update) {

    // After Insert: Get AI resolution for new cases
    if (Trigger.isInsert) {
        for (Case c : Trigger.new) {
            CaseAIResolutionService.getResolution(c.Id);
        }
    }

    // After Update: Handle agent actions on AI_Resolution_Status__c
    if (Trigger.isUpdate) {
        for (Case c : Trigger.new) {
            Case oldCase = Trigger.oldMap.get(c.Id);

            // Check if AI_Resolution_Status__c changed
            String newStatus = (String) c.get('AI_Resolution_Status__c');
            String oldStatus = (String) oldCase.get('AI_Resolution_Status__c');

            if (newStatus != null && newStatus != oldStatus) {

                if (newStatus == 'Execute Resolution') {
                    CaseAIResolutionService.executeResolution(c.Id);
                }
                else if (newStatus == 'Partially Correct Resolution') {
                    // Get agent comments from the most recent case comment
                    String comments = getLatestComment(c.Id);
                    CaseAIResolutionService.reviseResolution(c.Id, 'partially_correct', comments);
                }
                else if (newStatus == 'Incorrect Resolution') {
                    String comments = getLatestComment(c.Id);
                    CaseAIResolutionService.reviseResolution(c.Id, 'not_right', comments);
                }
            }
        }
    }

    /**
     * Gets the most recent case comment as agent feedback
     */
    private static String getLatestComment(Id caseId) {
        List<CaseComment> comments = [
            SELECT CommentBody
            FROM CaseComment
            WHERE ParentId = :caseId
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        if (!comments.isEmpty()) {
            return comments[0].CommentBody;
        }
        return 'No feedback provided';
    }
}
