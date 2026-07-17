import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-1 (HR Admin manages employees), driven entirely through Apollo
// Router. Expected to fail until FEAT-1 (registerEmployee, used as setup), FEAT-3
// (generatePayslips, used as setup) and FEAT-6 (notifications query / markNotificationRead) are
// implemented and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-1 / FEAT-6 /
// payroll-subgraph.api.graphql

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`

const GENERATE_PAYSLIPS_MUTATION = `
  mutation GeneratePayslips($input: GeneratePayslipsInput!) {
    generatePayslips(input: $input) {
      generated { employee { id } }
    }
  }
`

const NOTIFICATIONS_QUERY = `
  query Notifications($employeeId: ID!) {
    notifications(employeeId: $employeeId) {
      id
      message
      read
      createdAt
    }
  }
`

const MARK_NOTIFICATION_READ_MUTATION = `
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      read
    }
  }
`

async function graphql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return { status: res.status, body: await res.json() }
}

function uniqueEmployeeId() {
  return `EMP-E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function registerAndGeneratePayslip() {
  const { body: registerBody } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      fullName: 'Rosalind Franklin',
      employeeId: uniqueEmployeeId(),
      role: 'Scientist',
      department: 'R&D',
      grossSalary: 7000,
    },
  })
  const employeeId = registerBody.data?.registerEmployee?.employee?.id
  if (!employeeId) {
    throw new Error(`Setup failed: could not register employee: ${JSON.stringify(registerBody)}`)
  }

  const { body: payslipsBody } = await graphql(GENERATE_PAYSLIPS_MUTATION, {
    input: { month: 2, year: 2026 },
  })
  if (!payslipsBody.data?.generatePayslips) {
    throw new Error(`Setup failed: could not generate payslips: ${JSON.stringify(payslipsBody)}`)
  }

  return employeeId as string
}

describe('US-1 HR Admin manages employees — FEAT-6 payslip notification — API', () => {
  // [E2E-2] Employee receives a bell notification that a new payslip is available
  it('creates a notification for the employee after payslip generation', async () => {
    const employeeId = await registerAndGeneratePayslip()

    const { status, body } = await graphql(NOTIFICATIONS_QUERY, { employeeId })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    const notifications = body.data?.notifications as { id: string; read: boolean }[] | undefined
    expect(notifications?.length).toBeGreaterThan(0)
    expect(notifications?.[0]?.read).toBe(false)
  })

  it('marks a notification as read', async () => {
    const employeeId = await registerAndGeneratePayslip()
    const { body: notificationsBody } = await graphql(NOTIFICATIONS_QUERY, { employeeId })
    const notificationId = notificationsBody.data?.notifications?.[0]?.id

    const { body } = await graphql(MARK_NOTIFICATION_READ_MUTATION, { id: notificationId })
    expect(body.errors).toBeUndefined()
    expect(body.data?.markNotificationRead?.read).toBe(true)
  })
})
