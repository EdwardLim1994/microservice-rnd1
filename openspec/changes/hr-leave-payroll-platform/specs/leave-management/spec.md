## ADDED Requirements

### Requirement: Employee submits leave request
The system SHALL allow an authenticated employee to submit a leave request specifying type (annual, sick, or unpaid), start date, and end date.

#### Scenario: Successful submission
- **WHEN** an employee submits a leave request with a valid type and date range
- **THEN** the request is created with status pending and routed to the correct reviewer

### Requirement: Leave routes to supervisor, except a supervisor's own leave routes to HR Admin
The system SHALL route a leave request to the requester's supervisor for review, unless the requester is themselves a supervisor, in which case the request SHALL route to HR Admin.

#### Scenario: Employee's request routes to their supervisor
- **WHEN** a non-supervisor employee submits a leave request
- **THEN** the request appears in their supervisor's approval queue, not HR Admin's

#### Scenario: Supervisor's own request routes to HR Admin
- **WHEN** an employee who is also a supervisor submits their own leave request
- **THEN** the request appears in HR Admin's approval queue, not their own supervisor's (if any) or their own

### Requirement: Reviewer approves or rejects a leave request
The system SHALL allow the correctly-routed reviewer to approve or reject a pending leave request.

#### Scenario: Approval deducts balance
- **WHEN** the correct reviewer approves a leave request
- **THEN** the request status becomes approved and the corresponding leave balance is deducted

#### Scenario: Rejection leaves balance unchanged
- **WHEN** the correct reviewer rejects a leave request
- **THEN** the request status becomes rejected and no balance is deducted

### Requirement: Self-approval and out-of-hierarchy approval are blocked
The system SHALL reject any attempt by an employee to approve/reject their own leave request, and any attempt by a supervisor to approve/reject a request from someone who is not their direct report.

#### Scenario: Self-approval blocked
- **WHEN** an employee attempts to approve or reject their own leave request
- **THEN** the system responds 403 and the request status is unchanged

#### Scenario: Out-of-hierarchy approval blocked
- **WHEN** a supervisor attempts to approve or reject a leave request from an employee who is not their direct report
- **THEN** the system responds 403 and the request status is unchanged

### Requirement: Leave balance tracked per type with fixed entitlement
The system SHALL track each employee's remaining balance for annual and sick leave against a fixed entitlement, and SHALL surface the remaining balance when a request is submitted.

#### Scenario: Balance displayed on submission
- **WHEN** an employee submits a leave request
- **THEN** their remaining balance for that leave type is checked and returned to the caller

### Requirement: Leave beyond entitlement converts to unpaid
The system SHALL record any approved leave days beyond an employee's remaining annual/sick entitlement as unpaid leave.

#### Scenario: Excess days become unpaid
- **WHEN** an approved leave request's days exceed the employee's remaining balance for that type
- **THEN** the excess days are recorded as unpaid leave, feeding the payroll deduction calculation

### Requirement: Leave request inputs are validated server-side
The system SHALL validate leave request dates and days server-side, rejecting negative day counts and malformed date ranges regardless of client-side validation.

#### Scenario: Invalid date range rejected
- **WHEN** a leave request is submitted with an end date before the start date
- **THEN** the system rejects the request with a validation error
