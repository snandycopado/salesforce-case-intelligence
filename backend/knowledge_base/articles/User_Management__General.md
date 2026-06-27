# Salesforce Login Failures – Account Locked, Deactivated, or Invalid Credentials

## Case References
00001052, 00001056, 00001057

## Problem Statement
Users are unable to log in to Salesforce due to one or more of the following conditions: their account has been deactivated, their account has been locked after multiple failed login attempts, or their username/email address on record is incorrect — preventing password reset emails from being delivered. In some cases, users are unexpectedly redirected to the Okta login screen instead of gaining access.

## Symptoms
- User is redirected to the Okta login screen and cannot proceed into Salesforce
- User receives an "Invalid username and password" error message
- User account is locked after multiple incorrect login attempts
- Password reset emails are not received by the user
- User is unable to authenticate despite entering what they believe are correct credentials

## Root Cause
Three distinct root causes have been identified across these cases:

1. **Deactivated User Account** — The user's Salesforce account was deactivated, causing authentication to fail and redirecting the user to the Okta SSO screen without granting access.
2. **Account Lockout** — Salesforce automatically locks a user account after a threshold number of consecutive failed login attempts, preventing further access until an administrator unlocks it.
3. **Incorrect Email Address on User Record** — The email address stored on the user's Salesforce profile does not match the user's actual email address, causing password reset emails to be delivered to the wrong address or not received at all.

---

## Resolution Steps

> **Instructions for AI Agent:** Execute the steps below in sequence. Each step may depend on the outcome of a prior step. Do not skip diagnostic checks. Always send a resolution confirmation email to the customer as the final step.

---

**Step 1 — Retrieve and Inspect the User Record**
- Using the MCP tool, look up the Salesforce User record associated with the reported username or email address provided by the customer.
- Check and note the following fields:
  - `IsActive` (Active/Inactive status)
  - `IsLocked` (Account locked status)
  - `Email` (Email address on record)
  - `Username`
  - `FederationIdentifier` (if Okta/SSO is in use)

---

**Step 2 — Resolve: Deactivated Account**
- If `IsActive = False`:
  - Using the MCP tool, update the User record: set `IsActive = True` to reactivate the account.
  - Log the action taken.
- If `IsActive = True`, skip this step and proceed to Step 3.

---

**Step 3 — Resolve: Locked Account**
- If `IsLocked = True`:
  - Using the MCP tool, update the User record: unlock the account by clearing the locked status (set `IsLocked = False` or use the "Unlock" action on the User record as supported by the MCP tool).
  - Log the action taken.
- If `IsLocked = False`, skip this step and proceed to Step 4.

---

**Step 4 — Resolve: Incorrect Email Address on User Record**
- Compare the email address stored in the `Email` field of the User record against the email address reported by the customer.
- If the email address **does not match**:
  - Using the MCP tool, update the `Email` field on the User record to the correct email address provided by the customer.
  - Notify the customer that an **email address change confirmation** will be sent to their new email address and that they **must accept/confirm this change** before a password reset link can be successfully delivered.
  - Wait for customer confirmation of the email change before proceeding to Step 5.
- If the email address **matches**, proceed directly to Step 5.

---

**Step 5 — Invoke Okta Sync (If SSO/Okta Redirect Issue Is Present)**
- If the customer reported being redirected to the Okta login screen and is still unable to authenticate after Steps 2–4:
  - Invoke the Okta Integration to re-sync the user's data (trigger Okta user sync/push for the affected user).
  - Verify that the user's `FederationIdentifier` in Salesforce matches the user's Okta profile identifier.
  - Log the sync action taken.
- If the customer did not report an Okta redirect issue, skip this step.

---

**Step 6 — Reset User Password**
- Once the account is confirmed as active, unlocked, and the email address is verified and confirmed:
  - Using the MCP tool, trigger a **password reset** for the user (send a password reset email to the verified email address on record).
  - Log the action taken.

---

**Step 7 — Send Resolution Email to Customer**
- Send the Resolution Email (template below) to the customer confirming the actions taken and providing next steps.

---

## Troubleshooting Guide

If the customer still cannot log in after all resolution steps have been completed:

- **Verify Username Format:** Confirm the username follows the correct Salesforce format (typically an email-style username, e.g., `user@company.com.prod`). Note that the Salesforce **username** and **email address** are separate fields and may differ.
- **Check Profile & Permission Set:** Confirm the user's Profile is active and not restricted from login hours or IP ranges that could block access.
- **Check Login IP Restrictions:** Review the user's Profile for trusted IP range restrictions that may be blocking the login attempt from the user's current network.
- **Check Okta Assignment:** If SSO is in use, confirm the user is assigned to the Salesforce application within the Okta admin console. Unassigned users cannot authenticate via Okta.
- **Re-verify FederationIdentifier:** Confirm the `FederationIdentifier` on the Salesforce User record exactly matches the user's login name/identifier in Okta (case-sensitive).
- **Check for Duplicate User Records:** Search for duplicate active User records with the same or similar email/username that could be causing a conflict.
- **Escalate if Unresolved:** If the issue persists after all above steps, escalate to a Senior Salesforce Administrator for further investigation.

---

### Resolution Email

**Subject:** Your Salesforce Account Has Been Restored – Action May Be Required

---

Hi [Customer First Name],

Thank you for reaching out to us. We have reviewed your Salesforce account and have completed the following actions to restore your access:

- ✅ **Account Reactivated** *(if applicable)* — Your account had been deactivated. It has now been reactivated.
- ✅ **Account Unlocked** *(if applicable)* — Your account was locked due to multiple failed login attempts. It has now been unlocked.
- ✅ **Email Address Updated** *(if applicable)* — The email address on your account has been updated to your correct email. Please check your inbox for a **confirmation email** and click the link to confirm this change before proceeding.
- ✅ **Password Reset Link Sent** — A password reset link has been sent to your registered email address. Please check your inbox (and your spam/junk folder) and follow the instructions to set a new password.

**Next Steps:**
1. If you received an email address confirmation email, please accept/confirm the change first.
2. Open the password reset email and click the reset link.
3. Set a new secure password and log in to Salesforce.

If you continue to experience any issues, please do not hesitate to contact us and we will be happy to assist further.

Kind regards,
[Agent Name]
Salesforce Support Team

---

### Follow-up Email

**Subject:** Following Up – Were You Able to Access Your Salesforce Account?

---

Hi [Customer First Name],

We wanted to follow up on your recent support request regarding your Salesforce login issue (Case #[Case Number]).

Could you please confirm whether you were able to successfully log in to Salesforce after the changes we made? Your feedback helps us ensure the issue has been fully resolved.

If you are still experiencing any difficulties, please reply to this email or call us and we will prioritize getting this resolved for you right away.

Thank you for your patience and we look forward to hearing from you.

Kind regards,
[Agent Name]
Salesforce Support Team

---

## Metadata
- **Average Resolution Time:** Unable to calculate — all 3 cases show no closed date (Status: Escalated, Closed: None). Resolution time data is unavailable from current case records.
- **Priority Distribution:** High — 3 of 3 cases (100%)
- **Common Origin:** Phone — 3 of 3 cases (100%)