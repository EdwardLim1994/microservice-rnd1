import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

export interface EmployeeOption {
  id: string;
  fullName: string;
  employeeId: string;
}

export interface EmployeesQueryData {
  employees: EmployeeOption[];
}

export const EMPLOYEES_QUERY: TypedDocumentNode<EmployeesQueryData> = gql`
  query Employees {
    employees {
      id
      fullName
      employeeId
    }
  }
`;

export interface RegisterEmployeeInput {
  fullName: string;
  employeeId: string;
  role: string;
  department: string;
  grossSalary: number;
  supervisorId: string | null;
}

export interface RegisterEmployeeResponse {
  registerEmployee: {
    employee: { id: string; fullName: string; employeeId: string };
    temporaryPassword: string;
  };
}

export interface RegisterEmployeeVariables {
  input: RegisterEmployeeInput;
}

export const REGISTER_EMPLOYEE_MUTATION: TypedDocumentNode<
  RegisterEmployeeResponse,
  RegisterEmployeeVariables
> = gql`
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
