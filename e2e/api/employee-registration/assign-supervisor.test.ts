import { describe, expect, it } from 'vitest'

// Integration coverage for FEAT-3 (Assign supervisor to employee), driven entirely through
// Apollo Router. Expected to fail until the employee-subgraph's assignSupervisor mutation and
// its 5-year eligibility check are implemented.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-3
// and .openspec/requirements/release/v0.1.0/employee-subgraph.api.graphql

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`

const ASSIGN_SUPERVISOR_MUTATION = `
  mutation AssignSupervisor($input: AssignSupervisorInput!) {
    assignSupervisor(input: $input) {
      id
      supervisor { id }
    }
  }
`

function uniqueEmail() {
  return `e2e-assign-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerEmployee(overrides: Record<string, unknown> = {}) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: REGISTER_EMPLOYEE_MUTATION,
      variables: {
        input: {
          firstName: 'Assign',
          lastName: 'Target',
          gender: 'female',
          email: uniqueEmail(),
          grossSalary: 4000,
          salaryPerDay: 150,
          ...overrides,
        },
      },
    }),
  })
  const body = await res.json()
  return body.data?.registerEmployee?.employee?.id as string
}

async function callAssignSupervisor(input: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ASSIGN_SUPERVISOR_MUTATION, variables: { input } }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('FEAT-3 Assign supervisor to employee — API', () => {
  // [INT-1-5] Eligible target (createdAt 5+ years ago) — SKIPPED: the public
  // registerEmployee mutation has no way to backdate createdAt, so an eligible supervisor
  // fixture can't be produced through the router alone. Needs a seeded/backdated test
  // fixture (DB-level or a test-only admin hook) before this can run for real — add once
  // that seeding mechanism exists.
  it.skip('updates the employee record when supervisor createdAt is 5+ years ago', async () => {
    // Intentionally left unimplemented — see note above.
  })

  // [INT-1-6] Ineligible target (createdAt < 5 years ago, i.e. freshly registered)
  it('returns INELIGIBLE when the target supervisor has served less than 5 years', async () => {
    const employeeId = await registerEmployee({ firstName: 'Report' })
    const supervisorId = await registerEmployee({ firstName: 'FreshSupervisor' })
    expect(employeeId).toEqual(expect.any(String))
    expect(supervisorId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor({ employeeId, supervisorId })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('INELIGIBLE')
  })

  // Edge case: employeeId or supervisorId not found
  it('returns NOT_FOUND when employeeId does not exist', async () => {
    const supervisorId = await registerEmployee({ firstName: 'RealSupervisor' })
    const { body } = await callAssignSupervisor({ employeeId: 'non-existent-id', supervisorId })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('NOT_FOUND')
  })

  // Edge case: assigning an employee as their own supervisor
  it('returns BAD_USER_INPUT when employee is assigned as their own supervisor', async () => {
    const employeeId = await registerEmployee({ firstName: 'SelfSupervisor' })
    const { body } = await callAssignSupervisor({ employeeId, supervisorId: employeeId })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })
})
