import { describe, expect, it } from 'vitest'

// Integration coverage for FEAT-2 (List employees), driven entirely through Apollo Router.
// Expected to fail until the employee-subgraph's employees query is implemented.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-2
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

const EMPLOYEES_QUERY = `
  query Employees {
    employees {
      id
      firstName
      lastName
      email
      grossSalary
      supervisor {
        id
        firstName
        lastName
      }
    }
  }
`

function uniqueEmail() {
  return `e2e-list-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerEmployee(overrides: Record<string, unknown> = {}) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: REGISTER_EMPLOYEE_MUTATION,
      variables: {
        input: {
          firstName: 'List',
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
  return res.json()
}

async function queryEmployees() {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: EMPLOYEES_QUERY }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('FEAT-2 List employees — API', () => {
  // [INT-1-4] Returns array of Employee objects with supervisor resolved
  it('returns registered employees with supervisorId resolved to supervisor name', async () => {
    const supervisorReg = await registerEmployee()
    const supervisorId = supervisorReg.data?.registerEmployee?.employee?.id
    expect(supervisorId).toEqual(expect.any(String))

    const { status, body } = await queryEmployees()
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(Array.isArray(body.data?.employees)).toBe(true)

    const found = body.data.employees.find((e: { id: string }) => e.id === supervisorId)
    expect(found).toBeDefined()
    expect(found.firstName).toBe('List')
  })

  // Edge case: employees with no supervisor assigned
  it('returns null supervisor for an employee registered without one', async () => {
    const reg = await registerEmployee({ firstName: 'NoSupervisor' })
    const id = reg.data?.registerEmployee?.employee?.id

    const { body } = await queryEmployees()
    const found = body.data.employees.find((e: { id: string }) => e.id === id)
    expect(found).toBeDefined()
    expect(found.supervisor).toBeNull()
  })
})
