# Real-time collaboration design

## Goals

HEMAKURA should feel closer to Miro or Google Docs than to a static Kanban board. Multiple users must be able to move cards, edit descriptions, and observe each other's presence without needing manual refreshes.

## Collaboration layers

### Presence layer

Tracks who is currently on a board and what they are doing.

Suggested payload:

```json
{
  "userId": "user_42",
  "boardId": "board_7",
  "cursor": { "x": 731, "y": 284 },
  "activeCardId": "card_10",
  "activeField": "description",
  "color": "#7c3aed"
}
```

Guidelines:

- throttle cursor updates to ~20-30 fps max;
- expire stale presence if heartbeat stops;
- separate presence traffic from board mutation events.

### Board event layer

Pushes state changes that should update all clients:

- `column.created`
- `column.moved`
- `card.created`
- `card.moved`
- `card.updated`
- `comment.created`
- `lock.acquired`
- `lock.released`

### Collaborative text layer

Descriptions and comments should use CRDT synchronization.

Recommended stack:

- Yjs document per card description;
- Yjs subdocuments or additional docs for comments/checklists;
- WebSocket provider for change propagation;
- persisted snapshots to restore active documents quickly.

## Locking model

Locks are optional and should be **soft**, not hard global mutexes, for most editing flows.

Use cases:

- protect scalar fields like assignee, due date, estimate, or title;
- show avatars on fields already being edited;
- warn before conflicting edits instead of silently overwriting.

Example lock record:

```json
{
  "resourceType": "card-field",
  "resourceId": "card_10:title",
  "holderUserId": "user_42",
  "expiresAt": "2026-03-19T10:00:00Z"
}
```

## Event ordering and reconciliation

### Card movement

- initiating client performs optimistic UI;
- API returns canonical `position` and `updatedAt`;
- socket broadcast includes monotonic event ID;
- clients ignore stale events older than their known revision.

### Text updates

- CRDT operations merge naturally;
- snapshots are background persistence artifacts, not the source of truth;
- reconnecting clients replay missed updates from provider storage when available.

## Failure modes

- **socket disconnect**: keep local state, mark board as reconnecting, replay subscriptions;
- **presence timeout**: remove stale cursors after heartbeat expiry;
- **lock leak**: expire with TTL and heartbeat renewal;
- **server persistence lag**: keep optimistic mutation queue and surface sync warnings;
- **search lag**: collaborative text is searchable after snapshot/index refresh, not necessarily per keystroke.

## Suggested test matrix

- two users move the same card concurrently;
- two users edit the same description paragraph concurrently;
- one user disconnects while holding a lock;
- a user reconnects after missed board events;
- card move triggers both socket fan-out and automation event dispatch.
