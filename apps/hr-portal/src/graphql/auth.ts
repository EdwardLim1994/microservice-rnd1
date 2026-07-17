import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

export interface LoginData {
  login: { accessToken: string; refreshToken: string; idToken: string };
}

export interface LoginVariables {
  email: string;
  password: string;
}

export const LOGIN_MUTATION: TypedDocumentNode<LoginData, LoginVariables> = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      idToken
    }
  }
`;

export interface LogoutData {
  logout: { success: boolean; message: string };
}

export interface LogoutVariables {
  accessToken: string;
}

export const LOGOUT_MUTATION: TypedDocumentNode<LogoutData, LogoutVariables> =
  gql`
  mutation Logout($accessToken: String!) {
    logout(accessToken: $accessToken) {
      success
    }
  }
`;

export interface EmployeeWithSupervisor {
  id: string;
  employeeId: string;
  supervisor: { id: string } | null;
}

export interface EmployeesForLoginData {
  employees: EmployeeWithSupervisor[];
}

export const EMPLOYEES_FOR_LOGIN_QUERY: TypedDocumentNode<EmployeesForLoginData> = gql`
  query EmployeesForLogin {
    employees {
      id
      employeeId
      supervisor {
        id
      }
    }
  }
`;
