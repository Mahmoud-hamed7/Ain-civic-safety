# Authority Portal — Implementation Prompt

## SOS Monitor

### Primary Data Source

**OLD:** `GET /api/sosalerts/community/{id}` (undocumented, unpaginated, no staleness fields)

**NEW:** `GET /api/SOSAlerts?status=Active&page=1&pageSize=20`
- Called on mount + every **60s** as background refresh
- Provides: `isLocationStale`, `lastLocationPingAt`, `totalLocationUpdates` per alert

### On Card Mount (per alert card)

1. Call `GET /api/SOSAlerts/{id}` **in parallel** with `GET /api/SOSAlerts/{id}/live-state`
2. From `GET /{id}`: extract `reporter.lastKnownLatitude` / `lastKnownLongitude`
   - Render as placeholder pin labeled "📍 Last registered location"
   - Gray pin, dashed circle, tooltip: "Citizen's saved location — not live"
3. From `GET /{id}/live-state`: extract `initiatorLatitude` / `initiatorLongitude`
   - If non-zero: replace placeholder pin with live pin
   - Render `memberLocations` as secondary colored dots on map
4. Call `GET /api/SOSAlerts/{id}/locations` for full history trail
5. Merge all location sources: history → `recentLocations` → live-state coords
   - Sort by `recordedAtUtc` ascending to build polyline

### Community Name Resolution

- **Source:** `GET /api/community/all` (called on authority dashboard mount via `useCommunityNameMap`)
- **Build:** `Map<communityId, communityName>` stored in hook context
- **On card render:** `communityName = communityMap.get(alert.communityId) ?? "Unknown Community"`
- ⚠️ `"Unknown Community"` means `community/all` failed or returned empty — `console.warn` when fallback triggers
- **Fallback display:** show `communityId` last 8 chars in small muted text below "Unknown Community"

### Enum Normalization

Apply on **every** SOS response:

```typescript
const status   = normalizeStatus(alert.status)
const severity = normalizeSeverity(alert.severity)
```

Never render raw integer values anywhere in the UI.

### SOSLiveMap Component

Props: `sosId`, `reporterLastKnown`, `liveState`, `locationHistory`, `onUserPan`

**Layers (bottom to top):**
1. TileLayer — OSM
2. Reporter placeholder pin (gray, dashed) — only if `locationHistory.length === 0` AND `liveState.initiatorLatitude === 0`
3. Location history polyline — `#3b82f6`, weight 2, opacity 0.5, if `locationHistory.length >= 2`
4. Ghost dots at each history point — gray circles radius 4, tooltip: `formatTime(point.recordedAtUtc)`
5. Live initiator pin (animated red pulse) — amber if `isInitiatorLocationStale`, accuracy circle from last history point
6. Member location dots — blue (active) / gray (stale), tooltip: `{userName} · {secondsSinceLastUpdate}s ago`

**Map behavior:**
- Initial bounds: `fitBounds()` to all available points
- Auto-pan to initiator on each `ReceiveLocationUpdate` if `userHasPanned = false`
- "↗ Re-center" button when `userHasPanned = true`

**Empty state:** Dark background, satellite dish icon, "Waiting for first location ping...", initiator name, subtext about GPS delay. Never show empty black box.

### Card Header

`[SeverityBadge] [CommunityNameBadge] [GPS status chip] [Active Xm]`

**GPS chip (3 states):**
- `totalLocationUpdates === 0` → amber "⚠ Waiting for GPS"
- `totalLocationUpdates > 0` AND NOT stale → green "● Live · {seconds}s ago" (counter updates every 1s)
- `totalLocationUpdates > 0` AND stale → red "⚠ Signal lost · {minutes}m ago"

**Active Xm:** `Math.floor((now - createdAtUtc) / 60000) + "m"`, recalculated every 60s.

### Severity Selector

- Standard → High: fire immediately
- Any → Critical: `ConfirmDialog` ("Escalate to Critical?")
- Critical → lower: `ConfirmDialog` ("Downgrading severity will update all member screens.")
- `PUT /api/SOSAlerts/{id}/severity` body: `{ "severity": 0|1|2 }` (integer)
- On success: update local state from full `SOSAlertToReturnDto` response — no optimistic update

### SignalR + Polling Fallback

**Primary:** `ReceiveLocationUpdate` → append history, update live coords, reset GPS chip, animate pin, increment `totalLocationUpdates`

**Fallback (SignalR disconnect):** Poll `GET /api/SOSAlerts/{id}/live-state` every **15s**, compare `generatedAt` for new data. Show amber reconnecting banner below card header.

**On reconnect:** Clear polling, resync via live-state + locations endpoints, resume SignalR.

**Client staleness (every 10s):** `secondsSinceLastPing > 90` → stale; `> 300` → signal lost.
