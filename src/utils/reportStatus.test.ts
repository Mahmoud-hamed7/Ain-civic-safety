import { describe, expect, it } from 'vitest';
import {
  normalizeReportStatusFromApi,
  toApiReportStatus,
  toApiReportStatusInt,
} from './reportStatus';

describe('reportStatus', () => {
  it('maps Resolved display alias to ReSolved', () => {
    expect(normalizeReportStatusFromApi('Resolved')).toBe('ReSolved');
    expect(toApiReportStatus('Resolved')).toBe('ReSolved');
  });

  it('maps integer API values to canonical strings', () => {
    expect(normalizeReportStatusFromApi(0)).toBe('UnderReview');
    expect(normalizeReportStatusFromApi(1)).toBe('Dispatched');
    expect(normalizeReportStatusFromApi(2)).toBe('ReSolved');
    expect(normalizeReportStatusFromApi(3)).toBe('Rejected');
  });

  it('sends integer enum for PUT /api/Reports/{id}/status', () => {
    expect(toApiReportStatusInt('UnderReview')).toBe(0);
    expect(toApiReportStatusInt('Dispatched')).toBe(1);
    expect(toApiReportStatusInt('Resolved')).toBe(2);
    expect(toApiReportStatusInt('ReSolved')).toBe(2);
    expect(toApiReportStatusInt('Rejected')).toBe(3);
  });
});
