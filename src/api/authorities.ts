import apiClient from './client';
import type {
  AuthoritiesListResponse,
  AuthorityProfile,
  CreateAuthorityPayload,
  LinkAuthorityUserPayload,
  Specialization,
  UpdateAuthorityPayload,
} from '../types';

/** Unwrap `{ isSuccess, data }` envelopes returned by some endpoints. */
function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function parseList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload;
  const unwrapped = unwrap<unknown>(payload);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === 'object') {
    const obj = unwrapped as Record<string, unknown>;
    for (const key of ['items', 'Items', 'specializations', 'Specializations', 'data', 'Data']) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export const authoritiesApi = {
  async getAll(pageNumber = 1, pageSize = 20): Promise<AuthoritiesListResponse> {
    const res = await apiClient.get<AuthoritiesListResponse>('/api/authorities', {
      params: { pageNumber, pageSize },
    });
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body) {
      return body;
    }
    const list = Array.isArray(body) ? body : [];
    return {
      isSuccess: true,
      data: list as AuthorityProfile[],
      totalCount: list.length,
      pageNumber,
      pageSize,
    };
  },

  async getById(id: string): Promise<AuthorityProfile> {
    const res = await apiClient.get(`/api/authorities/${id}`);
    return unwrap<AuthorityProfile>(res.data);
  },

  async create(payload: CreateAuthorityPayload): Promise<AuthorityProfile> {
    const res = await apiClient.post<AuthorityProfile>('/api/authorities', payload);
    return unwrap<AuthorityProfile>(res.data);
  },

  async update(id: string, payload: UpdateAuthorityPayload): Promise<AuthorityProfile> {
    const res = await apiClient.put(`/api/authorities/${id}`, payload);
    return unwrap<AuthorityProfile>(res.data);
  },

  async linkUser(payload: LinkAuthorityUserPayload): Promise<void> {
    await apiClient.post('/api/admin/link-authority-user', payload);
  },

  async addSpecialization(authorityId: string, specializationId: string): Promise<void> {
    await apiClient.post(`/api/authorities/${authorityId}/specialization`, JSON.stringify(specializationId), {
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async removeSpecialization(authorityId: string, specializationId: string): Promise<void> {
    await apiClient.delete(`/api/authorities/${authorityId}/specialization/${specializationId}`);
  },

  async getAllSpecializations(): Promise<Specialization[]> {
    const res = await apiClient.get('/api/specializations');
    return parseList<Specialization>(res.data);
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(`/api/authorities/${id}`);
  },
};
