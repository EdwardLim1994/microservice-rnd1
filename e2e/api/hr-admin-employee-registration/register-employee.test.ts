import { describe, expect, it } from 'vitest'

// Black-box UAT coverage for US-1 / FEAT-1 (Register new employee), driven entirely through
// Apollo Router — never calls servers/employee or servers/auth directly. Expected to fail until
// FEAT-1 (registerEmployee mutation) is implemented and merged.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-1

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
        supervisorId
      }
      temporaryPassword
    }
  }
`

function uniqueEmail() {
  return `e2e-register-employee-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Jane',
    lastName: 'Doe',
    gender: 'FEMALE',
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

describe('US-1 HR Admin Employee Registration — registerEmployee', () => {
  // [E2E-1-1] Successful employee registration
  it('creates an Employee record and Authentik account, returning a non-empty temporary password', async () => {
    const { status, body } = await callRegisterEmployee(validInput())
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.registerEmployee?.employee?.id).toEqual(expect.any(String))
    expect(body.data?.registerEmployee?.temporaryPassword).toEqual(expect.any(String))
    expect(body.data?.registerEmployee?.temporaryPassword.length).toBeGreaterThan(0)
  })

  // [INT-1-2] Duplicate email
  it('returns a CONFLICT error when the email is already registered', async () => {
    const input = validInput()
    const first = await callRegisterEmployee(input)
    expect(first.body.data?.registerEmployee?.employee?.id).toEqual(expect.any(String))

    const second = await callRegisterEmployee(input)
    expect(second.body.errors).toBeDefined()
    expect(second.body.errors[0].extensions?.code).toBe('CONFLICT')
  })

  // [INT-1-3] Missing required field
  it('returns a BAD_USER_INPUT error when a required field is missing', async () => {
    const input = validInput()
    // biome-ignore lint/performance/noDelete: deliberately omitting a required field
    delete (input as Record<string, unknown>).email
    const { body } = await callRegisterEmployee(input)
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })

  // FEAT-1 edge case: supervisorId provided but not found
  it('returns a NOT_FOUND error when supervisorId does not exist', async () => {
    const { body } = await callRegisterEmployee(validInput({ supervisorId: 'nonexistent-supervisor-id' }))
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('NOT_FOUND')
  })
})
