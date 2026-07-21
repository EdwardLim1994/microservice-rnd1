import { gql } from '@apollo/client';

export const REGISTER_EMPLOYEE_MUTATION = gql`
  mutation RegisterEmployee($input: RegisterEmployeeInput!) {
    registerEmployee(input: $input) {
      employee {
        id
        firstName
        lastName
        email
      }
      temporaryPassword
    }
  }
`;

export interface RegisterEmployeeInput {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  grossSalary: number;
  salaryPerDay: number;
  supervisorId?: string;
}

export interface RegisterEmployeeResult {
  registerEmployee: {
    employee: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    temporaryPassword: string;
  };
}

export const EMPLOYEES_QUERY = gql`
  query Employees {
    employees {
      id
      firstName
      lastName
      email
      grossSalary
      supervisor {
        id
        firstName
        lastName
      }
    }
  }
`;

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grossSalary: number;
  supervisor: { id: string; firstName: string; lastName: string } | null;
}

export interface EmployeesResult {
  employees: Employee[];
}

export const ASSIGN_SUPERVISOR_MUTATION = gql`
  mutation AssignSupervisor($employeeId: ID!, $supervisorId: ID!) {
    assignSupervisor(employeeId: $employeeId, supervisorId: $supervisorId) {
      id
      supervisor {
        id
        firstName
        lastName
      }
    }
  }
`;

export interface AssignSupervisorInput {
  employeeId: string;
  supervisorId: string;
}

export interface AssignSupervisorResult {
  assignSupervisor: {
    id: string;
    supervisor: { id: string; firstName: string; lastName: string } | null;
  };
}
