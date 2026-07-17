import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaveRequestForm } from '../src/components/LeaveRequestForm';
import {
  LEAVE_REQUESTS_QUERY,
  SUBMIT_LEAVE_MUTATION,
} from '../src/graphql/leave';

const EMPLOYEE_ID = 'emp-1';

const emptyHistoryMock = {
  request: {
    query: LEAVE_REQUESTS_QUERY,
    variables: { employeeId: EMPLOYEE_ID },
  },
  result: { data: { leaveRequests: [] } },
};

function fillForm() {
  fireEvent.change(screen.getByTestId('leaveType-select'), {
    target: { value: 'ANNUAL' },
  });
  fireEvent.change(screen.getByTestId('startDate-input'), {
    target: { value: '2026-08-01' },
  });
  fireEvent.change(screen.getByTestId('endDate-input'), {
    target: { value: '2026-08-05' },
  });
  fireEvent.change(screen.getByTestId('reason-input'), {
    target: { value: 'Family vacation' },
  });
}

// [INT-11-3] Empty history shows empty state message
test('shows an empty state when there is no leave history', async () => {
  render(
    <MockedProvider mocks={[emptyHistoryMock]}>
      <LeaveRequestForm employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('leave-history-empty')).toBeInTheDocument();
  });
});

// [INT-11-2] End date before start date shows inline validation before submit
test('shows inline validation when end date is before start date', async () => {
  render(
    <MockedProvider mocks={[emptyHistoryMock]}>
      <LeaveRequestForm employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('apply-leave-button'));
  fillForm();
  fireEvent.change(screen.getByTestId('startDate-input'), {
    target: { value: '2026-08-10' },
  });
  fireEvent.change(screen.getByTestId('endDate-input'), {
    target: { value: '2026-08-01' },
  });
  fireEvent.click(screen.getByTestId('submit-leave-button'));

  await waitFor(() => {
    expect(screen.getByTestId('date-range-error')).toBeInTheDocument();
  });
});

// [INT-11-1] Valid leave submission appears in history table with Pending badge
test('valid submission refetches and shows the new request as Pending', async () => {
  const submitMock = {
    request: {
      query: SUBMIT_LEAVE_MUTATION,
      variables: {
        input: {
          employeeId: EMPLOYEE_ID,
          leaveType: 'ANNUAL',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
          reason: 'Family vacation',
        },
      },
    },
    result: {
      data: {
        submitLeave: {
          id: 'leave-1',
          leaveType: 'ANNUAL',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
          reason: 'Family vacation',
          status: 'PENDING',
          submittedAt: '2026-07-01T00:00:00.000Z',
        },
      },
    },
  };
  const refetchedHistoryMock = {
    request: {
      query: LEAVE_REQUESTS_QUERY,
      variables: { employeeId: EMPLOYEE_ID },
    },
    result: {
      data: {
        leaveRequests: [
          {
            id: 'leave-1',
            leaveType: 'ANNUAL',
            startDate: '2026-08-01',
            endDate: '2026-08-05',
            reason: 'Family vacation',
            status: 'PENDING',
            submittedAt: '2026-07-01T00:00:00.000Z',
          },
        ],
      },
    },
  };

  render(
    <MockedProvider
      mocks={[emptyHistoryMock, submitMock, refetchedHistoryMock]}
    >
      <LeaveRequestForm employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('leave-history-empty')).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByTestId('apply-leave-button'));
  fillForm();
  fireEvent.click(screen.getByTestId('submit-leave-button'));

  await waitFor(() => {
    expect(screen.getByTestId('leave-history-table')).toHaveTextContent(
      'Family vacation',
    );
  });
  expect(screen.getByTestId('leave-status-badge')).toHaveTextContent('Pending');
});

// Edge case: network failure preserves form state
test('shows an error banner and preserves form state on network failure', async () => {
  const failedSubmitMock = {
    request: {
      query: SUBMIT_LEAVE_MUTATION,
      variables: {
        input: {
          employeeId: EMPLOYEE_ID,
          leaveType: 'ANNUAL',
          startDate: '2026-08-01',
          endDate: '2026-08-05',
          reason: 'Family vacation',
        },
      },
    },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[emptyHistoryMock, failedSubmitMock]}>
      <LeaveRequestForm employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('leave-history-empty')).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByTestId('apply-leave-button'));
  fillForm();
  fireEvent.click(screen.getByTestId('submit-leave-button'));

  await waitFor(() => {
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
  });
  expect(screen.getByTestId('reason-input')).toHaveValue('Family vacation');
});
