import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

export interface Payslip {
  id: string;
  month: number;
  year: number;
  minioObjectKey: string;
  generatedAt: string;
}

export interface PayslipsQueryData {
  payslips: Payslip[];
}

export interface PayslipsQueryVariables {
  employeeId: string;
}

export const PAYSLIPS_QUERY: TypedDocumentNode<
  PayslipsQueryData,
  PayslipsQueryVariables
> = gql`
  query Payslips($employeeId: ID!) {
    payslips(employeeId: $employeeId) {
      id
      month
      year
      generatedAt
    }
  }
`;

export interface GetPayslipURLInput {
  employeeId: string;
  month: number;
  year: number;
}

export interface PayslipDownloadURLData {
  payslipDownloadURL: { url: string; expiresAt: string };
}

export interface PayslipDownloadURLVariables {
  input: GetPayslipURLInput;
}

export const PAYSLIP_DOWNLOAD_URL_QUERY: TypedDocumentNode<
  PayslipDownloadURLData,
  PayslipDownloadURLVariables
> = gql`
  query PayslipDownloadURL($input: GetPayslipURLInput!) {
    payslipDownloadURL(input: $input) {
      url
      expiresAt
    }
  }
`;
