# HEMAKURA

> Collaborative Kanban platform with drag-and-drop, optimistic UI, real-time editing, automation rules, analytics, and advanced search.

HEMAKURA is a Trello-inspired task system positioned as a serious portfolio project: a multi-user board where cards move instantly, edits synchronize in real time, recurring work is automated, and team metrics are visible in one place.

## Product direction

This iteration expands the original Kanban concept around **three flagship capabilities**:

1. **Real-time collaboration** — live card movement, collaborative description editing, presence cursors, and optional edit locks.
2. **Automation engine** — no-code triggers/actions inspired by Trello Butler, Asana Rules, and Zapier.
3. **Insights layer** — dashboard metrics, cumulative flow, cycle time, burndown, and powerful structured search.

These features make HEMAKURA feel less like a static task board and more like an operating system for team work.

## Core user experience

### Board interactions

- Multiple boards per workspace.
- Sortable columns and cards using `dnd-kit`.
- Keyboard, mouse, and touch drag-and-drop.
- Optimistic reordering with rollback on API failure.
- Inline card title editing and full details modal.
- Card tags, comments, and attachment metadata endpoints on the backend.
- Account-based authentication instead of anonymous/random users.

### Real-time collaboration

- Live board updates for all connected users.
- Collaborative rich-text editing for descriptions and comments.
- Presence indicators with cursor positions and active card focus.
- Optional lock mode while someone edits sensitive fields.
- Activity stream that records who changed what and when.

### Automation and integrations

- Trigger/action builder for business rules.
- Scheduled recurring card creation.
- Deadline-based alerts and SLA-style highlighting.
- Outbound notifications to Slack/Telegram.
- GitHub integration to sync issues and PR state with cards.

### Reporting and discovery

- Dashboard with flow metrics and team workload.
- Advanced search syntax such as `assignee:me and due:today`.
- Filter presets by sprint, tag, owner, due date, or status.
- Saved views for personal and team workflows.

## Recommended stack

### Frontend

- React + TypeScript
- `dnd-kit`
- Zustand for normalized board state
- TanStack Query for network mutations and cache invalidation
- Yjs + WebSocket provider for CRDT-backed collaborative text
- Tailwind CSS + Radix UI
- Recharts for analytics

### Backend

- Node.js + NestJS
- PostgreSQL for transactional entities and read models
- Redis + BullMQ for automations, retries, and scheduled jobs
- Socket.IO gateway for presence and board events
- Yjs document persistence adapter for collaborative fields
- JWT + OAuth (GitHub / Google), with optional TOTP-based 2FA

### Infrastructure

- Docker Compose for local development
- GitHub Actions for lint/test/build pipelines
- Object storage (S3-compatible) for attachments
- Optional ClickHouse or Postgres materialized views for analytics

## Frontend data model

Use normalized entities plus dedicated collaboration and automation slices.

```ts
{
  entities: {
    boards: {
      byId: {
        board_1: {
          id: 'board_1',
          title: 'Launch board',
          columnIds: ['col_todo', 'col_doing', 'col_done']
        }
      }
    },
    columns: {
      byId: {
        col_todo: {
          id: 'col_todo',
          boardId: 'board_1',
          title: 'To Do',
          cardIds: ['card_1', 'card_2']
        }
      }
    },
    cards: {
      byId: {
        card_1: {
          id: 'card_1',
          columnId: 'col_todo',
          title: 'Design presence avatars',
          descriptionDocId: 'ydoc_card_1',
          position: 1000,
          lock: null
        }
      }
    }
  },
  collaboration: {
    boardPresence: {
      user_2: {
        cursor: { x: 840, y: 212 },
        activeCardId: 'card_1'
      }
    },
    pendingLocks: {
      card_1: {
        userId: 'user_2',
        expiresAt: '2026-03-19T10:00:00Z'
      }
    }
  },
  automations: {
    byId: {
      rule_done_notify: {
        trigger: 'card.moved',
        condition: 'destinationColumn == "done"',
        actions: ['notify.telegram']
      }
    }
  }
}
```

## Drag-and-drop lifecycle

1. `DndContext` captures the drag session.
2. `SortableContext` manages columns and nested card lists.
3. Local state is reordered immediately for optimistic feedback.
4. A mutation is sent with the source/destination card neighborhood.
5. The server stores canonical positions and emits a board event.
6. Connected clients reconcile with the event stream.
7. If persistence fails, the initiator rolls back from a snapshot.

## Feature pillars

### 1. Real-time collaboration

HEMAKURA should support board-level presence and card-level collaboration:

- Socket events for card/column CRUD and movement.
- Cursor broadcast throttled to reduce network noise.
- Yjs documents for descriptions/comments so concurrent edits merge safely.
- Soft locks for title, assignee, due date, or checklist editing.
- Conflict-aware UI badges when another user updates the same card.

### 2. Automation engine

Rules are stored as trigger + condition tree + action list.

Examples:

- When a card moves to `Done`, post a Telegram notification.
- Every Friday at 09:00 create “Weekly planning” in `To Do`.
- If a due date passes and the card is not in `Done`, mark it overdue.
- When a GitHub PR closes, move the linked card to `Review` or `Done`.

### 3. Analytics and advanced search

The analytics module consumes activity events and board snapshots to compute:

- cumulative flow diagram;
- cycle time / lead time;
- burndown for sprint boards;
- per-user throughput;
- overdue work distribution.

The search layer should parse structured filters such as:

- `assignee:me and due:today`
- `label:bug and status:"In Progress"`
- `created:>2024-01-01 and not status:Done`

## Repository layout

```text
.
├── backend/
│   └── src/
├── docs/
│   ├── api.md
│   ├── architecture.md
│   ├── automation.md
│   ├── database.md
│   └── realtime.md
├── frontend/
│   └── src/
├── docker-compose.yml
└── README.md
```

## Documentation

- [Architecture notes](docs/architecture.md)
- [Real-time collaboration design](docs/realtime.md)
- [Automation engine design](docs/automation.md)
- [Database design](docs/database.md)
- [API contract draft](docs/api.md)

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
DATABASE_URL=postgres://hemakura:hemakura@localhost:5432/hemakura npm run dev
npm test
```

### Docker scaffold

```bash
docker compose up --build
```

The repository now includes a runnable React + TypeScript frontend starter and an Express API stub, while the compose file still outlines the longer-term local topology with Postgres and Redis.

## Build roadmap

- [ ] Board UI with `dnd-kit` and optimistic reorder rollback
- [ ] Presence service with live cursors and active-card indicators
- [ ] Collaborative card description editing via Yjs
- [ ] Rule builder UI + BullMQ automation workers
- [ ] GitHub / Telegram integration adapters
- [ ] Search DSL parser + indexed search queries
- [ ] Analytics read models and dashboard widgets
- [ ] OAuth, 2FA, and audit log hardening
- [ ] PWA/offline synchronization

## Why this project stands out

HEMAKURA demonstrates:

- advanced drag-and-drop UX;
- conflict-aware collaborative state management;
- event-driven backend design;
- automation and integrations thinking;
- analytics and search architecture beyond CRUD boards.
