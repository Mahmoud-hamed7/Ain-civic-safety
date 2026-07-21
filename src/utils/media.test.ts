import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../api/client', () => ({
  default: {
    defaults: { baseURL: 'https://scorebook-resonate-excuse.ngrok-free.dev/' },
    get: vi.fn(),
  },
}));

import apiClient from '../api/client';
import { getMediaUrl, normalizeMediaPath, toApiRequestPath } from '../utils/media';

describe('media url helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses same-origin upload paths in dev (Vite proxy)', () => {
    expect(getMediaUrl('http://localhost:5193/uploads/profile/abc.jpg')).toBe(
      '/uploads/profile/abc.jpg',
    );
    expect(getMediaUrl('/uploads/reports/file.jpg')).toBe('/uploads/reports/file.jpg');
  });

  it('normalizes Windows-style paths', () => {
    expect(normalizeMediaPath('uploads\\reports\\file.jpg')).toBe('/uploads/reports/file.jpg');
  });

  it('returns relative axios paths for localhost URLs', () => {
    expect(toApiRequestPath('https://localhost:7155/uploads/id/front.jpg')).toBe(
      '/uploads/id/front.jpg',
    );
  });

  it('passes through external https URLs unchanged for axios', () => {
    const external = 'https://cdn.example.com/photo.jpg';
    expect(toApiRequestPath(external)).toBe(external);
  });
});

describe('fetchMediaBlob', () => {
  it('rejects HTML blobs (e.g. ngrok warning pages)', async () => {
    const { fetchMediaBlob } = await import('../utils/media');
    vi.mocked(apiClient.get).mockResolvedValue({
      data: new Blob(['<html>warning</html>'], { type: 'text/html' }),
      headers: { 'content-type': 'text/html' },
      status: 200,
      statusText: 'OK',
      config: {} as any,
    });

    const result = await fetchMediaBlob('/uploads/test.jpg');
    expect(result).toBeNull();
  });
});
