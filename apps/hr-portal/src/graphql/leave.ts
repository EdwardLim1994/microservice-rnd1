import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

export type LeaveType = 'ANNUAL' | 'MEDICAL' | 'EMERGENCY';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  employee: { id: string };
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  submittedAt: string;
  reviewedBy: { id: string } | null;
  reviewedAt: string | null;
}

export interface LeaveRequestsQueryData {
  leaveRequests: LeaveRequest[];
}

export interface LeaveRequestsQueryVariables {
  employeeId: string;
}

export const LEAVE_REQUESTS_QUERY: TypedDocumentNode<
  LeaveRequestsQueryData,
  LeaveRequestsQueryVariables
> = gql`
  query LeaveRequests($employeeId: ID!) {
    leaveRequests(employeeId: $employeeId) {
      id
      leaveType
      startDate
      endDate
      reason
      status
      submittedAt
    }
  }
`;

export interface SubmitLeaveInput {
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface SubmitLeaveData {
  submitLeave: LeaveRequest;
}

export interface SubmitLeaveVariables {
  input: SubmitLeaveInput;
}

export const SUBMIT_LEAVE_MUTATION: TypedDocumentNode<
  SubmitLeaveData,
  SubmitLeaveVariables
> = gql`
  mutation SubmitLeave($input: SubmitLeaveInput!) {
    submitLeave(input: $input) {
      id
      leaveType
      startDate
      endDate
      reason
      status
      submittedAt
    }
  }
`;

export interface PendingLeaveRequestsQueryData {
  pendingLeaveRequestsForSupervisor: LeaveRequest[];
}

export interface PendingLeaveRequestsQueryVariables {
  supervisorId: string;
}

export const PENDING_LEAVE_REQUESTS_QUERY: TypedDocumentNode<
  PendingLeaveRequestsQueryData,
  PendingLeaveRequestsQueryVariables
> = gql`
  query PendingLeaveRequestsForSupervisor($supervisorId: ID!) {
    pendingLeaveRequestsForSupervisor(supervisorId: $supervisorId) {
      id
      employee {
        id
      }
      leaveType
      startDate
      endDate
      reason
      status
      submittedAt
    }
  }
`;

export type LeaveDecision = 'APPROVED' | 'REJECTED';

export interface ReviewLeaveInput {
  leaveRequestId: string;
  supervisorId: string;
  decision: LeaveDecision;
}

export interface ReviewLeaveData {
  reviewLeave: LeaveRequest;
}

export interface ReviewLeaveVariables {
  input: ReviewLeaveInput;
}

export const REVIEW_LEAVE_MUTATION: TypedDocumentNode<
  ReviewLeaveData,
  ReviewLeaveVariables
> = gql`
  mutation ReviewLeave($input: ReviewLeaveInput!) {
    reviewLeave(input: $input) {
      id
      status
    }
  }
`;
