/**
 * CaseAIResolutionService
 *
 * Handles all callouts to the AI Case Resolution API.
 * - On Case creation: calls /resolve to get AI resolution
 * - On Agent approval: calls /agent-action to execute resolution steps
 */
public class CaseAIResolutionService {

    // Update this to your deployed backend URL
    private static final String API_BASE_URL = 'https://salesforce-case-intelligence.onrender.com';

    /**
     * Called on Case insert - gets AI resolution proposal
     */
    @future(callout=true)
    public static void getResolution(Id caseId) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_BASE_URL + '/resolve');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(120000); // 2 min timeout for cold start
            req.setBody('{"case_id":"' + caseId + '"}');

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                Case c = new Case(Id = caseId);

                // Store resolution in custom fields
                String resolutionNotes = buildRichTextNotes(result);
                try {
                    c.put('AI_Resolution_Notes__c', resolutionNotes);
                    c.put('AI_Confidence_Score__c', result.get('confidence_score'));
                    c.put('AI_Recommended_Action__c', (String) result.get('recommended_action'));
                    c.put('AI_Resolution_Status__c', 'Pending');
                } catch (Exception e) {
                    // Custom fields may not exist - log as comment instead
                    CaseComment comment = new CaseComment();
                    comment.ParentId = caseId;
                    comment.CommentBody = '[AI Resolution]\n' + (String) result.get('resolution_notes');
                    comment.IsPublished = false;
                    insert comment;
                    return;
                }

                update c;
            } else {
                logError(caseId, 'Resolution API returned ' + res.getStatusCode() + ': ' + res.getBody());
            }
        } catch (Exception e) {
            logError(caseId, 'Resolution callout failed: ' + e.getMessage());
        }
    }

    /**
     * Called when agent changes AI_Resolution_Status__c to "Execute Resolution"
     */
    @future(callout=true)
    public static void executeResolution(Id caseId) {
        try {
            // First get the current resolution data from the case
            Case c = [
                SELECT Id, AI_Resolution_Notes__c, AI_Recommended_Action__c,
                       AI_Confidence_Score__c, Subject, Description, Type
                FROM Case
                WHERE Id = :caseId
                LIMIT 1
            ];

            // Build the previous resolution object for the API
            Map<String, Object> previousResolution = new Map<String, Object>();
            previousResolution.put('recommended_action', c.AI_Recommended_Action__c);
            previousResolution.put('resolution_notes', c.AI_Resolution_Notes__c != null ? c.AI_Resolution_Notes__c.stripHtmlTags() : '');
            previousResolution.put('issue_summary', c.Subject);
            previousResolution.put('confidence_score', c.AI_Confidence_Score__c);

            // Extract resolution steps from rich text notes
            List<String> steps = extractStepsFromNotes(c.AI_Resolution_Notes__c);
            previousResolution.put('resolution_steps', steps);
            previousResolution.put('customer_email_subject', 'Re: ' + c.Subject);
            previousResolution.put('customer_email_body', '');

            // Build request body
            Map<String, Object> body = new Map<String, Object>();
            body.put('case_id', caseId);
            body.put('action', 'execute');
            body.put('comments', '');
            body.put('previous_resolution', previousResolution);

            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_BASE_URL + '/agent-action');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(120000);
            req.setBody(JSON.serialize(body));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                Integer actionsTaken = (Integer) result.get('actions_taken');

                CaseComment comment = new CaseComment();
                comment.ParentId = caseId;
                comment.CommentBody = '[AI Agent] Execution completed. Actions taken: ' + actionsTaken;
                comment.IsPublished = false;
                insert comment;
            } else {
                logError(caseId, 'Execute API returned ' + res.getStatusCode() + ': ' + res.getBody());
            }
        } catch (Exception e) {
            logError(caseId, 'Execute callout failed: ' + e.getMessage());
        }
    }

    /**
     * Called when agent marks resolution as Partially Correct or Incorrect
     */
    @future(callout=true)
    public static void reviseResolution(Id caseId, String action, String comments) {
        try {
            Case c = [
                SELECT Id, AI_Resolution_Notes__c, AI_Recommended_Action__c,
                       AI_Confidence_Score__c, Subject, Description, Type
                FROM Case
                WHERE Id = :caseId
                LIMIT 1
            ];

            Map<String, Object> previousResolution = new Map<String, Object>();
            previousResolution.put('recommended_action', c.AI_Recommended_Action__c);
            previousResolution.put('resolution_notes', c.AI_Resolution_Notes__c != null ? c.AI_Resolution_Notes__c.stripHtmlTags() : '');
            previousResolution.put('issue_summary', c.Subject);
            previousResolution.put('confidence_score', c.AI_Confidence_Score__c);
            previousResolution.put('resolution_steps', extractStepsFromNotes(c.AI_Resolution_Notes__c));
            previousResolution.put('customer_email_subject', '');
            previousResolution.put('customer_email_body', '');

            Map<String, Object> body = new Map<String, Object>();
            body.put('case_id', caseId);
            body.put('action', action);
            body.put('comments', comments);
            body.put('previous_resolution', previousResolution);

            HttpRequest req = new HttpRequest();
            req.setEndpoint(API_BASE_URL + '/agent-action');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(120000);
            req.setBody(JSON.serialize(body));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                Map<String, Object> revised = (Map<String, Object>) result.get('resolution');

                if (revised != null) {
                    Case updateCase = new Case(Id = caseId);
                    try {
                        updateCase.put('AI_Resolution_Notes__c', buildRichTextNotes(revised));
                        updateCase.put('AI_Confidence_Score__c', revised.get('confidence_score'));
                        updateCase.put('AI_Recommended_Action__c', (String) revised.get('recommended_action'));
                        updateCase.put('AI_Resolution_Status__c', 'Pending');
                        update updateCase;
                    } catch (Exception e) {
                        logError(caseId, 'Failed to update revised resolution: ' + e.getMessage());
                    }
                }
            } else {
                logError(caseId, 'Revise API returned ' + res.getStatusCode() + ': ' + res.getBody());
            }
        } catch (Exception e) {
            logError(caseId, 'Revise callout failed: ' + e.getMessage());
        }
    }

    /**
     * Build rich text HTML from API response
     */
    private static String buildRichTextNotes(Map<String, Object> result) {
        String html = '<h2>AI Resolution Summary</h2>';
        html += '<p><b>Issue:</b> ' + String.valueOf(result.get('issue_summary')) + '</p>';
        html += '<p><b>Root Cause:</b> ' + String.valueOf(result.get('root_cause')) + '</p>';

        Object confScore = result.get('confidence_score');
        if (confScore != null) {
            Decimal score = Decimal.valueOf(String.valueOf(confScore)) * 100;
            html += '<p><b>Confidence:</b> ' + score.setScale(0) + '%</p>';
        }

        html += '<h3>Resolution Steps</h3><ol>';
        Object stepsObj = result.get('resolution_steps');
        if (stepsObj instanceof List<Object>) {
            for (Object step : (List<Object>) stepsObj) {
                html += '<li>' + String.valueOf(step) + '</li>';
            }
        }
        html += '</ol>';

        html += '<h3>Resolution Notes</h3>';
        html += '<p>' + String.valueOf(result.get('resolution_notes')) + '</p>';

        Object emailSubject = result.get('customer_email_subject');
        Object emailBody = result.get('customer_email_body');
        if (emailSubject != null) {
            html += '<h3>Customer Email</h3>';
            html += '<p><b>Subject:</b> ' + String.valueOf(emailSubject) + '</p>';
            html += '<p>' + String.valueOf(emailBody).replaceAll('\n', '<br/>') + '</p>';
        }

        return html;
    }

    /**
     * Extract resolution steps from rich text notes
     */
    private static List<String> extractStepsFromNotes(String richText) {
        List<String> steps = new List<String>();
        if (String.isBlank(richText)) return steps;

        String plainText = richText.stripHtmlTags();
        List<String> lines = plainText.split('\n');
        for (String line : lines) {
            line = line.trim();
            if (line.length() > 0 && (line.substring(0, 1).isNumeric() || line.startsWith('-'))) {
                String step = line.replaceFirst('^[0-9]+\\.\\s*', '').replaceFirst('^-\\s*', '');
                if (step.length() > 3) {
                    steps.add(step);
                }
            }
        }
        if (steps.isEmpty()) {
            steps.add(plainText.left(200));
        }
        return steps;
    }

    /**
     * Log errors as case comments
     */
    private static void logError(Id caseId, String message) {
        try {
            CaseComment comment = new CaseComment();
            comment.ParentId = caseId;
            comment.CommentBody = '[AI Error] ' + message;
            comment.IsPublished = false;
            insert comment;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Failed to log error: ' + e.getMessage());
        }
    }
}
