# Design Prompt — hr-leave-payroll-platform

For use with Figma AI / Claude Design / OpenDesign.

## Layout Intent
An internal enterprise HR web portal, three role-scoped views (HR Admin, Supervisor, Employee) sharing one shell: a persistent header (app name, notification bell with unread badge, user menu) and a left-nav or top-nav switching between the role's available screens. Content area is table/form-centric — this is a data-management tool, not a marketing site. Dense but readable, not playful.

## Screens / Components Needed
1. **Employee List + Registration/Edit Form** (HR Admin only) — DataTable, searchable select for supervisor, standard form with validation states.
2. **Login** — thin wrapper around Authentik-hosted OIDC form; minimal custom chrome.
3. **My Leave** (all roles) — balance summary cards + history table + request form (modal).
4. **Leave Approval Queue** (Supervisor/HR Admin) — table with per-row approve/reject actions and a confirm step.
5. **My Payslips** (all roles) — table with per-row PDF download.
6. **Notification bell + dropdown** — global header component, badge count, list with read/unread state, click-through navigation.

## User Flows / State Transitions
See `diagrams/KAN-2-user-flow.md`, `diagrams/KAN-4-user-flow.md`, `diagrams/KAN-5-user-flow.md`, `diagrams/KAN-6-user-flow.md` for exact screen-to-screen transitions. Every form needs: idle → validating → submitting → success/error states. Every list needs: loading → populated/empty states.

## Accessibility Requirements
WCAG 2.1 AA throughout: full keyboard navigation (tab order through tables/forms/dropdown), visible focus indicators, form fields with associated `<label>`s and `aria-describedby` error text, live-region announcement for the notification badge count change, sufficient color contrast for status indicators (pending/approved/rejected) not relying on color alone (add text/icon). No mobile app in this epic, so no touch-target/VoiceOver requirements apply.

## Brand/Style Context
None supplied yet — no existing design system or brand guide in this repo to anchor to (no `apps/web/*` scaffolded). Default to a clean, neutral enterprise-admin aesthetic until brand direction is given.
