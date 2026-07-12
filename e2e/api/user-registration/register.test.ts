import { describe, expect, it } from 'vitest'

// Black-box e2e coverage for US-01 (User Registration), driven entirely through Apollo Router —
// never calls servers/auth directly. Expected to fail until FEAT-01 (register mutation) and
// FEAT-02 (Apollo Router wiring) are both implemented and merged.
// See .openspec/requirements/release/integration-testing/requirements.yaml — US-01 / auth.api.graphql

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`

const REGISTER_MUTATION = `
  mutation Register($email: String!, $password: String!) {
    register(email: $email, password: $password) {
      success
      message
    }
  }
`

async function callRegister(email: string, password: string) {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: REGISTER_MUTATION, variables: { email, password } }),
  })
  const body = await res.json()
  return { status: res.status, body }
}

function uniqueEmail() {
  return `e2e-register-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

describe('US-01 User Registration — API', () => {
  // [E2E-US01-01] Successful registration
  it('creates an account in authentik and returns success on valid input', async () => {
    const { status, body } = await callRegister(uniqueEmail(), 'A-Valid-Password-123!')
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.register).toEqual({ success: true, message: expect.any(String) })
  })

  // [E2E-US01-02] Duplicate email
  it('returns a duplicate email error when the email is already registered', async () => {
    const email = uniqueEmail()
    const first = await callRegister(email, 'A-Valid-Password-123!')
    expect(first.body.data?.register?.success).toBe(true)

    const second = await callRegister(email, 'A-Valid-Password-123!')
    expect(second.body.errors).toBeDefined()
    expect(second.body.errors[0].message.toLowerCase()).toMatch(/duplicate|already|taken|exists/)
  })

  // [E2E-US01-03] Empty email field
  it('returns a validation error for an empty email', async () => {
    const { body } = await callRegister('', 'A-Valid-Password-123!')
    expect(body.errors).toBeDefined()
  })

  // [E2E-US01-04] Empty password field
  it('returns a validation error for an empty password', async () => {
    const { body } = await callRegister(uniqueEmail(), '')
    expect(body.errors).toBeDefined()
  })
})
