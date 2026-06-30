# Account Management – Account Unlock and Account Plan Update Requests

## Case References
00001061, 00001064

## Problem Statement
Customers contact support for two distinct Account Management scenarios:
1. **Account Unlock (User Login Issues):** A customer is unable to log in and requests their account to be unlocked. The automated unlock process may fail if the provided email address does not match any existing Salesforce User record, requiring manual investigation.
2. **Account Plan Upgrade:** A customer requests an upgrade to their account plan (e.g., to "Gold") by providing their Employee ID. The plan field on the Account object must be updated and the customer notified upon completion.

---

## Symptoms

**Account Unlock (User Login Issue):**
- Customer reports being unable to log in to their account
- Customer provides an email address/username and requests an account unlock
- Automated unlock fails with error: *"No User found with email '[email/username]' in User object"*
- No Salesforce User record is found matching the provided email address

**Account Plan Upgrade:**
- Customer provides their Employee ID and requests a specific plan tier change (e.g., Gold, Silver, Platinum)
- Account plan field (`Plan__c`) has not yet been updated to the requested tier
- Customer expects a confirmation email once the change is made

---

## Root Cause

| Scenario | Root Cause |
|---|---|
| **Account Unlock Failure** | The email address provided by the customer does not match any existing record in the Salesforce **User** object. The user may have registered under a different email, or the record may not exist. |
| **Account Plan Upgrade** | The customer's account plan tier (`Plan__c`) on the Salesforce **Account** object has not been updated to reflect the newly requested plan. This requires a direct field update using the customer's `Employee_Id__c` as the lookup key. |

> ⚠️ **Critical Object Distinction:** User login/lockout issues operate on the **User object** (looked up by email/username). Account plan and company-level changes operate on the **Account object** (looked up by `Employee_Id__c`). Never mix these two objects.

---

## Resolution Steps

### Scenario 1 — Account Unlock (User Cannot Log In)

> **Trigger Condition:** Customer provides an email address/username and states they cannot log in or their account is locked.

1. **Identify the user's email address** from the case description or incoming email. This is the unique identifier for the Salesforce **User** object.

2. **Attempt to unlock the user account** using the `unlock_user` MCP tool with the customer's email address:
   - Tool: `unlock_user`
   - Parameter: `email = <customer-provided email address>`
   - This tool automatically resets the password and triggers a password reset email to the customer.

3. **If `unlock_user` succeeds:**
   - Proceed to Step 5 (Send Resolution Email).

4. **If `unlock_user` fails** (e.g., error: *"No User found with email '[address]'"*):
   - Do **not** attempt to query or update the Account object — this is a User object issue.
   - Add an internal case comment flagging the failure and noting that no matching User record was found.
   - **Escalate to a human agent** for manual investigation:
     - Verify the correct email address with the customer.
     - Search the User object in Salesforce for a close match (typo, alternate email).
     - Once the correct email is confirmed, re-run `unlock_user` with the corrected address.
   - Do **not** close the case until the unlock has been successfully completed or the case has been formally escalated.

5. **Send Resolution Email** to the customer using the template in the [Resolution Email](#resolution-email-scenario-1--account-unlocked) section below.

6. **Close the case** with a resolution comment:
   > *"User account [email] was successfully unlocked. Password reset email sent to customer. Case resolved."*

---

### Scenario 2 — Account Plan Upgrade

> **Trigger Condition:** Customer provides an Employee ID and requests a change to their account plan (e.g., "Update my plan to Gold").

1. **Identify the Employee ID** from the case description. This is the unique lookup key (`Employee_Id__c`) for the Salesforce **Account** object.

2. **Query the Account record** using the `query_account_by_employee_id` MCP tool to verify the account exists:
   - Tool: `query_account_by_employee_id`
   - Parameter: `employee_id = <customer-provided Employee ID>`
   - Confirm the returned Account Name and Account ID match the expected customer record before proceeding.

3. **If no Account record is found:**
   - Add an internal case comment noting the failure.
   - Escalate to a human agent to verify the Employee ID with the customer and re-attempt the query.
   - Do **not** close the case until the account has been located and updated.

4. **Update the account plan field** using the `update_account_field` MCP tool:
   - Tool: `update_account_field`
   - Parameters:
     - `employee_id = <Employee ID>`
     - `field = Plan__c`
     - `value = <requested plan tier>` (e.g., `Gold`, `Silver`, `Platinum`)

5. **Add an internal case comment** confirming the update:
   > *"Account plan successfully updated to [Plan Tier] for Employee ID [ID] (Account: '[Account Name]', Account ID: [Account ID]). Field Plan__c set to '[Plan Tier]'."*

6. **Send Resolution Email** to the customer using the template in the [Resolution Email](#resolution-email-scenario-2--account-plan-updated) section below.

7. **Close the case** with a resolution comment:
   > *"Account plan for Employee ID [ID] ('[Account Name]') successfully updated to [Plan Tier]. Confirmation email sent to customer. Case resolved."*

---

## Troubleshooting Guide

### Scenario 1 — Account Unlock Failures

| Symptom | Diagnostic Action |
|---|---|
| `unlock_user` returns "No User found" | Search the User object using partial email match or name to find alternate records |
| Customer insists the email is correct but no record exists | Verify whether the customer has ever registered; check for deactivated or deleted User records |
| Multiple User records found with similar emails | Confirm with the customer which account they use; unlock only the confirmed record |
| Unlock succeeds but customer still cannot log in | Check if the user's `IsActive` field is `false`; if so, use `update_user_field` to set `IsActive = true` before retrying |
| Customer does not receive password reset email | Confirm the correct email address; check spam/junk folders; manually trigger a password reset if needed |

### Scenario 2 — Account Plan Update Failures

| Symptom | Diagnostic Action |
|---|---|
| `query_account_by_employee_id` returns no results | Verify the Employee ID with the customer; check for typos or leading/trailing spaces |
| `update_account_field` fails for `Plan__c` | Verify that `Plan__c` is a valid, active field in the org; check field-level security and picklist values |
| Customer requests a plan tier not in the picklist | Escalate to a human agent; do not set an unsupported picklist value |
| Confirmation email fails to send automatically | Save the drafted email as a case comment and flag for a human agent to manually send the confirmation to the customer |

---

## Resolution Email

### Resolution Email — Scenario 1 — Account Unlocked

```
Subject: Your Account Has Been Unlocked

Dear [Customer Name],

Great news! Your account associated with [customer email address] has been 
successfully unlocked.

You should receive a separate email shortly with instructions to reset your 
password. Please check your inbox (and spam/junk folder) for that message.

Once you have reset your password, you will be able to log in as normal. 
If you continue to experience any issues accessing your account, please do 
not hesitate to contact us and we will be happy to assist.

Thank you for your patience.

Best regards,
Customer Support Team
```

---

### Resolution Email — Scenario 2 — Account Plan Updated

```
Subject: Your Account Plan Has Been Updated to [Plan Tier]

Dear [Customer Name],

Great news! Your account plan has been successfully updated as requested.

Here is a summary of the change made:
  - Account:        [Account Name]
  - Employee ID:    [Employee ID]
  - Plan Updated To: [Plan Tier]

Your [Plan Tier] plan benefits are now active. If you have any questions 
about your new plan or need further assistance, please do not hesitate to 
reach out.

Thank you for being a valued customer!

Best regards,
Customer Support Team
```

---

### Follow-up Email — Scenario 1 — If Unlock Could Not Be Completed (Escalation)

```
Subject: Follow-Up: Account Unlock Request – Action Required

Dear [Customer Name],

Thank you for contacting support regarding your account access.

We were unable to locate an account matching the email address you 
provided: [customer-provided email]. To complete the unlock, we need 
to verify a few details with you.

Could you please confirm:
  1. The exact email address associated with your account
  2. Any alternate email addresses you may have used during registration

Once we have confirmed the correct details, we will process your unlock 
request as quickly as possible.

We apologize for any inconvenience and appreciate your patience.

Best regards,
Customer Support Team
```

---

## Metadata

| Field | Value |
|---|---|
| **Average Resolution Time** | Scenario 1 (Account Unlock): Unresolved at automated stage — requires manual follow-up (indeterminate). Scenario 2 (Plan Upgrade): Approximately 3–4 minutes (fully automated). |
| **Priority Distribution** | Medium (100% of cases — both cases logged as Medium priority) |
| **Common Origin** | Phone (Case 00001061), Web (Case 00001064) — mixed origin; support channel is case-dependent |
| **Automation Success Rate** | Scenario 1: 0% automated resolution (manual escalation required due to User record mismatch). Scenario 2: 100% automated resolution (all 5 actions completed successfully). |
| **Key Risk Flag** | Scenario 1: Automated closure without confirmed resolution — cases should remain open until unlock is verified. Email delivery failures in Scenario 2 require human agent follow-up to send confirmation manually. |