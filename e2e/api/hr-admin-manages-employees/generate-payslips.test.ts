import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-1 (HR Admin manages employees), driven entirely through Apollo
// Router. Expected to fail until FEAT-1 (registerEmployee, used as setup), FEAT-3
// (generatePayslips mutation) and FEAT-4 (Minio storage, exercised indirectly — no direct
// GraphQL surface, graphqlChanges: false) are implemented and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-1 / FEAT-3 / FEAT-4 /
// payroll-subgraph.api.graphql

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id }
    }
  }
`

const GENERATE_PAYSLIPS_MUTATION = `
  mutation GeneratePayslips($input: GeneratePayslipsInput!) {
    generatePayslips(input: $input) {
      generated {
        id
        employee { id }
        month
        year
        minioObjectKey
        generatedAt
      }
      failed
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

async function registerEmployee() {
  const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      fullName: 'Katherine Johnson',
      employeeId: uniqueEmployeeId(),
      role: 'Analyst',
      department: 'Finance',
      grossSalary: 4500,
    },
  })
  const id = body.data?.registerEmployee?.employee?.id
  if (!id) throw new Error(`Setup failed: could not register employee: ${JSON.stringify(body)}`)
  return id as string
}

describe('US-1 HR Admin manages employees — FEAT-3/FEAT-4 generatePayslips — API', () => {
  // [E2E-2] Cron triggers monthly payslip generation — PDF generated per employee and stored to Minio
  it('generates and stores a payslip with a Minio object key per active employee', async () => {
    const employeeId = await registerEmployee()

    const { status, body } = await graphql(GENERATE_PAYSLIPS_MUTATION, {
      input: { month: 1, year: 2026 },
    })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    const generated = body.data?.generatePayslips?.generated as
      | { employee: { id: string }; minioObjectKey: string }[]
      | undefined
    expect(generated?.some((p) => p.employee.id === employeeId)).toBe(true)
    expect(generated?.find((p) => p.employee.id === employeeId)?.minioObjectKey).toEqual(
      expect.any(String),
    )
  })

  // [INT-3-3] No active employees returns empty list without error
  it('returns an empty generated list without error when there are no employees for the period', async () => {
    const { status, body } = await graphql(GENERATE_PAYSLIPS_MUTATION, {
      input: { month: 12, year: 1999 },
    })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.generatePayslips?.failed).toEqual([])
  })
})
