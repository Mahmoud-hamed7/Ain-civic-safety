import { describe, expect, it } from 'vitest';
import { extractUserId, decodeJwtPayload } from './jwtClaims';

const SAMPLE_TOKEN_PAYLOAD = {
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier':
    '47191dc9-e825-4e76-8c19-c81560ea467a',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname': 'menna2',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Citizen',
};

describe('jwtClaims', () => {
  it('extracts user id from .NET nameidentifier claim', () => {
    expect(extractUserId(SAMPLE_TOKEN_PAYLOAD)).toBe('47191dc9-e825-4e76-8c19-c81560ea467a');
  });

  it('extracts user id from sub claim', () => {
    expect(extractUserId({ sub: 'abc-123' })).toBe('abc-123');
  });
});
