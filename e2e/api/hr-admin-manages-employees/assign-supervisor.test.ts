import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-1 (HR Admin manages employees), driven entirely through Apollo
// Router. Expected to fail until FEAT-1 (registerEmployee, used as setup) and FEAT-2
// (assignSupervisor mutation) are implemented and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-1 / FEAT-2 /
// employee-subgraph.api.graphql

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

async function registerEmployee(overrides: Record<string, unknown> = {}) {
  const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      fullName: 'Grace Hopper',
      employeeId: uniqueEmployeeId(),
      role: 'Engineer',
      department: 'Engineering',
      grossSalary: 6000,
      ...overrides,
    },
  })
  const id = body.data?.registerEmployee?.employee?.id
  if (!id) throw new Error(`Setup failed: could not register employee: ${JSON.stringify(body)}`)
  return id as string
}

describe('US-1 HR Admin manages employees — FEAT-2 assignSupervisor — API', () => {
  // [INT-2-1] Valid supervisor assignment updates the employee record
  it('updates the employee record with the new supervisorId', async () => {
    const supervisorId = await registerEmployee()
    const employeeId = await registerEmployee()

    const { status, body } = await graphql(ASSIGN_SUPERVISOR_MUTATION, {
      input: { employeeId, supervisorId },
    })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.assignSupervisor?.supervisor?.id).toBe(supervisorId)
  })

  // [INT-2-2] Non-existent supervisorId returns not found error
  it('returns a not found error when supervisorId does not exist', async () => {
    const employeeId = await registerEmployee()
    const { body } = await graphql(ASSIGN_SUPERVISOR_MUTATION, {
      input: { employeeId, supervisorId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].message.toLowerCase()).toMatch(/not found|does not exist/)
  })

  // [INT-2-3] Employee assigned as their own supervisor returns validation error
  it('returns a validation error when an employee is assigned as their own supervisor', async () => {
    const employeeId = await registerEmployee()
    const { body } = await graphql(ASSIGN_SUPERVISOR_MUTATION, {
      input: { employeeId, supervisorId: employeeId },
    })
    expect(body.errors).toBeDefined()
  })
})
