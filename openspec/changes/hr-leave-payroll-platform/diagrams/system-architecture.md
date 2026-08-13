<!-- Change: hr-leave-payroll-platform -->
<!-- Type: system-architecture -->
<!-- Generated: 2026-08-10 -->

# System Architecture — after hr-leave-payroll-platform

First system-architecture diagram in this repo (no prior services scaffolded) — drawn fresh, not incremental.

```mermaid
graph TB
    subgraph External
        HR[HR Admin]
        SUP[Supervisor]
        EMP[Employee]
    end

    subgraph Edge
        Traefik[Traefik Ingress]
        Router[Apollo Router<br/>services/apollo-router]
        Authentik[Authentik OIDC<br/>services/authentik]
    end

    subgraph "apps/servers/employee (new)"
        EmpSub[employee-subgraph<br/>ApolloDriver]
        EmpGrpc[employee-grpc<br/>GrpcDriver]
        EmpDb[(PostgreSQL<br/>employee-infra)]
    end

    subgraph "apps/servers/leave (new)"
        LeaveSub[leave-subgraph<br/>ApolloDriver]
        LeaveGrpc[leave-grpc<br/>GrpcDriver]
        LeaveDb[(PostgreSQL<br/>leave-infra)]
        LeaveDbz[Debezium Server<br/>leave-infra]
    end

    subgraph "apps/servers/payroll (new)"
        PayrollSub[payroll-subgraph<br/>ApolloDriver]
        PayrollGrpc[payroll-grpc<br/>GrpcDriver]
        PayrollCron[payroll-cron<br/>CronDriver]
        PayrollDb[(PostgreSQL<br/>payroll-infra)]
        PayrollDbz[Debezium Server<br/>payroll-infra]
    end

    subgraph "apps/servers/notification (new)"
        NotifSub[notification-subgraph<br/>ApolloDriver]
        NotifKafka[notification-consumer<br/>KafkaDriver]
        NotifDb[(PostgreSQL<br/>notification-infra)]
    end

    subgraph Shared Infra
        Kafka[services/kafka]
        MinIO[services/minio]
        Vault[services/vault]
    end

    HR --> Traefik
    SUP --> Traefik
    EMP --> Traefik
    Traefik --> Router
    Router --> EmpSub
    Router --> LeaveSub
    Router --> PayrollSub
    Router --> NotifSub
    Traefik -.login.-> Authentik

    EmpSub --> EmpGrpc --> EmpDb
    LeaveSub --> LeaveGrpc --> LeaveDb
    PayrollSub --> PayrollGrpc --> PayrollDb
    PayrollCron --> PayrollDb
    NotifSub --> NotifDb
    NotifKafka --> NotifDb

    LeaveGrpc -. gRPC: GetSupervisorChain .-> EmpGrpc
    PayrollGrpc -. gRPC: GetEmployeeRate .-> EmpGrpc
    PayrollCron -. gRPC: GetUnpaidLeaveDays .-> LeaveGrpc
    PayrollCron -. write PDF .-> MinIO

    LeaveDb --> LeaveDbz --> Kafka
    PayrollDb --> PayrollDbz --> Kafka
    Kafka --> NotifKafka

    EmpGrpc -. provision user .-> Authentik
    EmpGrpc -. return generated password once .-> EmpSub

    EmpDb -.creds.-> Vault
    LeaveDb -.creds.-> Vault
    PayrollDb -.creds.-> Vault
    NotifDb -.creds.-> Vault
```

## Notes
- 4 new servers: `employee`, `leave`, `payroll`, `notification` — none exist yet, all scaffolded via `turbo gen server` post-`/kickoff`.
- Notifications are CDC-driven (Debezium → Kafka), not app-level event publish — see ADR-2.
- Credential delivery is mocked (one-time success dialog in `hr-portal`, not a real email) — see ADR-3.
