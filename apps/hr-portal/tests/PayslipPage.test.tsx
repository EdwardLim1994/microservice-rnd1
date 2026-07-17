import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PayslipPage } from '../src/components/PayslipPage';
import {
  PAYSLIP_DOWNLOAD_URL_QUERY,
  PAYSLIPS_QUERY,
} from '../src/graphql/payslip';

const EMPLOYEE_ID = 'emp-1';

const onePayslip = {
  id: 'payslip-1',
  month: 7,
  year: 2026,
  generatedAt: '2026-07-01T00:00:00.000Z',
};

const emptyPayslipsMock = {
  request: { query: PAYSLIPS_QUERY, variables: { employeeId: EMPLOYEE_ID } },
  result: { data: { payslips: [] } },
};

const onePayslipMock = {
  request: { query: PAYSLIPS_QUERY, variables: { employeeId: EMPLOYEE_ID } },
  result: { data: { payslips: [onePayslip] } },
};

// [INT-13-3] No payslips shows empty state message
test('shows an empty state when there are no payslips', async () => {
  render(
    <MockedProvider mocks={[emptyPayslipsMock]}>
      <PayslipPage employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId('payslip-empty')).toBeInTheDocument();
  });
});

// [INT-13-1] Payslip list fetches and renders correctly
test('lists available payslips', async () => {
  render(
    <MockedProvider mocks={[onePayslipMock]}>
      <PayslipPage employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() => {
    expect(screen.getAllByTestId('payslip-row')).toHaveLength(1);
  });
});

// [E2E-5 / INT-13-2] Download button fetches presigned URL and triggers PDF download
test('fetches a presigned URL and triggers a download on click', async () => {
  const downloadUrlMock = {
    request: {
      query: PAYSLIP_DOWNLOAD_URL_QUERY,
      variables: { input: { employeeId: EMPLOYEE_ID, month: 7, year: 2026 } },
    },
    result: {
      data: {
        payslipDownloadURL: {
          url: 'https://minio.local/presigned',
          expiresAt: '2026-07-01T00:15:00.000Z',
        },
      },
    },
  };

  render(
    <MockedProvider mocks={[onePayslipMock, downloadUrlMock]}>
      <PayslipPage employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getAllByTestId('payslip-row')).toHaveLength(1),
  );
  fireEvent.click(screen.getByTestId('download-button'));

  expect(screen.getByTestId('download-loading')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByTestId('download-loading')).not.toBeInTheDocument();
  });
  expect(screen.queryByTestId('download-error')).not.toBeInTheDocument();
});

// Edge case: presigned URL fetch fails — inline error, no navigation away
test('shows an inline error on the row when the presigned URL fetch fails', async () => {
  const failedDownloadUrlMock = {
    request: {
      query: PAYSLIP_DOWNLOAD_URL_QUERY,
      variables: { input: { employeeId: EMPLOYEE_ID, month: 7, year: 2026 } },
    },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[onePayslipMock, failedDownloadUrlMock]}>
      <PayslipPage employeeId={EMPLOYEE_ID} />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getAllByTestId('payslip-row')).toHaveLength(1),
  );
  fireEvent.click(screen.getByTestId('download-button'));

  await waitFor(() => {
    expect(screen.getByTestId('download-error')).toBeInTheDocument();
  });
});
