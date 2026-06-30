"""
MCP Tools — Salesforce actions that the AI agent can execute.
Each tool is a function the multi-agent executor can call to perform
real actions on Salesforce: send emails, update records, add comments, etc.
"""

import structlog
from salesforce_client import SalesforceClient

log = structlog.get_logger()

TOOL_DEFINITIONS = [
    {
        "name": "send_email",
        "description": "Send an email to a customer or internal team member from a Salesforce Case. Use this to send resolution emails, follow-ups, or escalation notifications.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Salesforce Case ID"},
                "to_address": {"type": "string", "description": "Recipient email address"},
                "subject": {"type": "string", "description": "Email subject line"},
                "body": {"type": "string", "description": "Email body text"},
            },
            "required": ["case_id", "to_address", "subject", "body"],
        },
    },
    {
        "name": "update_case_field",
        "description": "Update a field on the Salesforce Case record. Use this to change status, priority, owner, or any custom field.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Salesforce Case ID"},
                "field_name": {"type": "string", "description": "API name of the field to update (e.g., Status, Priority, OwnerId)"},
                "field_value": {"type": "string", "description": "New value for the field"},
            },
            "required": ["case_id", "field_name", "field_value"],
        },
    },
    {
        "name": "add_case_comment",
        "description": "Add an internal comment to the Salesforce Case. Use this to log actions taken, notes for the agent, or resolution details.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Salesforce Case ID"},
                "comment": {"type": "string", "description": "Comment text to add"},
                "is_public": {"type": "boolean", "description": "Whether the comment is visible to the customer (default false)"},
            },
            "required": ["case_id", "comment"],
        },
    },
    {
        "name": "close_case",
        "description": "Close the Salesforce Case with a resolution summary. Use this as the final step after all resolution actions are complete.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Salesforce Case ID"},
                "resolution_summary": {"type": "string", "description": "Summary of how the case was resolved"},
            },
            "required": ["case_id", "resolution_summary"],
        },
    },
    {
        "name": "query_salesforce",
        "description": "Run a SOQL query against Salesforce to retrieve data. Use this to look up related records, account details, transaction history, or any other data needed for resolution.",
        "input_schema": {
            "type": "object",
            "properties": {
                "soql": {"type": "string", "description": "SOQL query to execute"},
            },
            "required": ["soql"],
        },
    },
    {
        "name": "unlock_user",
        "description": "Unlock a Salesforce User account and optionally trigger a password reset. Use this when a user/customer is locked out. This queries the User object (NOT Account), finds the user by email, and unlocks them.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "Email address of the locked user"},
                "reset_password": {"type": "boolean", "description": "Whether to also trigger a password reset email (default true)"},
            },
            "required": ["email"],
        },
    },
    {
        "name": "update_user_field",
        "description": "Update a field on a Salesforce User record. Lookup is by email. Use this for user-level changes (NOT Account object). Common fields: IsActive, UserPermissionsMarketingUser, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "email": {"type": "string", "description": "Email address of the user to update"},
                "field_name": {"type": "string", "description": "API name of the User field to update"},
                "field_value": {"type": "string", "description": "New value for the field"},
            },
            "required": ["email", "field_name", "field_value"],
        },
    },
    {
        "name": "update_account_field",
        "description": "Update a field on a Salesforce Account record. Lookup is ALWAYS by Employee_Id__c (NOT by name or email). Use this for Account Management requests — these are identified by an Employee ID, not a username. Common fields: Name, Phone, BillingStreet, Industry, AnnualRevenue, or any custom Account field. NEVER use this for User login/lockout issues — those belong to the User object via unlock_user/update_user_field.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string", "description": "Value of Employee_Id__c on the Account record"},
                "field_name": {"type": "string", "description": "API name of the Account field to update"},
                "field_value": {"type": "string", "description": "New value for the field"},
            },
            "required": ["employee_id", "field_name", "field_value"],
        },
    },
    {
        "name": "query_account_by_employee_id",
        "description": "Look up an Account record by Employee_Id__c and return its details. Use this to verify the account exists or to read current field values before updating, for Account Management requests.",
        "input_schema": {
            "type": "object",
            "properties": {
                "employee_id": {"type": "string", "description": "Value of Employee_Id__c on the Account record"},
            },
            "required": ["employee_id"],
        },
    },
    {
        "name": "reassign_case",
        "description": "Reassign the case to a different owner (user or queue). Use this when the case needs to be routed to another team.",
        "input_schema": {
            "type": "object",
            "properties": {
                "case_id": {"type": "string", "description": "Salesforce Case ID"},
                "owner_name": {"type": "string", "description": "Name of the user or queue to assign to"},
            },
            "required": ["case_id", "owner_name"],
        },
    },
]


class MCPToolExecutor:
    def __init__(self, sf_client: SalesforceClient):
        self.sf = sf_client

    def execute_tool(self, tool_name: str, tool_input: dict) -> str:
        handler = getattr(self, f"_tool_{tool_name}", None)
        if not handler:
            return f"Error: Unknown tool '{tool_name}'"
        try:
            result = handler(**tool_input)
            log.info("tool_executed", tool=tool_name, status="success")
            return result
        except Exception as e:
            log.error("tool_execution_failed", tool=tool_name, error=str(e))
            return f"Error executing {tool_name}: {e}"

    def _tool_send_email(self, case_id: str, to_address: str, subject: str, body: str) -> str:
        try:
            self.sf.sf.restful(
                "sobjects/EmailMessage",
                method="POST",
                json={
                    "ParentId": case_id,
                    "ToAddress": to_address,
                    "Subject": subject,
                    "TextBody": body,
                    "Status": "5",  # Sent
                },
            )
            return f"Email sent to {to_address} with subject: {subject}"
        except Exception:
            self.sf.sf.CaseComment.create({
                "ParentId": case_id,
                "CommentBody": f"[AI Agent - Email Draft]\nTo: {to_address}\nSubject: {subject}\n\n{body}",
                "IsPublished": False,
            })
            return f"Email could not be sent directly. Draft saved as case comment for manual sending to {to_address}."

    def _tool_update_case_field(self, case_id: str, field_name: str, field_value: str) -> str:
        self.sf.update_case(case_id, {field_name: field_value})
        return f"Case field '{field_name}' updated to '{field_value}'"

    def _tool_add_case_comment(self, case_id: str, comment: str, is_public: bool = False) -> str:
        self.sf.sf.CaseComment.create({
            "ParentId": case_id,
            "CommentBody": comment,
            "IsPublished": is_public,
        })
        return f"Comment added to case (public={is_public})"

    def _tool_close_case(self, case_id: str, resolution_summary: str) -> str:
        self.sf.update_case(case_id, {
            "Status": "Closed",
        })
        try:
            self.sf.update_case(case_id, {
                "Resolution_Summary__c": resolution_summary,
            })
        except Exception:
            pass
        self.sf.sf.CaseComment.create({
            "ParentId": case_id,
            "CommentBody": f"[AI Agent - Case Closed]\n{resolution_summary}",
            "IsPublished": False,
        })
        return f"Case closed with resolution: {resolution_summary[:100]}..."

    def _tool_query_salesforce(self, soql: str) -> str:
        import json
        records = self.sf.query(soql)
        if not records:
            return "No records found."
        cleaned = []
        for r in records[:20]:
            row = {k: v for k, v in r.items() if k != "attributes"}
            cleaned.append(row)
        return json.dumps(cleaned, indent=2, default=str)

    def _tool_reassign_case(self, case_id: str, owner_name: str) -> str:
        users = self.sf.query(
            f"SELECT Id, Name FROM User WHERE Name = '{owner_name}' AND IsActive = true LIMIT 1"
        )
        if not users:
            queues = self.sf.query(
                f"SELECT Id, Name FROM Group WHERE Name = '{owner_name}' AND Type = 'Queue' LIMIT 1"
            )
            if not queues:
                return f"Could not find user or queue named '{owner_name}'"
            owner_id = queues[0]["Id"]
        else:
            owner_id = users[0]["Id"]

        self.sf.update_case(case_id, {"OwnerId": owner_id})
        return f"Case reassigned to {owner_name}"

    def _tool_unlock_user(self, email: str, reset_password: bool = True) -> str:
        users = self.sf.query(
            f"SELECT Id, Name, IsActive, Username FROM User WHERE Email = '{email}' LIMIT 1"
        )

        if not users:
            # Fallback: email may belong to a Contact whose linked User has a different email/username
            contacts = self.sf.query(
                f"SELECT Id, Name FROM Contact WHERE Email = '{email}' LIMIT 1"
            )
            if contacts:
                contact_id = contacts[0]["Id"]
                users = self.sf.query(
                    f"SELECT Id, Name, IsActive, Username FROM User "
                    f"WHERE ContactId = '{contact_id}' LIMIT 1"
                )

        if not users:
            return (
                f"Error: No User record found for '{email}' (checked User.Email and "
                f"Contact->User.ContactId). This contact may not have a portal/community "
                f"user account. Do not claim the account was unlocked."
            )

        user = users[0]
        user_id = user["Id"]
        user_name = user.get("Name", email)

        # Unlock by resetting login lockout
        try:
            self.sf.sf.User.update(user_id, {"IsActive": True})
        except Exception:
            pass

        # Reset password if requested
        if reset_password:
            try:
                self.sf.sf.restful(
                    f"sobjects/User/{user_id}/password",
                    method="DELETE",
                )
                return f"User '{user_name}' unlocked and password reset email sent"
            except Exception as e:
                return f"User '{user_name}' unlocked but password reset failed: {e}"

        return f"User '{user_name}' unlocked successfully"

    def _tool_update_user_field(self, email: str, field_name: str, field_value: str) -> str:
        users = self.sf.query(
            f"SELECT Id, Name FROM User WHERE Email = '{email}' LIMIT 1"
        )
        if not users:
            return f"Error: No User found with email '{email}'"

        user_id = users[0]["Id"]
        self.sf.sf.User.update(user_id, {field_name: field_value})
        return f"User field '{field_name}' updated to '{field_value}' for {users[0].get('Name', email)}"

    def _tool_query_account_by_employee_id(self, employee_id: str) -> str:
        import json
        accounts = self.sf.query(
            f"SELECT Id, Name, Employee_Id__c, Phone, BillingStreet, BillingCity, "
            f"BillingState, BillingPostalCode, Industry, AnnualRevenue "
            f"FROM Account WHERE Employee_Id__c = '{employee_id}' LIMIT 1"
        )
        if not accounts:
            return f"Error: No Account found with Employee_Id__c = '{employee_id}'"

        account = {k: v for k, v in accounts[0].items() if k != "attributes"}
        return json.dumps(account, indent=2, default=str)

    def _tool_update_account_field(self, employee_id: str, field_name: str, field_value: str) -> str:
        accounts = self.sf.query(
            f"SELECT Id, Name FROM Account WHERE Employee_Id__c = '{employee_id}' LIMIT 1"
        )
        if not accounts:
            return f"Error: No Account found with Employee_Id__c = '{employee_id}'"

        account_id = accounts[0]["Id"]
        self.sf.sf.Account.update(account_id, {field_name: field_value})
        return f"Account field '{field_name}' updated to '{field_value}' for account '{accounts[0].get('Name', employee_id)}' (Employee ID: {employee_id})"
