# AIN API Contracts

## Section 4 — SOS Alerts

### Critical Notes

⚠️ **ENUM SERIALIZATION INCONSISTENCY:**
- `POST /api/SOSAlerts/trigger` → returns `status`/`severity` as **INTEGERS**
- `GET  /api/SOSAlerts/{id}`   → returns `status`/`severity` as **INTEGERS**
- `GET  /api/SOSAlerts`        → returns `status`/`severity` as **STRINGS**

Always normalize immediately after receiving:

```typescript
function normalizeStatus(v: string | number): string {
  if (typeof v === 'string') return v
  return ['Active','Resolved','Cancelled','FalseAlarm','Expired'][v] ?? 'Unknown'
}
function normalizeSeverity(v: string | number): string {
  if (typeof v === 'string') return v
  return ['Standard','High','Critical'][v] ?? 'Standard'
}
```

⚠️ **SOSAlertToReturnDto** has an undocumented `reporter` field (on `GET /{id}` only):

```json
{
  "reporter": {
    "userId": "string",
    "fullName": "string",
    "profilePhotoUrl": "string",
    "idCardPhotoUrl": "string | null",
    "nationalId": "string | null",
    "phoneNumber": "string | null",
    "lastKnownLatitude": 0,
    "lastKnownLongitude": 0,
    "lastKnownLocationName": "string | null"
  }
}
```

- Use `reporter.lastKnownLatitude` / `lastKnownLongitude` as **initial map position** before the first live ping arrives.

⚠️ **`POST /{id}/location`** returns full `SOSLocationDto`, **NOT** `{ message }`.
Use the returned object to update the map immediately without waiting for SignalR.

⚠️ **`GET /api/SOSAlerts/map-data`** actual shape (differs from earlier docs):

```json
{
  "id": "uuid",
  "latitude": 0,
  "longitude": 0,
  "severity": "string",
  "reporterName": "string",
  "reporterPhotoUrl": "string",
  "triggeredAt": "datetime",
  "locationName": "string"
}
```

Fields: `severity` (not `status`), `reporterName` (not `title`), `triggeredAt` (not `createdAt`).

---

### Endpoints

#### GET /api/SOSAlerts/{id}/live-state

**Auth:** Bearer (Authority, Admin)

**Response 200 — `SOSLiveStateDto`:**

```json
{
  "sosAlertId": "uuid",
  "communityId": "uuid",
  "status": "string",
  "severity": "string",
  "initiatorUserId": "string",
  "initiatorName": "string",
  "initiatorLatitude": 30.0,
  "initiatorLongitude": 31.0,
  "initiatorLastPingAt": "datetime",
  "isInitiatorLocationStale": true,
  "memberLocations": [
    {
      "userId": "string",
      "userName": "string",
      "memberStatus": 0,
      "latitude": 0,
      "longitude": 0,
      "lastUpdatedAt": "datetime",
      "isStale": true,
      "secondsSinceLastUpdate": 0
    }
  ],
  "totalActiveMembers": 0,
  "totalLocationPendingMembers": 0,
  "totalStaleMembers": 0,
  "generatedAt": "datetime"
}
```

**Purpose:** Full live snapshot — call on card mount and as SignalR fallback.

---

#### GET /api/SOSAlerts

**Auth:** Bearer (Authority, Admin)

**Query:** `status`, `severity`, `communityId`, `page` (default 1), `pageSize` (default 20)

**Response 200 — paginated wrapper:**

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "Active",
      "severity": "High",
      "message": "string",
      "initiatorUserId": "string",
      "communityId": "uuid",
      "createdAtUtc": "datetime",
      "expiresAtUtc": "datetime",
      "isLocationStale": true,
      "lastLocationPingAt": "datetime",
      "totalLocationUpdates": 0
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```

- `status` / `severity` are **STRINGS** on this endpoint.
- Use for authority SOS monitor list — **NOT** `/community/{id}`.

---

#### POST /api/SOSAlerts/{id}/locations/batch

**Auth:** Bearer (Citizen)

**Body:**

```json
{
  "locations": [
    {
      "latitude": 0,
      "longitude": 0,
      "accuracyMeters": 0,
      "altitudeMeters": null,
      "recordedAtUtc": "datetime"
    }
  ]
}
```

- `recordedAtUtc` — **client timestamp required** (ISO 8601 UTC).

**Response 200:** Array of `SOSLocationDto`

**Purpose:** Flush offline-buffered location points when reconnected. Max 50 locations per request.

---

#### PUT /api/SOSAlerts/{id}/severity

**Auth:** Bearer (Authority, Admin)

**Body:**

```json
{ "severity": 0 }
```

Integer enum: `Standard=0`, `High=1`, `Critical=2` (not string).

**Response 200:** Full `SOSAlertToReturnDto`

---

#### GET /api/SOSAlerts/{id}/locations

**Auth:** Bearer (Authority, Admin)

**Response 200:** `SOSLocationDto[]` — full location history trail.

---

#### POST /api/SOSAlerts/{id}/location

**Auth:** Bearer (Citizen)

**Response 200:** Full `SOSLocationDto` (not `{ message }`).
