import { ApolloProvider } from '@apollo/client/react';
import { useState } from 'react';
import { GRAPHQL_URL } from './config/env';
import { createApolloClient } from './lib/apolloClient';
import { EmployeesPage, RegisterEmployeeModal } from './modules/employee';
import './App.css';

const apolloClient = createApolloClient(GRAPHQL_URL);

const App = () => {
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  return (
    <ApolloProvider client={apolloClient}>
      <div className="content">
        <h1>hr-portal</h1>
        <button
          type="button"
          data-testid="open-register-employee-modal"
          onClick={() => setIsRegisterModalOpen(true)}
        >
          Register Employee
        </button>
        <RegisterEmployeeModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
        />
        <EmployeesPage />
      </div>
    </ApolloProvider>
  );
};

export default App;
