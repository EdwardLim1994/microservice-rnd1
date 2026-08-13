# Interaction Specification — hr-leave-payroll-platform

Behavioural spec only — no visual/layout/colour detail. One section per screen.

## Screen: Login (#KAN-3)
- Redirects to Authentik-hosted login form (email + password fields, submit button) — not custom-built.
- Feedback: invalid credentials → generic error message. Loading state while token exchange completes. Success → redirect to role-appropriate home.

## Screen: Employee List (#KAN-2) — HR Admin only
- Table listing employees: name, personal email, payroll rate, supervisor name.
- "Register Employee" button → navigates to Registration form.
- Row click → navigates to Edit form for that employee.
- Empty state: "No employees yet" + register CTA. Loading state: skeleton/spinner while list query runs.

## Screen: Registration Form (#KAN-2) — HR Admin only
- Fields: full name (text, required), personal email (email, required, format-validated), monthly payroll rate (number, required, > 0), supervisor (searchable select of existing employees, optional).
- Submit button: fires `registerEmployee` mutation.
- Feedback: inline field validation errors on blur; duplicate-email error surfaced on submit response; loading state on submit button while in flight; success → one-time modal dialog showing the employee's personal email + generated password (mocked credential delivery, ADR-3), dismissing the dialog navigates to Employee List.

## Screen: Edit Employee Form (#KAN-2) — HR Admin only
- Same fields as Registration minus password/email-send (payroll rate + supervisor editable; name/email read-only in v1 to avoid identity-mismatch with Authentik account).
- Submit fires `updateEmployee` mutation. Same feedback states as Registration.

## Screen: My Leave (#KAN-4) — Employee/Supervisor/HR Admin (own data)
- Leave balance summary: annual remaining/entitled, sick remaining/entitled.
- Leave history table: type, dates, days, status (pending/approved/rejected).
- "Request Leave" button → opens Leave Request form (modal or dedicated screen).
- Empty state: "No leave requests yet."

## Screen: Leave Request Form (#KAN-4)
- Fields: leave type (select: annual/sick/unpaid), start date (date picker), end date (date picker).
- On date range change: show computed day count and remaining-balance preview (client-side estimate; server is source of truth).
- Submit fires `submitLeaveRequest` mutation.
- Feedback: validation error if end date before start date; loading state on submit; success → close form, refresh My Leave list; server-side balance/authorization errors surfaced inline.

## Screen: Leave Approval Queue (#KAN-4) — Supervisor (own reports) / HR Admin (supervisors' requests)
- Table of pending requests: requester name, type, dates, days.
- Row actions: Approve / Reject buttons.
- Confirmation step before action fires (destructive-ish, avoid mis-click).
- Feedback: loading state per-row on action; success removes row from queue; error keeps row, shows inline error.
- Empty state: "No pending requests."

## Screen: My Payslips (#KAN-5) — every employee, own records only
- Table: year-month, net amount, generated date.
- Row click / download icon → fetches signed MinIO URL, opens/downloads PDF.
- Empty state: "No payslips generated yet."
- Loading state while signed URL is fetched.

## Component: Notification Icon + Dropdown (#KAN-6) — present on every screen, portal header
- Icon with unread-count badge (hidden when count is 0).
- Click → opens dropdown list: notification text, relative timestamp, read/unread visual state (behavioural: presence of state, not visual style).
- Click a notification item → marks read, navigates to the relevant screen (approval queue / my leave / my payslips per type).
- "Mark all as read" action.
- Empty state: "No notifications."
- Polling or subscription for new notifications while portal is open — behaviour choice deferred to Frontend Developer (Apollo Client polling is the simplest fit per `apollo-client-implementation`, no new dependency needed).
