<!-- Story: #KAN-5 — Monthly Automated Payroll Generation -->

```mermaid
flowchart TD
    Start[Employee: My Payslips screen] --> List[List of monthly payslips]
    List --> Open[Click a payslip row]
    Open --> Download[Download/view PDF from MinIO]
```
