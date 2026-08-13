# Component Requirements — hr-leave-payroll-platform

Structural requirements per screen — component type + contents, no visual appearance.

| Screen | Components |
|---|---|
| Employee List | DataTable (columns: name, email, rate, supervisor), PrimaryButton ("Register Employee"), EmptyState, LoadingSkeleton |
| Registration Form | Form, TextInput ×1 (name), EmailInput ×1, NumberInput ×1 (rate), SearchableSelect ×1 (supervisor), SubmitButton, InlineFieldError ×N, SuccessCredentialDialog (one-time display of email + generated password, mocked delivery per ADR-3) |
| Edit Employee Form | Form, NumberInput ×1 (rate), SearchableSelect ×1 (supervisor), ReadOnlyField ×2 (name, email), SubmitButton, InlineFieldError |
| My Leave | SummaryCard ×2 (annual balance, sick balance), DataTable (leave history), PrimaryButton ("Request Leave"), EmptyState |
| Leave Request Form | Modal or Form, Select ×1 (leave type), DatePicker ×2 (start/end), ComputedPreview (day count + balance estimate), SubmitButton, InlineFieldError |
| Leave Approval Queue | DataTable (requester, type, dates, days), ActionButton ×2 per row (Approve/Reject), ConfirmDialog, EmptyState, LoadingSpinner (per-row) |
| My Payslips | DataTable (year-month, net amount, generated date), DownloadIcon/Button per row, EmptyState, LoadingSpinner |
| Notification Icon + Dropdown | IconButton (with Badge for unread count), Dropdown/Popover, NotificationListItem ×N, EmptyState, ActionLink ("Mark all as read") — mounted once in the shared portal header layout, not per-screen |

All components are React function components per `frontend-webapp-anatomy` (`component-development`), consuming Apollo Client operations per `apollo-client-implementation`.
