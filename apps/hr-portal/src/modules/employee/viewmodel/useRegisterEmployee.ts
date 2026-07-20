import { useMutation } from '@apollo/client/react';
import {
  REGISTER_EMPLOYEE_MUTATION,
  type RegisterEmployeeInput,
  type RegisterEmployeeResult,
} from '../types/repository';

export function useRegisterEmployee() {
  const [registerEmployee, { data, loading, error, reset }] = useMutation<
    RegisterEmployeeResult,
    { input: RegisterEmployeeInput }
  >(REGISTER_EMPLOYEE_MUTATION);

  return {
    registerEmployee: (input: RegisterEmployeeInput) =>
      registerEmployee({ variables: { input } }),
    result: data?.registerEmployee,
    loading,
    error,
    reset,
  };
}
