## ADDED Requirements

### Requirement: HR Admin registers employee
The system SHALL allow an authenticated HR Admin to create an employee record with full name, personal email, monthly payroll rate, and an optional supervisor (referencing another employee).

#### Scenario: Successful registration
- **WHEN** HR Admin submits valid employee details including a selected supervisor
- **THEN** an employee record is created, an Authentik account is provisioned, and the system displays a one-time success dialog to HR Admin showing the employee's personal email and generated password (mocked credential delivery for v0.1.0 — no real email is sent, per ADR-3)

#### Scenario: Duplicate personal email rejected
- **WHEN** HR Admin submits a personal email already used by another employee
- **THEN** the system rejects the registration with a clear error and creates no record

### Requirement: HR Admin edits employee payroll rate and supervisor
The system SHALL allow HR Admin to update an existing employee's monthly payroll rate and supervisor assignment.

#### Scenario: Successful edit
- **WHEN** HR Admin saves a changed payroll rate or supervisor for an existing employee
- **THEN** the change is persisted and used by subsequent leave/payroll calculations

### Requirement: Supervisor hierarchy is self-referencing
The system SHALL store an employee's supervisor as a reference to another employee record (self-referencing relationship), nullable for HR Admin.

#### Scenario: Supervisor is also an employee
- **WHEN** an employee record is created with a supervisor field pointing to another employee
- **THEN** the hierarchy link is stored and resolvable (e.g. via `GetSupervisorChain`)

### Requirement: Employee registration and edit are HR-Admin-only, enforced server-side
The system SHALL reject employee create/edit requests from any caller who is not HR Admin, independent of UI restrictions.

#### Scenario: Unauthenticated request rejected
- **WHEN** an unauthenticated request calls the employee create or edit endpoint
- **THEN** the system responds 401 and creates no record

#### Scenario: Non-HR-Admin authenticated request rejected
- **WHEN** an authenticated user who is not HR Admin calls the employee create or edit endpoint directly
- **THEN** the system responds 403 and creates no record

### Requirement: Employee PII is protected at rest and in error responses
The system SHALL encrypt employee PII (name, personal email, payroll rate) at rest and SHALL NOT leak PII or internal detail in error responses.

#### Scenario: Registration error does not leak detail
- **WHEN** employee registration fails for any reason
- **THEN** the error response contains no PII, stack trace, or internal implementation detail

### Requirement: Employee create/edit actions are audit logged
The system SHALL record an audit log entry (actor, timestamp, diff) for every employee create or edit action.

#### Scenario: Audit entry recorded on edit
- **WHEN** HR Admin edits an employee's payroll rate
- **THEN** an audit log entry recording the actor, timestamp, and changed field is created
