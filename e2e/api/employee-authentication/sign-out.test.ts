import { describe, expect, it } from 'vitest'

// Black-box UAT coverage for US-2 / FEAT-6 (Sign out), driven entirely through Apollo Router.
// Expected to fail until FEAT-4 (signIn) and FEAT-6 (signOut) are implemented and merged.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-2 / FEAT-6

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

const SIGN_OUT_MUTATION = `
  mutation SignOut {
    signOut {
      success
    }
  }
`

async function graphql(query: string, variables: Record<string, unknown>, accessToken?: string) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })
  return { status: res.status, body: await res.json() }
}

function uniqueEmail() {
  return `e2e-sign-out-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerAndSignIn() {
  const email = uniqueEmail()
  const { body: registerBody } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      firstName: 'Signout',
      lastName: 'Fixture',
      gender: 'OTHER',
      email,
      grossSalary: 4000,
      salaryPerDay: 150,
    },
  })
  const temporaryPassword = registerBody.data?.registerEmployee?.temporaryPassword as
    | string
    | undefined
  if (!temporaryPassword) {
    throw new Error(`Setup failed: could not register test employee ${email}: ${JSON.stringify(registerBody)}`)
  }

  const { body: signInBody } = await graphql(SIGN_IN_MUTATION, { email, password: temporaryPassword })
  const accessToken = signInBody.data?.signIn?.accessToken as string | undefined
  if (!accessToken) {
    throw new Error(`Setup failed: could not sign in as ${email}: ${JSON.stringify(signInBody)}`)
  }

  return accessToken
}

describe('US-2 Sign Out — UAT', () => {
  // [INT-2-3 / E2E-2-3] Valid JWT — signOut returns success true
  it('returns success true for a valid JWT', async () => {
    const accessToken = await registerAndSignIn()

    const { status, body } = await graphql(SIGN_OUT_MUTATION, {}, accessToken)
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.signOut?.success).toBe(true)
  })

  // [FEAT-6 edge case] Already-expired token must still return success (idempotent)
  it('returns success true (idempotent) for an already-expired/invalid token', async () => {
    const { body } = await graphql(SIGN_OUT_MUTATION, {}, 'expired.or.invalid.token')
    expect(body.errors).toBeUndefined()
    expect(body.data?.signOut?.success).toBe(true)
  })
})

describe('US-2 acceptance criteria — sign-up endpoint inaccessible', () => {
  // Acceptance criterion: the public self-service sign-up endpoint is inaccessible via Apollo
  // Router (marked @inaccessible in the auth subgraph schema).
  it('rejects a signUp mutation as an unknown field on the composed supergraph', async () => {
    const { body } = await graphql(
      `mutation SignUp($email: String!, $password: String!) {
        signUp(email: $email, password: $password) { success }
      }`,
      { email: uniqueEmail(), password: 'irrelevant' },
    )
    expect(body.errors).toBeDefined()
  })
})
