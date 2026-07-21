import { useMutation } from '@apollo/client/react';
import {
  EMPLOYEES_QUERY,
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
    // refetchQueries — Apollo's normalized cache updates the new Employee entity itself (it has
    // an id) but has no way to know it belongs in the ROOT_QUERY.employees list, so without this
    // the Employees table (FEAT-2) silently misses newly-registered employees until reload.
    registerEmployee: (input: RegisterEmployeeInput) =>
      registerEmployee({
        variables: { input },
        refetchQueries: [{ query: EMPLOYEES_QUERY }],
      }),
    result: data?.registerEmployee,
    loading,
    error,
    reset,
  };
}
