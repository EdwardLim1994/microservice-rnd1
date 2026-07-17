import { useMutation, useQuery } from '@apollo/client/react';
import { type SyntheticEvent, useState } from 'react';
import {
  LEAVE_REQUESTS_QUERY,
  type LeaveType,
  SUBMIT_LEAVE_MUTATION,
} from '../graphql/leave';

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const emptyForm = {
  leaveType: LEAVE_TYPES[0].value,
  startDate: '',
  endDate: '',
  reason: '',
};

interface LeaveRequestFormProps {
  // ponytail: same stub-auth convention as NotificationBell — no employee session exists yet.
  employeeId?: string;
}

export function LeaveRequestForm({ employeeId }: LeaveRequestFormProps = {}) {
  const currentEmployeeId =
    employeeId ?? globalThis.localStorage?.getItem('currentEmployeeId') ?? '';

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [dateRangeError, setDateRangeError] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const { data, error, refetch } = useQuery(LEAVE_REQUESTS_QUERY, {
    variables: { employeeId: currentEmployeeId },
    skip: !currentEmployeeId,
  });
  const [submitLeave, { loading }] = useMutation(SUBMIT_LEAVE_MUTATION);

  const leaveRequests = data?.leaveRequests ?? [];

  function openForm() {
    setForm(emptyForm);
    setDateRangeError(false);
    setBannerError(null);
    setOpen(true);
  }

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setDateRangeError(false);
    setBannerError(null);

    if (form.startDate > form.endDate) {
      setDateRangeError(true);
      return;
    }

    try {
      await submitLeave({
        variables: {
          input: {
            employeeId: currentEmployeeId,
            leaveType: form.leaveType,
            startDate: form.startDate,
            endDate: form.endDate,
            reason: form.reason,
          },
        },
      });
      await refetch();
      setOpen(false);
    } catch {
      setBannerError('Something went wrong. Please try again.');
    }
  }

  function renderHistory() {
    if (error) {
      return (
        <div data-testid="leave-history-error">
          Failed to load leave history
        </div>
      );
    }
    if (leaveRequests.length === 0) {
      return (
        <div data-testid="leave-history-empty">
          No leave requests yet. Apply for leave to get started.
        </div>
      );
    }
    return (
      <table data-testid="leave-history-table">
        <tbody>
          {leaveRequests.map((leaveRequest) => (
            <tr key={leaveRequest.id}>
              <td>{leaveRequest.leaveType}</td>
              <td>{leaveRequest.startDate}</td>
              <td>{leaveRequest.endDate}</td>
              <td>{leaveRequest.reason}</td>
              <td>{leaveRequest.submittedAt}</td>
              <td>
                <span data-testid="leave-status-badge">
                  {STATUS_LABELS[leaveRequest.status] ?? leaveRequest.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div>
      {!open && (
        <button
          type="button"
          data-testid="apply-leave-button"
          onClick={openForm}
        >
          Apply Leave
        </button>
      )}

      {open && (
        <form onSubmit={handleSubmit}>
          {bannerError && <div data-testid="error-banner">{bannerError}</div>}

          <label htmlFor="leaveType">Leave type</label>
          <select
            id="leaveType"
            data-testid="leaveType-select"
            value={form.leaveType}
            onChange={(e) =>
              setForm({ ...form, leaveType: e.target.value as LeaveType })
            }
          >
            {LEAVE_TYPES.map((leaveType) => (
              <option key={leaveType.value} value={leaveType.value}>
                {leaveType.label}
              </option>
            ))}
          </select>

          <label htmlFor="startDate">Start date</label>
          <input
            id="startDate"
            type="date"
            data-testid="startDate-input"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />

          <label htmlFor="endDate">End date</label>
          <input
            id="endDate"
            type="date"
            data-testid="endDate-input"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            required
          />
          {dateRangeError && (
            <div data-testid="date-range-error">
              End date must be on or after the start date
            </div>
          )}

          <label htmlFor="reason">Reason</label>
          <textarea
            id="reason"
            data-testid="reason-input"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            required
          />

          <button
            type="submit"
            data-testid="submit-leave-button"
            disabled={loading}
          >
            {loading ? 'Submitting…' : 'Submit'}
          </button>
        </form>
      )}

      {renderHistory()}
    </div>
  );
}
