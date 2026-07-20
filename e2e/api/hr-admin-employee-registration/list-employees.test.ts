import { describe, expect, it } from 'vitest'

// Black-box UAT coverage for US-1 / FEAT-2 (List employees), driven entirely through Apollo
// Router. Expected to fail until FEAT-2 (employees query) is implemented and merged.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-2

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`

const EMPLOYEES_QUERY = `
  query Employees {
    employees {
      id
      firstName
      lastName
      email
      supervisor {
        id
        firstName
        lastName
      }
    }
  }
`

function uniqueEmail() {
  return `e2e-list-employees-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerEmployee(overrides: Record<string, unknown> = {}) {
  const input = {
    firstName: 'List',
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

async function callEmployees() {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: EMPLOYEES_QUERY }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('US-1 HR Admin Employee Registration — employees', () => {
  // [INT-1-4] employees query returns supervisor name resolved
  it('returns the registered employee in the list with supervisor resolved when none is assigned', async () => {
    const employeeId = await registerEmployee()
    expect(employeeId).toEqual(expect.any(String))

    const { status, body } = await callEmployees()
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    const employees = body.data?.employees as Array<{ id: string; supervisor: unknown }>
    const found = employees.find((e) => e.id === employeeId)
    expect(found).toBeDefined()
    expect(found?.supervisor).toBeNull()
  })

  // FEAT-2 edge case: no employees still returns a valid (possibly non-empty, since this is a
  // shared environment) list without error — the important assertion is no error, not emptiness
  it('returns without error even with no filters applied', async () => {
    const { status, body } = await callEmployees()
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(Array.isArray(body.data?.employees)).toBe(true)
  })
})
