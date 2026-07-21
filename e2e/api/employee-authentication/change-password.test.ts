import { describe, expect, it } from 'vitest'

// Black-box UAT coverage for US-2 / FEAT-5 (First-time forced password change), driven entirely
// through Apollo Router. Expected to fail until FEAT-4 (signIn) and FEAT-5 (changePassword) are
// implemented and merged.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-2 / FEAT-5
//
// Also covers [E2E-2-1] (sign-in with an established, non-temporary password reflects
// mustChangePassword: false) by chaining: register → signIn (temp password, mustChangePassword
// true) → changePassword → signIn again (new password, mustChangePassword false) — there is no
// other way to produce a mustChangePassword: false account through the public API alone.

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

const CHANGE_PASSWORD_MUTATION = `
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
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
  return `e2e-change-password-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

const NEW_PASSWORD = 'A-New-Valid-Password-456!'

async function registerAndSignIn() {
  const email = uniqueEmail()
  const { body: registerBody } = await graphql(REGISTER_EMPLOYEE_MUTATION, {
    input: {
      firstName: 'Change',
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

  return { email, temporaryPassword, accessToken }
}

describe('US-2 First-time forced password change — UAT', () => {
  // [INT-2-2] Correct currentPassword and a valid differing newPassword succeeds
  // [E2E-2-2] Portal renders change-password screen (mustChangePassword true precondition,
  // asserted via ./sign-in.test.ts), then a successful change clears the flag
  it('returns success true when the current password is correct and the new password differs', async () => {
    const { temporaryPassword, accessToken } = await registerAndSignIn()

    const { status, body } = await graphql(
      CHANGE_PASSWORD_MUTATION,
      { currentPassword: temporaryPassword, newPassword: NEW_PASSWORD },
      accessToken,
    )
    expect(status).toBe(200)
    expect(body.errors).toBeUndefined()
    expect(body.data?.changePassword?.success).toBe(true)
  })

  // [E2E-2-1] After a successful password change, signing in again reflects mustChangePassword: false
  it('clears mustChangePassword — signing in with the new password reflects mustChangePassword false', async () => {
    const { email, temporaryPassword, accessToken } = await registerAndSignIn()

    await graphql(
      CHANGE_PASSWORD_MUTATION,
      { currentPassword: temporaryPassword, newPassword: NEW_PASSWORD },
      accessToken,
    )

    const { body } = await graphql(SIGN_IN_MUTATION, { email, password: NEW_PASSWORD })
    expect(body.errors).toBeUndefined()
    expect(body.data?.signIn?.mustChangePassword).toBe(false)
  })

  // [FEAT-5 edge case] currentPassword mismatch
  it('returns an UNAUTHENTICATED error when currentPassword does not match', async () => {
    const { accessToken } = await registerAndSignIn()

    const { body } = await graphql(
      CHANGE_PASSWORD_MUTATION,
      { currentPassword: 'wrong-current-password', newPassword: NEW_PASSWORD },
      accessToken,
    )
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('UNAUTHENTICATED')
  })

  // [FEAT-5 edge case] newPassword identical to currentPassword
  it('returns a BAD_USER_INPUT error when newPassword is identical to currentPassword', async () => {
    const { temporaryPassword, accessToken } = await registerAndSignIn()

    const { body } = await graphql(
      CHANGE_PASSWORD_MUTATION,
      { currentPassword: temporaryPassword, newPassword: temporaryPassword },
      accessToken,
    )
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions?.code).toBe('BAD_USER_INPUT')
  })
})
