## ADDED Requirements

### Requirement: Monthly payroll is calculated automatically per employee
The system SHALL calculate, on a month-end cron trigger, each employee's net pay as their monthly payroll rate minus a deduction for unpaid leave days taken that month.

#### Scenario: Successful monthly calculation
- **WHEN** the month-end cron job runs
- **THEN** each active employee's net amount is calculated as monthly rate minus (unpaid leave days that month × daily rate)

### Requirement: Payroll PDF is generated and stored in MinIO
The system SHALL render a payroll PDF for each employee's monthly calculation and store it in MinIO.

#### Scenario: PDF generated and stored
- **WHEN** an employee's payroll for a month is calculated
- **THEN** a PDF is generated and uploaded to MinIO, and a payroll record referencing it is saved

### Requirement: Monthly payroll generation is idempotent
The system SHALL NOT generate a duplicate payroll record or double-apply a deduction if the monthly job is re-run for a month already generated for an employee.

#### Scenario: Re-run does not duplicate
- **WHEN** the payroll job runs again for an employee/month combination that already has a payroll record
- **THEN** no new record or PDF is created for that combination

### Requirement: Payroll PDF access is restricted
The system SHALL restrict access to a stored payroll PDF to HR Admin and the specific employee it belongs to.

#### Scenario: Access denied to unrelated employee
- **WHEN** an employee attempts to access another employee's payroll PDF
- **THEN** the system denies access

### Requirement: Payroll cron job uses least-privilege credentials
The system SHALL run the payroll cron job with Vault-issued, least-privilege service credentials rather than a static superuser credential.

#### Scenario: Cron job authenticates with scoped credentials
- **WHEN** the payroll cron job connects to its database and MinIO
- **THEN** it uses Vault-issued, least-privilege credentials scoped to the payroll service, not a static superuser credential
