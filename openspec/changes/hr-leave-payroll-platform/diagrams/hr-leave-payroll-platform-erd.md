<!-- Story: #KAN-1 (epic, covers KAN-2/4/5/6) -->
<!-- Type: erd -->
<!-- Generated: 2026-08-10 -->

```mermaid
erDiagram
    EMPLOYEE ||--o{ EMPLOYEE : "supervises (self-ref)"
    EMPLOYEE ||--o{ LEAVE_REQUEST : submits
    EMPLOYEE ||--o{ LEAVE_BALANCE : has
    EMPLOYEE ||--o{ PAYROLL_RECORD : "paid via"
    EMPLOYEE ||--o{ NOTIFICATION : receives
    LEAVE_REQUEST ||--o{ NOTIFICATION : triggers
    PAYROLL_RECORD ||--o{ NOTIFICATION : triggers

    EMPLOYEE {
        uuid id PK
        string full_name
        string personal_email UK
        string company_email UK
        decimal monthly_payroll_rate
        uuid supervisor_id FK "nullable, self-ref, owned by employee-grpc"
        string authentik_user_id
        timestamp created_at
    }

    LEAVE_BALANCE {
        uuid id PK
        uuid employee_id FK
        string leave_type "annual|sick"
        int entitled_days
        int used_days
        int year
    }

    LEAVE_REQUEST {
        uuid id PK
        uuid employee_id FK
        string leave_type "annual|sick|unpaid"
        date start_date
        date end_date
        int days
        string status "pending|approved|rejected"
        uuid reviewed_by FK "supervisor or HR Admin employee_id"
        timestamp reviewed_at
        owned_by leave-grpc
    }

    PAYROLL_RECORD {
        uuid id PK
        uuid employee_id FK
        string year_month "e.g. 2026-08"
        decimal base_amount
        decimal unpaid_deduction
        decimal net_amount
        string pdf_object_key "MinIO path"
        timestamp generated_at
        owned_by payroll-grpc
    }

    NOTIFICATION {
        uuid id PK
        uuid recipient_employee_id
        string type "leave_requested|leave_reviewed|payroll_generated"
        string payload_ref "source record id"
        bool read
        timestamp created_at
        owned_by notification service, read-only projection via CDC
    }
```

## Ownership (per service-boundary-definition)
- `employee-grpc` owns `EMPLOYEE` exclusively.
- `leave-grpc` owns `LEAVE_REQUEST` + `LEAVE_BALANCE` exclusively.
- `payroll-grpc` owns `PAYROLL_RECORD` exclusively.
- `notification` service owns `NOTIFICATION` exclusively — a read-model projection populated via Kafka/CDC, never a foreign key join into other services' tables.

No entity is owned by two services. Cross-service references (`employee_id`, `supervisor_id`, `reviewed_by`) are opaque IDs resolved via gRPC/federation `@key`, never joined at the DB level.
