import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-02 (User Sign In), driven entirely through Apollo Router — never
// calls servers/auth directly. Expected to fail until FEAT-05 (login mutation) is implemented and
// merged. Relies on a registered user existing in authentik — registers one via the register
// mutation (US-01) as setup, since login has no other provisioning path in this suite.
// See .openspec/requirements/release/integration-testing/requirements.yaml — US-02 / auth.api.graphql

// Apollo Router's direct host-port publish (services/apollo/docker-compose.yml), not its
// Traefik `*.localhost` route — Node's own `dns.lookup` (this suite runs under Vitest/Node, not
// a browser) does not resolve arbitrary `*.localhost` subdomains per RFC 6761 the way
// browsers/curl/Bun do (confirmed empirically: only the exact string "localhost" is
// special-cased, "graphql.localhost" throws ENOTFOUND). See cypress.config.ts's own comment for
// the same reasoning on the browser side.
const BASE_URL = process.env.GRAPHQL_URL ?? 'http://localhost:4000'
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

async function graphql(query: string, variables: Record<string, unknown>) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return { status: res.status, body: await res.json() }
}

function uniqueEmail() {
  return `e2e-login-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

const VALID_PASSWORD = 'A-Valid-Password-123!'

async function registerTestUser() {
  const email = uniqueEmail()
  const { body } = await graphql(REGISTER_MUTATION, { email, password: VALID_PASSWORD })
  if (!body.data?.register?.success) {
    throw new Error(`Setup failed: could not register test user ${email}: ${JSON.stringify(body)}`)
  }
  return email
}

describe('US-02 User Sign In — API', () => {
  // [E2E-US02-01] Successful sign in
  it('returns a full token set for a registered user with correct credentials', async () => {
    const email = await registerTestUser()
    const { status, body } = await graphql(LOGIN_MUTATION, { email, password: VALID_PASSWORD })
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.login).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      idToken: expect.any(String),
    })
  })

  // [E2E-US02-02] Incorrect password
  it('returns an invalid credentials error for an incorrect password', async () => {
    const email = await registerTestUser()
    const { body } = await graphql(LOGIN_MUTATION, { email, password: 'wrong-password' })
    expect(body.errors).toBeDefined()
    expect(body.data?.login).toBeFalsy()
  })

  // [E2E-US02-03] Non-existent email
  it('returns an invalid credentials error for a non-existent email', async () => {
    const { body } = await graphql(LOGIN_MUTATION, {
      email: uniqueEmail(),
      password: VALID_PASSWORD,
    })
    expect(body.errors).toBeDefined()
    expect(body.data?.login).toBeFalsy()
  })

  // [E2E-US02-04] Empty fields
  it('returns a validation error for empty email and password', async () => {
    const { body } = await graphql(LOGIN_MUTATION, { email: '', password: '' })
    expect(body.errors).toBeDefined()
  })
})
