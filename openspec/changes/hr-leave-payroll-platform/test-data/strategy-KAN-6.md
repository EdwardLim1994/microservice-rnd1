# Test Data Strategy — KAN-6 (In-App Notifications)

| Data state | Store | Source |
|---|---|---|
| `leave.requested` / `leave.reviewed` / `payroll.generated` events on Kafka | Kafka | published via KAN-4/KAN-5's real CDC pipeline in integration tests, not hand-crafted |
| Unread notification for current test user | PostgreSQL (`notification-infra`) | fixture: `notification-unread.sql` |
| Read notification (for read-state UI test) | PostgreSQL | fixture: `notification-read.sql` |
| Empty notification list (empty-state test) | PostgreSQL | fresh DB, no seed |
| Notification belonging to a different user (IDOR-negative test) | PostgreSQL | fixture: `notification-other-user.sql` |
