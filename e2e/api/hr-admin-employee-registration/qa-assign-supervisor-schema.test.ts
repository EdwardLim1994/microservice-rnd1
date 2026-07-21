import { describe, expect, it } from 'vitest'

// QA integration coverage for FEAT-3 (Assign supervisor to employee) — derived from reading the
// actual implementation (AssignSupervisorSaga, AssignSupervisorUseCase,
// RevertEmployeeSupervisorUseCase, UpdateAuthentikGroupUseCase), not from OpenSpec.
// Verifies the implementation works correctly — the UAT suite in ./assign-supervisor.test.ts
// covers business requirements from OpenSpec (error codes only); this covers the full response
// shape and a saga-compensation detail that only reading the real code revealed: every failure
// path (INELIGIBLE / BAD_USER_INPUT / NOT_FOUND) must leave the employee's supervisorId
// completely unchanged, since AssignSupervisorUseCase persists the new supervisorId before the
// Authentik group update runs, and RevertEmployeeSupervisorUseCase is the saga's compensation for
// that. The UAT suite's existing test titles claim "does not persist the assignment" but never
// actually assert it — this file adds that assertion.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — FEAT-3, and PR #223/#225 for the
// implementation this was derived from.
//
// Known gap (carried over from ./assign-supervisor.test.ts): the positive "eligible supervisor"
// path (target createdAt >= 5 years ago) cannot be exercised black-box through the public API
// alone, since a freshly registered employee's createdAt is always "now" and no seeding/
// time-travel mutation is exposed.

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`

const ASSIGN_SUPERVISOR_FULL_SHAPE_MUTATION = `
  mutation AssignSupervisor($employeeId: ID!, $supervisorId: ID!) {
    assignSupervisor(employeeId: $employeeId, supervisorId: $supervisorId) {
      id
      firstName
      lastName
      gender
      email
      grossSalary
      salaryPerDay
      supervisorId
      supervisor {
        id
        firstName
        lastName
        email
      }
      createdAt
      updatedAt
    }
  }
`

const EMPLOYEES_QUERY = `
  query Employees {
    employees {
      id
      supervisorId
    }
  }
`

function uniqueEmail() {
  return `e2e-qa-assign-supervisor-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerEmployee(overrides: Record<string, unknown> = {}) {
  const input = {
    firstName: 'Assign',
    lastName: 'Fixture',
    gender: 'OTHER',
    email: uniqueEmail(),
    grossSalary: 4000,
    salaryPerDay: 150,
    ...overrides,
  }
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: REGISTER_EMPLOYEE_MUTATION, variables: { input } }),
  })
  const body = await res.json()
  return body.data?.registerEmployee?.employee?.id as string | undefined
}

async function callAssignSupervisor(employeeId: string, supervisorId: string) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ASSIGN_SUPERVISOR_FULL_SHAPE_MUTATION,
      variables: { employeeId, supervisorId },
    }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

async function findEmployee(employeeId: string) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: EMPLOYEES_QUERY }),
  })
  const body = await res.json()
  const employees = body.data?.employees as Array<{ id: string; supervisorId: string | null }>
  return employees.find((e) => e.id === employeeId)
}

describe('FEAT-3 Assign supervisor to employee — QA schema/implementation coverage', () => {
  it('leaves the employee supervisorId unchanged after an INELIGIBLE rejection (saga compensation)', async () => {
    const employeeId = await registerEmployee()
    const supervisorId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))
    expect(supervisorId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor(employeeId as string, supervisorId as string)
    expect(body.errors?.[0]?.extensions?.code).toBe('INELIGIBLE')

    const employee = await findEmployee(employeeId as string)
    expect(employee?.supervisorId).toBeNull()
  })

  it('leaves the employee supervisorId unchanged after a BAD_USER_INPUT rejection', async () => {
    const employeeId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor(employeeId as string, employeeId as string)
    expect(body.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT')

    const employee = await findEmployee(employeeId as string)
    expect(employee?.supervisorId).toBeNull()
  })

  it('leaves the employee supervisorId unchanged after a NOT_FOUND rejection', async () => {
    const employeeId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor(employeeId as string, 'nonexistent-supervisor-id')
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND')

    const employee = await findEmployee(employeeId as string)
    expect(employee?.supervisorId).toBeNull()
  })

  it('returns Employee! directly (not a wrapper type) and NOT_FOUND when employeeId does not exist', async () => {
    const supervisorId = await registerEmployee()
    expect(supervisorId).toEqual(expect.any(String))

    const { status, body } = await callAssignSupervisor('nonexistent-employee-id', supervisorId as string)
    expect(status).toBe(200)
    expect(body.data?.assignSupervisor).toBeNull()
    expect(body.errors?.[0]?.extensions?.code).toBe('NOT_FOUND')
  })
})
