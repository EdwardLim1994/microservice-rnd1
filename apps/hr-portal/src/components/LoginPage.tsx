import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { type SyntheticEvent, useState } from 'react';
import { EMPLOYEES_FOR_LOGIN_QUERY, LOGIN_MUTATION } from '../graphql/auth';
import { setSession } from '../lib/session';

interface LoginPageProps {
  // ponytail: real navigation defaults to a plain location change, same "no router-context
  // dependency" convention as NotificationBell's click-to-navigate — keeps this testable
  // without a RouterProvider. Accepting it as a prop lets tests observe the redirect instead.
  onLoginSuccess?: () => void;
}

export function LoginPage({
  onLoginSuccess = () => globalThis.location?.assign('/'),
}: LoginPageProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [credentialsError, setCredentialsError] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const apolloClient = useApolloClient();
  const [login, { loading }] = useMutation(LOGIN_MUTATION);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setCredentialsError(false);
    setBannerError(null);

    try {
      const { data } = await login({ variables: { email, password } });
      if (!data) throw new Error('login returned no data');

      // The Authentik account's email is `${employeeId}@employees.local` (see
      // RegisterEmployeeUseCase) — the part before '@' is the employee-subgraph employeeId.
      const employeeId = email.split('@')[0];
      const { data: employeesData } = await apolloClient.query({
        query: EMPLOYEES_FOR_LOGIN_QUERY,
        fetchPolicy: 'network-only',
      });
      if (!employeesData) throw new Error('employees query returned no data');
      const employee = employeesData.employees.find(
        (candidate) => candidate.employeeId === employeeId,
      );
      if (!employee) {
        setBannerError(
          'No employee record found for this account. Contact HR.',
        );
        return;
      }
      const isSupervisor = employeesData.employees.some(
        (candidate) => candidate.supervisor?.id === employee.id,
      );

      setSession({
        employeeId: employee.id,
        isSupervisor,
        accessToken: data.login.accessToken,
      });
      onLoginSuccess();
    } catch (error) {
      const code = CombinedGraphQLErrors.is(error)
        ? error.errors[0]?.extensions?.code
        : undefined;
      if (code === 'INVALID_CREDENTIALS') {
        setCredentialsError(true);
      } else {
        setBannerError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {bannerError && <div data-testid="error-banner">{bannerError}</div>}

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        data-testid="email-input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        data-testid="password-input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {credentialsError && (
        <div data-testid="credentials-error">Invalid email or password</div>
      )}

      <button type="submit" data-testid="login-button" disabled={loading}>
        {loading ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
