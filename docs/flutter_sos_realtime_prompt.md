# Flutter Citizen App — SOS Realtime

## Offline Location Buffer

While SOS is active, store every **30s** location reading in a local buffer:

```dart
List<BufferedLocation> buffer = [];
```

### On each location timer tick

1. Try `POST /api/SOSAlerts/{id}/location` (single)
2. If success: clear buffer, push any buffered to batch endpoint
3. If network fails: add to buffer, do not lose the reading

### On reconnect (`connectivity_plus` detects network return)

If `buffer.length > 0`:

```
POST /api/SOSAlerts/{id}/locations/batch
Body: {
  "locations": buffer.map((b) => ({
    "latitude": b.lat,
    "longitude": b.lng,
    "accuracyMeters": b.accuracy,
    "altitudeMeters": b.altitude,
    "recordedAtUtc": b.timestamp.toIso8601String()  // client timestamp required
  }))
}
```

- On success: clear buffer
- On fail: keep buffer, retry on next reconnect

### Limits & UI

- **Max buffer size:** 50 readings (25 minutes of data at 30s intervals)
- If buffer exceeds 50: drop oldest entry (FIFO)
- Display on active SOS screen: `"📦 {buffer.length} readings queued"`

### Batch endpoint contract

See `ain_api_contracts.md` Section 4 — `POST /api/SOSAlerts/{id}/locations/batch`.

Response: `Array<SOSLocationDto>` — merge returned points into local trail without waiting for SignalR.
