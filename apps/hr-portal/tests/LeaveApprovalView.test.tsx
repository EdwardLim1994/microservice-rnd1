import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GraphQLError } from 'graphql';
import { LeaveApprovalView } from '../src/components/LeaveApprovalView';
import {
  PENDING_LEAVE_REQUESTS_QUERY,
  REVIEW_LEAVE_MUTATION,
} from '../src/graphql/leave';

const SUPERVISOR_ID = 'sup-1';

const oneRequest = {
  id: 'leave-1',
  employee: { id: 'emp-1' },
  leaveType: 'ANNUAL',
  startDate: '2026-08-01',
  endDate: '2026-08-05',
  reason: 'Family vacation',
  status: 'PENDING',
  submittedAt: '2026-07-01T00:00:00.000Z',
};

const emptyPendingMock = {
  request: {
    query: PENDING_LEAVE_REQUESTS_QUERY,
    variables: { supervisorId: SUPERVISOR_ID },
  },
  result: { data: { pendingLeaveRequestsForSupervisor: [] } },
};

const onePendingMock = {
  request: {
    query: PENDING_LEAVE_REQUESTS_QUERY,
    variables: { supervisorId: SUPERVISOR_ID },
  },
  result: { data: { pendingLeaveRequestsForSupervisor: [oneRequest] } },
};

// Edge case: no pending requests
test('shows an empty state when there are no pending requests', async () => {
  render(
    <MockedProvider mocks={[emptyPendingMock]}>
      <LeaveApprovalView supervisorId={SUPERVISOR_ID} />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('pending-leave-empty')).toBeInTheDocument();
  });
});

// [INT-12-1] Pending leave requests from direct reports appear in table
test('lists pending leave requests', async () => {
  render(
    <MockedProvider mocks={[onePendingMock]}>
      <LeaveApprovalView supervisorId={SUPERVISOR_ID} />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('pending-leave-table')).toBeInTheDocument();
  });
  expect(screen.getAllByTestId('pending-leave-row')).toHaveLength(1);
});

// [E2E-3 / INT-12-2] Approve action calls ReviewLeave and removes row from pending list
test('approves a pending leave request via the confirmation modal', async () => {
  const reviewMock = {
    request: {
      query: REVIEW_LEAVE_MUTATION,
      variables: {
        input: {
          leaveRequestId: 'leave-1',
          supervisorId: SUPERVISOR_ID,
          decision: 'APPROVED',
        },
      },
    },
    result: { data: { reviewLeave: { id: 'leave-1', status: 'APPROVED' } } },
  };

  render(
    <MockedProvider mocks={[onePendingMock, reviewMock]}>
      <LeaveApprovalView supervisorId={SUPERVISOR_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getAllByTestId('pending-leave-row')).toHaveLength(1),
  );
  fireEvent.click(screen.getByTestId('approve-button'));
  expect(screen.getByTestId('review-confirm-modal')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('review-confirm-button'));

  await waitFor(() => {
    expect(screen.queryByTestId('pending-leave-row')).not.toBeInTheDocument();
  });
});

// [INT-12-3] Already-reviewed request shows stale data error and refreshes table
test('shows a stale data error when the request was already reviewed', async () => {
  const staleReviewMock = {
    request: {
      query: REVIEW_LEAVE_MUTATION,
      variables: {
        input: {
          leaveRequestId: 'leave-1',
          supervisorId: SUPERVISOR_ID,
          decision: 'APPROVED',
        },
      },
    },
    result: {
      errors: [
        new GraphQLError('conflict', { extensions: { code: 'CONFLICT' } }),
      ],
    },
  };
  const refetchedEmptyMock = emptyPendingMock;

  render(
    <MockedProvider
      mocks={[onePendingMock, staleReviewMock, refetchedEmptyMock]}
    >
      <LeaveApprovalView supervisorId={SUPERVISOR_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getAllByTestId('pending-leave-row')).toHaveLength(1),
  );
  fireEvent.click(screen.getByTestId('approve-button'));
  fireEvent.click(screen.getByTestId('review-confirm-button'));

  await waitFor(() => {
    expect(screen.getByTestId('stale-data-error')).toBeInTheDocument();
  });
});

// Edge case: network failure reverts optimistic update
test('shows an error banner and reverts the optimistic update on network failure', async () => {
  const failedReviewMock = {
    request: {
      query: REVIEW_LEAVE_MUTATION,
      variables: {
        input: {
          leaveRequestId: 'leave-1',
          supervisorId: SUPERVISOR_ID,
          decision: 'APPROVED',
        },
      },
    },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[onePendingMock, failedReviewMock]}>
      <LeaveApprovalView supervisorId={SUPERVISOR_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getAllByTestId('pending-leave-row')).toHaveLength(1),
  );
  fireEvent.click(screen.getByTestId('approve-button'));
  fireEvent.click(screen.getByTestId('review-confirm-button'));

  await waitFor(() => {
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });
  expect(screen.getAllByTestId('pending-leave-row')).toHaveLength(1);
});
