import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-03 (User Sign Out), driven entirely through Apollo Router — never
// calls servers/auth directly. Expected to fail until FEAT-07 (logout mutation) is implemented and
// merged (the mutation this suite calls, logout(accessToken), does not exist on the current
// servers/auth schema yet — it still exposes signOut(refreshToken); FEAT-07's job is to add
// logout as the spec below describes). Registers + signs in a fresh user via direct GraphQL calls
// as setup, since logout has no other provisioning path in this suite.
// See .openspec/requirements/release/integration-testing/requirements.yaml — US-03 / auth.api.graphql

// Apollo Router is routed through Traefik at graphql.localhost (see services/traefik/CLAUDE.md)
// — there is no bare-`localhost` route for it, so this must not default to one.
const BASE_URL = process.env.GRAPHQL_URL ?? 'http://graphql.localhost'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_MUTATION = `
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      success
      message
    }
  }
`

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      idToken
    }
  }
`

const LOGOUT_MUTATION = `
  mutation Logout($accessToken: String!) {
    logout(accessToken: $accessToken) {
      success
      message
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
  return `e2e-logout-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

const VALID_PASSWORD = 'A-Valid-Password-123!'

async function registerAndSignIn(): Promise<string> {
  const email = uniqueEmail()
  const registerResult = await graphql(REGISTER_MUTATION, { email, password: VALID_PASSWORD })
  if (!registerResult.body.data?.register?.success) {
    throw new Error(`Setup failed: could not register test user ${email}`)
  }
  const loginResult = await graphql(LOGIN_MUTATION, { email, password: VALID_PASSWORD })
  const accessToken = loginResult.body.data?.login?.accessToken
  if (!accessToken) {
    throw new Error(`Setup failed: could not sign in test user ${email}`)
  }
  return accessToken
}

describe('US-03 User Sign Out — API', () => {
  // [E2E-US03-01] Successful sign out
  it('invalidates the session and returns success for a valid access token', async () => {
    const accessToken = await registerAndSignIn()
    const { status, body } = await graphql(LOGOUT_MUTATION, { accessToken })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.logout).toEqual({ success: true, message: expect.any(String) })
  })

  // [E2E-US03-02] Session invalidated in authentik — reusing the same token a second time fails
  it('returns an invalid/expired token error when the same token is used again', async () => {
    const accessToken = await registerAndSignIn()
    const first = await graphql(LOGOUT_MUTATION, { accessToken })
    expect(first.body.data?.logout?.success).toBe(true)

    const second = await graphql(LOGOUT_MUTATION, { accessToken })
    expect(second.body.errors).toBeDefined()
  })

  // [E2E-US03-03] Malformed or missing token
  it('returns a clear error for a malformed token', async () => {
    const { body } = await graphql(LOGOUT_MUTATION, { accessToken: 'not-a-real-token' })
    expect(body.errors).toBeDefined()
  })
})
