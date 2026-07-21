import { useQuery } from '@apollo/client/react';
import { EMPLOYEES_QUERY, type EmployeesResult } from '../types/repository';

export function useEmployees(options?: { skip?: boolean }) {
  const { data, loading, error } = useQuery<EmployeesResult>(EMPLOYEES_QUERY, {
    skip: options?.skip,
  });

  return {
    employees: data?.employees ?? [],
    loading,
    error,
  };
}
