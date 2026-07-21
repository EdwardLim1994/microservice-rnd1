import { describe, expect, it } from 'vitest'

// QA integration coverage for FEAT-2 (List employees) — derived from reading the actual
// implementation (servers/employee/src/schemas/graphql/employee.graphql, ListEmployeesUseCase,
// ResolveEmployeeSupervisorUseCase), not from OpenSpec.
// Verifies the implementation works correctly — the UAT suite in ./list-employees.test.ts covers
// business requirements from OpenSpec and only selects a handful of Employee fields; this covers
// the full schema shape and implementation-specific details (every Employee field, and that
// Employee.supervisor resolves the full supervisor record, not just its id) that only reading the
// real code revealed.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — FEAT-2, and PR #215/#217 for the
// implementation this was derived from.

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`

const EMPLOYEES_FULL_SHAPE_QUERY = `
  query Employees {
    employees {
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

function uniqueEmail() {
  return `e2e-qa-list-employees-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
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
    body: JSON.stringify({ query: EMPLOYEES_FULL_SHAPE_QUERY }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

describe('FEAT-2 List employees — QA schema/implementation coverage', () => {
  it('returns every field the Employee type actually exposes, correctly populated', async () => {
    const email = uniqueEmail()
    const employeeId = await registerEmployee({
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'FEMALE',
      email,
      grossSalary: 5000,
      salaryPerDay: 200,
    })
    expect(employeeId).toEqual(expect.any(String))

    const { status, body } = await callEmployees()
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()

    const employees = body.data?.employees as Array<Record<string, unknown>>
    const employee = employees.find((e) => e.id === employeeId)
    expect(employee).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      gender: 'FEMALE',
      email,
      grossSalary: 5000,
      salaryPerDay: 200,
      supervisorId: null,
      supervisor: null,
    })
    expect(Number.isNaN(Date.parse(employee?.createdAt as string))).toBe(false)
    expect(Number.isNaN(Date.parse(employee?.updatedAt as string))).toBe(false)
  })

  it('resolves Employee.supervisor to the full supervisor record, not just supervisorId', async () => {
    const supervisorEmail = uniqueEmail()
    const supervisorId = await registerEmployee({
      firstName: 'Sam',
      lastName: 'Supervisor',
      email: supervisorEmail,
    })
    expect(supervisorId).toEqual(expect.any(String))

    const reportEmail = uniqueEmail()
    const reportId = await registerEmployee({
      firstName: 'Rae',
      lastName: 'Report',
      email: reportEmail,
      supervisorId,
    })
    expect(reportId).toEqual(expect.any(String))

    const { body } = await callEmployees()
    const employees = body.data?.employees as Array<Record<string, unknown>>
    const report = employees.find((e) => e.id === reportId)

    expect(report?.supervisorId).toBe(supervisorId)
    expect(report?.supervisor).toMatchObject({
      id: supervisorId,
      firstName: 'Sam',
      lastName: 'Supervisor',
      email: supervisorEmail,
    })
  })

  it('includes every registered employee, regardless of list order', async () => {
    const idA = await registerEmployee({ firstName: 'Order', lastName: 'A' })
    const idB = await registerEmployee({ firstName: 'Order', lastName: 'B' })
    expect(idA).toEqual(expect.any(String))
    expect(idB).toEqual(expect.any(String))

    const { body } = await callEmployees()
    const ids = (body.data?.employees as Array<{ id: string }>).map((e) => e.id)

    expect(ids).toEqual(expect.arrayContaining([idA, idB]))
  })
})
