import { useMutation } from '@apollo/client/react';
import {
  REGISTER_MUTATION,
  type RegisterMutationResult,
  type RegisterMutationVariables,
} from '../types/repository';

export function useRegister(): useMutation.ResultTuple<
  RegisterMutationResult,
  RegisterMutationVariables
> {
  return useMutation<RegisterMutationResult, RegisterMutationVariables>(
    REGISTER_MUTATION,
  );
}
