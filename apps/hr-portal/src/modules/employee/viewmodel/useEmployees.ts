import { useQuery } from '@apollo/client/react';
import { EMPLOYEES_QUERY, type EmployeesResult } from '../types/repository';

export function useEmployees() {
  const { data, loading, error } = useQuery<EmployeesResult>(EMPLOYEES_QUERY);

  return {
    employees: data?.employees ?? [],
    loading,
    error,
  };
}
