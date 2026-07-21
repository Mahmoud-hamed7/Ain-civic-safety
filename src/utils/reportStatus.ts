import type { ReportStatus } from '../types';

/** Canonical values used in GET responses and UI. */
export const REPORT_STATUS_VALUES: ReportStatus[] = [
  'UnderReview',
  'Dispatched',
  'ReSolved',
  'Rejected',
];

/**
 * PUT /api/Reports/{id}/status expects integer enum (Swagger schema).
 * Order matches backend ReportStatus declaration.
 */
export const REPORT_STATUS_TO_INT: Record<ReportStatus, number> = {
  UnderReview: 0,
  Dispatched: 1,
  ReSolved: 2,
  Rejected: 3,
};

const REPORT_STATUS_FROM_INT: Record<number, ReportStatus> = {
  0: 'UnderReview',
  1: 'Dispatched',
  2: 'ReSolved',
  3: 'Rejected',
};

/** Normalize any API/display alias to the canonical enum value. */
export function normalizeReportStatusFromApi(
  status: string | number | undefined | null,
): ReportStatus {
  if (status == null) return 'UnderReview';

  if (typeof status === 'number' && Number.isFinite(status)) {
    return REPORT_STATUS_FROM_INT[status] ?? 'UnderReview';
  }

  if (typeof status === 'string' && /^\d+$/.test(status.trim())) {
    return REPORT_STATUS_FROM_INT[Number(status)] ?? 'UnderReview';
  }

  if (status === 'Resolved' || status === 'ReSolved') return 'ReSolved';
  if (status === 'UnderReview' || status === 'Dispatched' || status === 'Rejected') {
    return status;
  }
  return 'UnderReview';
}

/** Integer value for PUT /api/Reports/{id}/status request body. */
export function toApiReportStatusInt(status: string | number): number {
  const normalized = normalizeReportStatusFromApi(status);
  return REPORT_STATUS_TO_INT[normalized];
}

/** @deprecated Use toApiReportStatusInt for PUT; kept for string comparisons. */
export function toApiReportStatus(status: string | number): ReportStatus {
  return normalizeReportStatusFromApi(status);
}

export function reportStatusLabel(status: string | number): string {
  const normalized = normalizeReportStatusFromApi(status);
  if (normalized === 'ReSolved') return 'Resolved';
  if (normalized === 'UnderReview') return 'Under Review';
  return normalized;
}

export function extractApiErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: unknown } };
  const data = err.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const msg =
      obj.message ??
      obj.Message ??
      obj.title ??
      obj.Title ??
      obj.detail ??
      obj.Detail;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(obj.errors)) return obj.errors.join(', ');
    if (obj.errors && typeof obj.errors === 'object') {
      return Object.values(obj.errors as Record<string, string[]>)
        .flat()
        .join(', ');
    }
  }
  return 'Update failed.';
}
