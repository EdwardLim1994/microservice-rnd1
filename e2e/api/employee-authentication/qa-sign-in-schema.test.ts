import { describe, expect, it } from 'vitest'

// QA integration coverage for FEAT-4 (Sign in) — derived from reading the actual implementation
// (servers/auth/src/usecases/SignInUseCase.ts, servers/auth/src/schemas/graphql/auth.graphql),
// not from OpenSpec.
// Verifies the implementation works correctly — the UAT suite in ./sign-in.test.ts covers
// business requirements from OpenSpec and only selects accessToken/mustChangePassword; this
// covers the full AuthPayload schema shape (every field SignInUseCase actually returns) and an
// edge case reading the implementation revealed: the `!email || !password` check rejects either
// field missing individually, not just both — the UAT suite only exercises both-empty.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — FEAT-4, and PR #235/#237 for the
// implementation this was derived from.

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

const SIGN_IN_FULL_SHAPE_MUTATION = `
  mutation SignIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) {
      accessToken
      refreshToken
      idToken
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
  return `e2e-qa-sign-in-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerEmployee() {
  const email = uniqueEmail()
  const { body } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      firstName: 'SignIn',
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

describe('FEAT-4 Sign in — QA schema/implementation coverage', () => {
  it('returns every field AuthPayload actually exposes, correctly populated', async () => {
    const { email, temporaryPassword } = await registerEmployee()

    const { status, body } = await graphql(SIGN_IN_FULL_SHAPE_MUTATION, {
      email,
      password: temporaryPassword,
    })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()

    const payload = body.data?.signIn
    expect(payload.accessToken).toEqual(expect.any(String))
    expect(payload.accessToken.length).toBeGreaterThan(0)
    expect(payload.refreshToken).toEqual(expect.any(String))
    expect(payload.idToken).toEqual(expect.any(String))
    expect(payload.mustChangePassword).toBe(true)
  })

  it('returns an idToken shaped like a real JWT (three dot-separated segments)', async () => {
    const { email, temporaryPassword } = await registerEmployee()

    const { body } = await graphql(SIGN_IN_FULL_SHAPE_MUTATION, { email, password: temporaryPassword })
    const idToken = body.data?.signIn?.idToken as string
    expect(idToken.split('.')).toHaveLength(3)
  })

  it('returns a BAD_USER_INPUT error when only the password is missing', async () => {
    const { email } = await registerEmployee()

    const { body } = await graphql(SIGN_IN_FULL_SHAPE_MUTATION, { email, password: '' })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })

  it('returns a BAD_USER_INPUT error when only the email is missing', async () => {
    const { temporaryPassword } = await registerEmployee()

    const { body } = await graphql(SIGN_IN_FULL_SHAPE_MUTATION, { email: '', password: temporaryPassword })
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })
})
