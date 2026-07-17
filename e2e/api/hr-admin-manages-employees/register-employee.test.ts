import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-1 (HR Admin manages employees), driven entirely through Apollo
// Router. Expected to fail until FEAT-1 (registerEmployee mutation) is implemented and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-1 / FEAT-1 /
// employee-subgraph.api.graphql

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee {
        id
        employeeId
        fullName
        role
        department
        grossSalary
        supervisor { id }
        createdAt
      }
      temporaryPassword
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

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Ada Lovelace',
    employeeId: uniqueEmployeeId(),
    role: 'Software Engineer',
    department: 'Engineering',
    grossSalary: 5000,
    ...overrides,
  }
}

describe('US-1 HR Admin manages employees — FEAT-1 registerEmployee — API', () => {
  // [E2E-1] Successful registration creates employee + Authentik account + temporary password
  it('creates an employee record and returns a temporary password on valid input', async () => {
    const { status, body } = await graphql(REGISTER_EMPLOYEE_MUTATION, { input: validInput() })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.registerEmployee).toMatchObject({
      employee: expect.objectContaining({ id: expect.any(String), fullName: 'Ada Lovelace' }),
      temporaryPassword: expect.any(String),
    })
  })

  // [INT-1-2] Duplicate employeeId returns a conflict error
  it('returns a conflict error for a duplicate employeeId', async () => {
    const input = validInput()
    const first = await graphql(REGISTER_EMPLOYEE_MUTATION, { input })
    expect(first.body.data?.registerEmployee).toBeTruthy()

    const second = await graphql(REGISTER_EMPLOYEE_MUTATION, { input })
    expect(second.body.errors).toBeDefined()
    expect(second.body.errors[0].message.toLowerCase()).toMatch(/duplicate|conflict|already|exists/)
  })

  // [INT-1-4] Invalid supervisorId returns a not found error
  it('returns a not found error when supervisorId does not exist', async () => {
    const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
      input: validInput({ supervisorId: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].message.toLowerCase()).toMatch(/not found|does not exist/)
  })

  // [INT-1-5] Negative grossSalary returns a validation error
  it('returns a validation error for a negative grossSalary', async () => {
    const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
      input: validInput({ grossSalary: -100 }),
    })
    expect(body.errors).toBeDefined()
  })

  // Edge case: empty required string fields
  it('returns a validation error for an empty fullName', async () => {
    const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
      input: validInput({ fullName: '' }),
    })
    expect(body.errors).toBeDefined()
  })
})
