## ADDED Requirements

### Requirement: Users see leave and payroll notifications in-app
The system SHALL show every logged-in user an in-app notification for: a new leave request awaiting their review (reviewer), a decision on their own leave request (requester), and a successfully generated payroll record (employee).

#### Scenario: Supervisor notified of new leave request
- **WHEN** an employee submits a leave request routed to a given supervisor
- **THEN** that supervisor sees a "new leave request" notification

#### Scenario: Employee notified of leave decision
- **WHEN** a leave request is approved or rejected
- **THEN** the requesting employee sees a decision notification

#### Scenario: Employee notified of payroll generation
- **WHEN** monthly payroll is generated successfully for an employee
- **THEN** that employee sees a "payroll generated" notification

### Requirement: Notifications are derived from Kafka CDC events, not synchronous calls
The system SHALL populate notifications by consuming Debezium CDC events published from the `leave` and `payroll` services' Kafka topics.

#### Scenario: Notification created from CDC event
- **WHEN** a `leave_request` or `payroll_record` row change is captured by Debezium and published to Kafka
- **THEN** the notification service consumes the event and creates a notification record for the correct recipient

### Requirement: A user can only see their own notifications
The system SHALL return only the requesting user's own notifications, never another user's.

#### Scenario: Cross-user access denied
- **WHEN** a user requests their notification list
- **THEN** only notifications where they are the recipient are returned
