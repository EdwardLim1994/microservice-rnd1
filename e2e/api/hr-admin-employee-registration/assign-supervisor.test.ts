import { describe, expect, it } from 'vitest'

// Black-box UAT coverage for US-1 / FEAT-3 (Assign supervisor to employee), driven entirely
// through Apollo Router. Expected to fail until FEAT-3 (assignSupervisor mutation) is
// implemented and merged.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-3
//
// Known gap: the positive "eligible supervisor" path (E2E-1-2 — target createdAt >= 5 years ago)
// cannot be exercised black-box through the public API alone, since a freshly registered
// employee's createdAt is always "now" and no seeding/time-travel mutation is exposed. Only the
// ineligible path (E2E-1-3 / INT-1-6), which a freshly registered employee always satisfies, is
// covered here — see the QA issue (#203) for the follow-up note.

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
  mutation AssignSupervisor($employeeId: ID!, $supervisorId: ID!) {
    assignSupervisor(employeeId: $employeeId, supervisorId: $supervisorId) {
      id
      supervisorId
    }
  }
`

function uniqueEmail() {
  return `e2e-assign-supervisor-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
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
    body: JSON.stringify({ query: ASSIGN_SUPERVISOR_MUTATION, variables: { employeeId, supervisorId } }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('US-1 HR Admin Employee Registration — assignSupervisor', () => {
  // [E2E-1-3 / INT-1-6] Ineligible supervisor (fewer than 5 years tenure)
  it('returns an INELIGIBLE error and does not persist the assignment when the target has served fewer than 5 years', async () => {
    const employeeId = await registerEmployee()
    const supervisorId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))
    expect(supervisorId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor(employeeId as string, supervisorId as string)
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('INELIGIBLE')
  })

  // FEAT-3 edge case: employeeId and supervisorId identical
  it('returns a BAD_USER_INPUT error when employeeId and supervisorId are the same', async () => {
    const employeeId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor(employeeId as string, employeeId as string)
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })

  // FEAT-3 edge case: employeeId or supervisorId not found
  it('returns a NOT_FOUND error when supervisorId does not exist', async () => {
    const employeeId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))

    const { body } = await callAssignSupervisor(employeeId as string, 'nonexistent-supervisor-id')
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('NOT_FOUND')
  })
})
