import { useLazyQuery, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import {
  PAYSLIP_DOWNLOAD_URL_QUERY,
  PAYSLIPS_QUERY,
  type Payslip,
} from '../graphql/payslip';

interface PayslipPageProps {
  // ponytail: same stub-auth convention as NotificationBell — no employee session exists yet.
  employeeId?: string;
}

// Fetches the presigned URL as a blob (rather than a plain `<a href>` click) so a non-2xx
// response — e.g. Minio's 403 when the URL expires mid-download — is actually visible to JS and
// can be surfaced as download-error/retry, instead of silently failing as a native browser
// download the component has no visibility into.
async function triggerDownload(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`presigned URL download failed with ${response.status}`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = '';
  link.click();
  URL.revokeObjectURL(objectUrl);
}

export function PayslipPage({ employeeId }: PayslipPageProps = {}) {
  const currentEmployeeId =
    employeeId ?? globalThis.localStorage?.getItem('currentEmployeeId') ?? '';

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const { data, error: payslipsError } = useQuery(PAYSLIPS_QUERY, {
    variables: { employeeId: currentEmployeeId },
    skip: !currentEmployeeId,
  });
  const [fetchDownloadUrl] = useLazyQuery(PAYSLIP_DOWNLOAD_URL_QUERY);

  const payslips = data?.payslips ?? [];

  async function handleDownload(payslip: Payslip) {
    setErrorId(null);
    setDownloadingId(payslip.id);
    try {
      const { data: urlData } = await fetchDownloadUrl({
        variables: {
          input: {
            employeeId: currentEmployeeId,
            month: payslip.month,
            year: payslip.year,
          },
        },
      });
      if (!urlData) throw new Error('payslipDownloadURL returned no data');
      await triggerDownload(urlData.payslipDownloadURL.url);
    } catch {
      setErrorId(payslip.id);
    } finally {
      setDownloadingId(null);
    }
  }

  if (payslipsError) {
    return <div data-testid="payslip-error">Failed to load payslips</div>;
  }

  if (payslips.length === 0) {
    return <div data-testid="payslip-empty">No payslips available yet</div>;
  }

  return (
    <table data-testid="payslip-table">
      <tbody>
        {payslips.map((payslip) => (
          <tr key={payslip.id} data-testid="payslip-row">
            <td>
              {payslip.month}/{payslip.year}
            </td>
            <td>{payslip.generatedAt}</td>
            <td>
              <button
                type="button"
                data-testid="download-button"
                disabled={downloadingId === payslip.id}
                onClick={() => handleDownload(payslip)}
              >
                {downloadingId === payslip.id ? 'Downloading…' : 'Download'}
              </button>
              {downloadingId === payslip.id && (
                <span data-testid="download-loading">
                  Fetching download link…
                </span>
              )}
              {errorId === payslip.id && (
                <span data-testid="download-error">
                  Failed to fetch download link. Try again.
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
