import { describe, expect, it } from 'vitest'

// Integration coverage for FEAT-1 (Register new employee), driven entirely through Apollo
// Router — never calls servers/employee directly. Expected to fail until the employee-subgraph's
// registerEmployee mutation and its Authentik-backed account creation are implemented.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-1
// and .openspec/requirements/release/v0.1.0/employee-subgraph.api.graphql

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee {
        id
        firstName
        lastName
        email
        grossSalary
        salaryPerDay
      }
      temporaryPassword
    }
  }
`

function uniqueEmail() {
  return `e2e-employee-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'female',
    email: uniqueEmail(),
    grossSalary: 5000,
    salaryPerDay: 200,
    ...overrides,
  }
}

async function callRegisterEmployee(input: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: REGISTER_EMPLOYEE_MUTATION, variables: { input } }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('FEAT-1 Register new employee — API', () => {
  // [INT-1-1] Valid registration creates employee and Authentik account
  it('creates an Employee record and returns a non-empty temporaryPassword', async () => {
    const { status, body } = await callRegisterEmployee(validInput())
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.registerEmployee?.employee?.id).toEqual(expect.any(String))
    expect(body.data?.registerEmployee?.temporaryPassword).toEqual(expect.any(String))
    expect(body.data?.registerEmployee?.temporaryPassword.length).toBeGreaterThan(0)
  })

  // [INT-1-2] Duplicate employeeId (email) returns conflict error
  it('returns CONFLICT when email is already registered', async () => {
    const input = validInput()
    const first = await callRegisterEmployee(input)
    expect(first.body.data?.registerEmployee?.employee?.id).toEqual(expect.any(String))

    const second = await callRegisterEmployee(input)
    expect(second.body.errors).toBeDefined()
    expect(second.body.errors[0].extensions?.code).toBe('CONFLICT')
  })

  // [INT-1-3] Missing required field returns validation error
  it('returns BAD_USER_INPUT when a required field is missing', async () => {
    const { firstName: _omit, ...incomplete } = validInput()
    const { body } = await callRegisterEmployee(incomplete)
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })

  // Edge case: supervisorId provided but not found
  it('returns NOT_FOUND when supervisorId does not exist', async () => {
    const { body } = await callRegisterEmployee(validInput({ supervisorId: 'non-existent-id' }))
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('NOT_FOUND')
  })
})
