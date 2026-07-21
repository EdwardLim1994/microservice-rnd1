import { describe, expect, it } from 'vitest'

// Black-box UAT coverage for US-2 / FEAT-4 (Sign in), driven entirely through Apollo Router.
// Expected to fail until FEAT-4 (signIn mutation) is implemented and merged.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-2 / FEAT-4
//
// Relies on a registered employee existing in Authentik — registers one via employee-subgraph's
// registerEmployee mutation (US-1) as setup, since signIn has no other provisioning path in this
// suite. A freshly registered employee's Authentik account always has mustChangePassword: true,
// so this file covers [INT-2-1] and the "temporary credentials" half of the sign-in contract;
// the "mustChangePassword: false" half ([E2E-2-1]) is covered in ./change-password.test.ts,
// chained after a successful password change.

const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_EMPLOYEE_MUTATION = `
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee { id email }
      temporaryPassword
    }
  }
`

const SIGN_IN_MUTATION = `
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      accessToken
      mustChangePassword
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

function uniqueEmail() {
  return `e2e-sign-in-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerEmployee() {
  const email = uniqueEmail()
  const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      firstName: 'Sign',
      lastName: 'Fixture',
      gender: 'OTHER',
      email,
      grossSalary: 4000,
      salaryPerDay: 150,
    },
  })
  const temporaryPassword = body.data?.registerEmployee?.temporaryPassword as string | undefined
  if (!temporaryPassword) {
    throw new Error(`Setup failed: could not register test employee ${email}: ${JSON.stringify(body)}`)
  }
  return { email, temporaryPassword }
}

describe('US-2 Sign In — UAT', () => {
  // [INT-2-1] Valid credentials return a non-empty JWT and a mustChangePassword boolean
  it('returns a non-empty JWT and mustChangePassword true for a newly registered employee', async () => {
    const { email, temporaryPassword } = await registerEmployee()

    const { status, body } = await graphql(SIGN_IN_MUTATION, { email, password: temporaryPassword })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.signIn?.accessToken).toEqual(expect.any(String))
    expect(body.data.signIn.accessToken.length).toBeGreaterThan(0)
    expect(body.data?.signIn?.mustChangePassword).toBe(true)
  })

  // [FEAT-4 edge case] Invalid credentials
  it('returns an UNAUTHENTICATED error for an incorrect password', async () => {
    const { email } = await registerEmployee()

    const { body } = await graphql(SIGN_IN_MUTATION, { email, password: 'wrong-password' })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('UNAUTHENTICATED')
  })

  // [FEAT-4 edge case] Invalid credentials — non-existent email
  it('returns an UNAUTHENTICATED error for a non-existent email', async () => {
    const { body } = await graphql(SIGN_IN_MUTATION, {
      email: uniqueEmail(),
      password: 'irrelevant',
    })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('UNAUTHENTICATED')
  })

  // [FEAT-4 edge case] Missing email or password
  it('returns a BAD_USER_INPUT error for an empty email and password', async () => {
    const { body } = await graphql(SIGN_IN_MUTATION, { email: '', password: '' })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })
})
