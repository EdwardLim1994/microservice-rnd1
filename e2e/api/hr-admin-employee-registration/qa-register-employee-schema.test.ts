import { describe, expect, it } from 'vitest'

// QA integration coverage for FEAT-1 (Register new employee) — derived from reading the actual
// implementation (servers/employee/src/schemas/graphql/employee.graphql,
// RegisterEmployeeSaga/CreateEmployeeUseCase/CreateAuthentikAccountUseCase), not from OpenSpec.
// Verifies the implementation works correctly — the UAT suite in
// ./register-employee.test.ts covers business requirements from OpenSpec and only selects a
// handful of Employee fields; this covers the full schema shape and implementation-specific
// details (temporary password format, supervisorId persistence) that only reading the real code
// revealed.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — FEAT-1, and PR #206/#208 for the
// implementation this was derived from.

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_FULL_SHAPE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee {
        id
        firstName
        lastName
        gender
        email
        grossSalary
        salaryPerDay
        supervisorId
        createdAt
        updatedAt
      }
      temporaryPassword
    }
  }
`

function uniqueEmail() {
  return `e2e-qa-register-employee-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function callRegisterEmployee(input: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: REGISTER_EMPLOYEE_FULL_SHAPE_MUTATION, variables: { input } }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('FEAT-1 Register new employee — QA schema/implementation coverage', () => {
  it('returns every field the Employee type actually exposes, correctly populated', async () => {
    const input = {
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'FEMALE',
      email: uniqueEmail(),
      grossSalary: 5000,
      salaryPerDay: 200,
    }
    const { status, body } = await callRegisterEmployee(input)

    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    const employee = body.data?.registerEmployee?.employee
    expect(employee).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'FEMALE',
      email: input.email,
      grossSalary: 5000,
      salaryPerDay: 200,
      supervisorId: null,
    })
    expect(employee.id).toEqual(expect.any(String))
    expect(employee.createdAt).toEqual(expect.any(String))
    expect(employee.updatedAt).toEqual(expect.any(String))
    // Both timestamps must actually be parseable dates, not just present strings.
    expect(Number.isNaN(Date.parse(employee.createdAt))).toBe(false)
    expect(Number.isNaN(Date.parse(employee.updatedAt))).toBe(false)
  })

  it('generates a temporary password matching CreateAuthentikAccountUseCase.generateTemporaryPassword\'s real format (16 chars, no ambiguous I/O/0/1)', async () => {
    const { body } = await callRegisterEmployee({
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'FEMALE',
      email: uniqueEmail(),
      grossSalary: 5000,
      salaryPerDay: 200,
    })

    const password = body.data?.registerEmployee?.temporaryPassword as string
    expect(password).toHaveLength(16)
    // RANDOM_CHAR_POOL excludes I, O, 0, 1 specifically to avoid visually ambiguous characters in
    // a password an HR Admin has to manually read out / copy-paste to an employee.
    expect(password).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%]+$/)
  })

  it('persists a valid supervisorId and returns it back on the created Employee', async () => {
    const supervisor = await callRegisterEmployee({
      firstName: 'Sam',
      lastName: 'Supervisor',
      gender: 'FEMALE',
      email: uniqueEmail(),
      grossSalary: 6000,
      salaryPerDay: 250,
    })
    const supervisorId = supervisor.body.data?.registerEmployee?.employee?.id as string
    expect(supervisorId).toEqual(expect.any(String))

    const { body } = await callRegisterEmployee({
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'FEMALE',
      email: uniqueEmail(),
      grossSalary: 5000,
      salaryPerDay: 200,
      supervisorId,
    })

    expect(body.errors).toBeUndefined()
    expect(body.data?.registerEmployee?.employee?.supervisorId).toBe(supervisorId)
  })
})
