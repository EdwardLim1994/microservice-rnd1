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
    assignSupervisor: (input: AssignSupervisorInput) =>
      assignSupervisorMutation({
        variables: input,
        refetchQueries: [{ query: EMPLOYEES_QUERY }],
      }),
    loading,
    error,
    reset,
  };
}
