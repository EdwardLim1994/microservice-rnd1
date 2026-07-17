import { gql } from '@apollo/client';

export const EMPLOYEES_QUERY = gql`
  query Employees {
    employees {
      id
      fullName
      employeeId
    }
  }
`;

export const REGISTER_EMPLOYEE_MUTATION = gql`
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee {
        id
        fullName
        employeeId
      }
      temporaryPassword
    }
  }
`;
