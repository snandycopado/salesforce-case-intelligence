# Account Management - Resolution Guide

## CRITICAL: Object Distinction Rules

| Case Type | Salesforce Object | Unique Identifier | Tools to Use |
|-----------|-------------------|--------------------|--------------|
| **User Management** | User | Email address (Username) | `unlock_user`, `update_user_field` |
| **Account Management** | Account | Employee_Id__c | `update_account_field`, `query_account_by_employee_id` |

## How to Identify the Case Type

**This is an Account Management request if:**
- The case mentions an **Employee ID** (e.g., "EMP1234", "Employee Id: 5567")
- The request is about company/organization-level data: company name, billing address, industry, revenue, phone
- The customer refers to "my account details" or "company record" rather than "my login"

**This is a User Management request if:**
- The case mentions a **username or email** for login purposes
- The request is about login, password, lockout, or user-level access
- The customer refers to "I can't log in" or "reset my password"

## NEVER mix the two objects:
- Do NOT use Employee ID to query the User object
- Do NOT use email/username to query the Account object for Account Management cases
- Account Management always uses `Employee_Id__c` as the lookup key on the **Account** object

## Account Management Resolution Steps

1. Use `query_account_by_employee_id` with the Employee ID from the case to verify the account exists
2. Identify which field(s) the customer wants updated (e.g., Phone, BillingStreet, Industry, AnnualRevenue, Name)
3. Use `update_account_field` with the Employee ID, field name, and new value
4. Add a case comment confirming the update
5. Send confirmation email to the customer
6. Close the case

## Common Account Fields
- `Name` — Account/Company Name
- `Phone` — Main phone number
- `BillingStreet`, `BillingCity`, `BillingState`, `BillingPostalCode` — Billing address
- `Industry` — Industry classification
- `AnnualRevenue` — Annual revenue
- `Employee_Id__c` — Unique employee identifier (lookup key, do not change unless explicitly requested)
