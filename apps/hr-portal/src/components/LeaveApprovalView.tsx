import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import {
  type LeaveDecision,
  type LeaveRequest,
  PENDING_LEAVE_REQUESTS_QUERY,
  REVIEW_LEAVE_MUTATION,
} from '../graphql/leave';

interface LeaveApprovalViewProps {
  // ponytail: same stub-auth convention as NotificationBell — no supervisor session exists yet.
  supervisorId?: string;
}

export function LeaveApprovalView({
  supervisorId,
}: LeaveApprovalViewProps = {}) {
  const currentSupervisorId =
    supervisorId ?? globalThis.localStorage?.getItem('currentEmployeeId') ?? '';

  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [pendingReview, setPendingReview] = useState<{
    leaveRequest: LeaveRequest;
    decision: LeaveDecision;
  } | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [staleDataError, setStaleDataError] = useState(false);

  const { data, error, refetch } = useQuery(PENDING_LEAVE_REQUESTS_QUERY, {
    variables: { supervisorId: currentSupervisorId },
    skip: !currentSupervisorId,
  });
  const [reviewLeave] = useMutation(REVIEW_LEAVE_MUTATION);

  const pendingRequests = (
    data?.pendingLeaveRequestsForSupervisor ?? []
  ).filter((leaveRequest) => !removedIds.has(leaveRequest.id));

  function openConfirm(leaveRequest: LeaveRequest, decision: LeaveDecision) {
    setBannerError(null);
    setStaleDataError(false);
    setPendingReview({ leaveRequest, decision });
  }

  async function handleConfirm() {
    if (!pendingReview) return;
    const { leaveRequest, decision } = pendingReview;
    setPendingReview(null);
    setRemovedIds((prev) => new Set(prev).add(leaveRequest.id));

    try {
      await reviewLeave({
        variables: {
          input: {
            leaveRequestId: leaveRequest.id,
            supervisorId: currentSupervisorId,
            decision,
          },
        },
      });
    } catch (submitError) {
      const code = CombinedGraphQLErrors.is(submitError)
        ? submitError.errors[0]?.extensions?.code
        : undefined;
      if (code === 'CONFLICT') {
        setStaleDataError(true);
        await refetch().catch(() => {});
      } else {
        setBannerError('Something went wrong. Please try again.');
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(leaveRequest.id);
          return next;
        });
      }
    }
  }

  if (error) {
    return (
      <div data-testid="pending-leave-error">
        Failed to load pending leave requests
      </div>
    );
  }

  return (
    <div>
      {bannerError && <div data-testid="error-banner">{bannerError}</div>}
      {staleDataError && (
        <div data-testid="stale-data-error">
          This request was already reviewed. The table has been refreshed.
        </div>
      )}

      {pendingRequests.length === 0 ? (
        <div data-testid="pending-leave-empty">No pending leave requests</div>
      ) : (
        <table data-testid="pending-leave-table">
          <tbody>
            {pendingRequests.map((leaveRequest) => (
              <tr key={leaveRequest.id} data-testid="pending-leave-row">
                <td>{leaveRequest.employee.id}</td>
                <td>{leaveRequest.leaveType}</td>
                <td>{leaveRequest.startDate}</td>
                <td>{leaveRequest.endDate}</td>
                <td>{leaveRequest.reason}</td>
                <td>{leaveRequest.submittedAt}</td>
                <td>
                  <button
                    type="button"
                    data-testid="approve-button"
                    onClick={() => openConfirm(leaveRequest, 'APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    data-testid="reject-button"
                    onClick={() => openConfirm(leaveRequest, 'REJECTED')}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingReview && (
        <div data-testid="review-confirm-modal">
          <p>
            {pendingReview.decision === 'APPROVED' ? 'Approve' : 'Reject'} leave
            for {pendingReview.leaveRequest.employee.id} (
            {pendingReview.leaveRequest.startDate} to{' '}
            {pendingReview.leaveRequest.endDate})?
          </p>
          <button
            type="button"
            data-testid="review-confirm-button"
            onClick={handleConfirm}
          >
            Confirm
          </button>
          <button
            type="button"
            data-testid="review-cancel-button"
            onClick={() => setPendingReview(null)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
