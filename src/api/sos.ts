import { useQuery } from '@tanstack/react-query';

import axios from 'axios';

import apiClient from './client';

import { normalizeSeverity, normalizeStatus } from '../utils/sos';

import { unwrapApiPayload } from '../utils/sosLocation';

import type {

  SOSAlertListResponse, SOSAlertsListFilters, SOSAlertToReturnDto, SOSLocationDto,

} from '../types';



/** Retry GET /locations after 403 — backend policy may change or be transient. */

const LOCATIONS_FORBIDDEN_UNTIL = new Map<string, number>();

const LOCATIONS_403_RETRY_MS = 5 * 60_000;



function unwrapLocationArray(payload: unknown): SOSLocationDto[] {

  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object' && Array.isArray((payload as { data: unknown }).data)) {

    return (payload as { data: SOSLocationDto[] }).data;

  }

  return [];

}



async function fetchRecentLocationsFromDetail(alertId: string): Promise<SOSLocationDto[]> {

  const detail = await apiClient.get(`/api/sosalerts/${alertId}`);

  const data = unwrapApiPayload<SOSAlertToReturnDto>(detail.data);

  return data.recentLocations ?? [];

}



/**

 * Fetch location history trail for path drawing.

 * Tries GET /locations first; on 403 uses recentLocations and retries /locations after TTL.

 */

export async function fetchSOSLocationHistory(

  alertId: string,

  options?: { force?: boolean },

): Promise<SOSLocationDto[]> {

  const now = Date.now();

  const forbiddenUntil = LOCATIONS_FORBIDDEN_UNTIL.get(alertId) ?? 0;

  const skipLocationsEndpoint = !options?.force && forbiddenUntil > now;



  if (!skipLocationsEndpoint) {

    try {

      const res = await apiClient.get(`/api/sosalerts/${alertId}/locations`);

      return unwrapLocationArray(res.data);

    } catch (err: unknown) {

      if (axios.isAxiosError(err) && err.response?.status === 403) {

        LOCATIONS_FORBIDDEN_UNTIL.set(alertId, now + LOCATIONS_403_RETRY_MS);

        console.warn(

          `[SOS] GET /locations returned 403 for ${alertId} — using recentLocations; retry in 5m`,

        );

      } else {

        throw err;

      }

    }

  }



  return fetchRecentLocationsFromDetail(alertId);

}



/** Clear 403 backoff so the next fetch retries GET /locations immediately. */

export function resetSOSLocationHistoryBackoff(alertId: string): void {

  LOCATIONS_FORBIDDEN_UNTIL.delete(alertId);

}



/**

 * Fetch paginated SOS alerts list (GET /api/sosalerts).

 *

 * Authority monitor: pass status=Active explicitly.

 * Admin/SuperAdmin: all statuses unless ?status is provided.

 */

export const useSOSAlerts = (filters: SOSAlertsListFilters = {}) =>

  useQuery<SOSAlertListResponse>({

    queryKey: ['sos', 'list', filters],

    queryFn: () =>

      apiClient

        .get<SOSAlertListResponse>('/api/sosalerts', { params: filters })

        .then((r) => ({

          ...r.data,

          data: r.data.data.map((item) => ({

            ...item,

            status: normalizeStatus(item.status) as SOSAlertListResponse['data'][0]['status'],

            severity: normalizeSeverity(item.severity),

          })),

        })),

    refetchInterval: 60_000,

    staleTime: 0,

  });


