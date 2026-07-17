import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

export interface AcknowledgementResult {
  success: boolean;
  message?: string | null;
}

export interface RequestPasswordResetData {
  requestPasswordReset: AcknowledgementResult;
}

export interface RequestPasswordResetVariables {
  input: { email: string };
}

export const REQUEST_PASSWORD_RESET_MUTATION: TypedDocumentNode<
  RequestPasswordResetData,
  RequestPasswordResetVariables
> = gql`
  mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input) {
      success
    }
  }
`;

export interface ConfirmPasswordResetData {
  confirmPasswordReset: AcknowledgementResult;
}

export interface ConfirmPasswordResetVariables {
  input: { resetToken: string; newPassword: string };
}

export const CONFIRM_PASSWORD_RESET_MUTATION: TypedDocumentNode<
  ConfirmPasswordResetData,
  ConfirmPasswordResetVariables
> = gql`
  mutation ConfirmPasswordReset($input: ConfirmPasswordResetInput!) {
    confirmPasswordReset(input: $input) {
      success
    }
  }
`;
