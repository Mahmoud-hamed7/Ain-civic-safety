/**
 * SOS utility helpers — shared normalization functions.
 *
 * ⚠️ ENUM SERIALIZATION INCONSISTENCY IN BACKEND:
 *   - POST /api/SOSAlerts/trigger → returns status/severity as INTEGERS
 *   - GET  /api/SOSAlerts/{id}   → returns status/severity as INTEGERS
 *   - GET  /api/SOSAlerts        → returns status/severity as STRINGS
 *
 * Always call normalizeStatus / normalizeSeverity immediately after receiving
 * any SOS API response before using the value in UI logic.
 */
import type { SOSSeverity } from '../types';

const STATUS_MAP: Record<number, string> = {
  0: 'Active',
  1: 'Resolved',
  2: 'Cancelled',
  3: 'FalseAlarm',
  4: 'Expired',
};

const SEVERITY_MAP: Record<number, SOSSeverity> = {
  0: 'Standard',
  1: 'High',
  2: 'Critical',
};

export function normalizeStatus(v: string | number): string {
  if (typeof v === 'string') return v;
  return STATUS_MAP[v] ?? 'Unknown';
}

export function normalizeSeverity(v: string | number): SOSSeverity {
  if (typeof v === 'string') return v as SOSSeverity;
  return SEVERITY_MAP[v] ?? 'Standard';
}

/** Map severity string → integer for PUT /api/SOSAlerts/{id}/severity body */
export const SEVERITY_TO_INT: Record<string, number> = {
  Standard: 0,
  High: 1,
  Critical: 2,
};
