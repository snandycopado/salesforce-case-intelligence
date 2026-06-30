# User Management - Resolution Guide

## CRITICAL: Object Distinction
- User accounts are stored in the **User** object (NOT Account object), identified by **email/username**
- To unlock a user: use the `unlock_user` tool with user's email
- To update user fields: use the `update_user_field` tool with user's email
- NEVER query or update the Account object for user login/password/lockout issues
- Account object is for company/organization records identified by **Employee_Id__c** — see Account Management Guide
- If the case mentions an Employee ID instead of an email/username, this is an Account Management case, not User Management

## User Lockout Resolution
1. Use `unlock_user` tool with the customer's email address
2. This automatically resets the password and sends reset email
3. Send confirmation email to customer
4. Close the case

## Password Reset Resolution
1. Use `unlock_user` tool with `reset_password: true`
2. Inform customer to check their email for reset link
3. Close the case

## User Deactivation
1. Use `update_user_field` tool with field `IsActive` = `false`
2. Add case comment documenting the deactivation reason
3. Close the case
