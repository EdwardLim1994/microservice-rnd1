import { useMutation } from '@apollo/client/react';
import {
  ASSIGN_SUPERVISOR_MUTATION,
  type AssignSupervisorInput,
  type AssignSupervisorResult,
  EMPLOYEES_QUERY,
} from '../types/repository';

export function useAssignSupervisor() {
  const [assignSupervisorMutation, { loading, error, reset }] = useMutation<
    AssignSupervisorResult,
    AssignSupervisorInput
  >(ASSIGN_SUPERVISOR_MUTATION);

  return {
    // refetchQueries — same reasoning as useRegisterEmployee: the mutation updates the Employee
    // entity's normalized cache fields, but the ROOT_QUERY.employees list needs its own refetch.
    // awaitRefetchQueries — the caller closes this modal right after the mutation resolves; without
    // this, the refetch is still in flight when the modal (and EmployeesPage's row) unmounts,
    // leaving the Supervisor column briefly stale.
    assignSupervisor: (input: AssignSupervisorInput) =>
      assignSupervisorMutation({
        variables: input,
        refetchQueries: [{ query: EMPLOYEES_QUERY }],
        awaitRefetchQueries: true,
      }),
    loading,
    error,
    reset,
  };
}
