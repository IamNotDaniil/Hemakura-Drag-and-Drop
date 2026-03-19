# Architecture

## System overview

HEMAKURA is designed as a collaborative work platform rather than a basic Kanban clone. The system combines a transactional board backend, a real-time collaboration channel, an automation pipeline, and read-optimized analytics/search surfaces.

## Primary subsystems

### 1. Board application

Owns boards, columns, cards, memberships, labels, comments, attachments, and audit events.

Responsibilities:

- handle REST/HTTP mutations for board data;
- validate permissions;
- compute canonical positions after drag-and-drop;
- publish domain events for every significant change.

### 2. Real-time collaboration service

Supports live board state awareness.

Responsibilities:

- user presence in a board room;
- cursor broadcasting;
- active-card / active-field indicators;
- transient lock acquisition and expiry;
- fan-out of board mutation events.

### 3. Collaborative text engine

Used for descriptions and comments where true concurrent editing matters.

Recommended design:

- Yjs document per editable rich-text field or per card namespace;
- WebSocket provider for syncing document updates;
- persisted snapshots in PostgreSQL or object storage;
- debounce-based compaction of updates into durable snapshots.

### 4. Automation engine

Executes no-code rules and scheduled actions.

Responsibilities:

- subscribe to domain events such as `card.moved` or `due_date.passed`;
- evaluate conditions against the event payload and current entity state;
- enqueue actions like notifications, card creation, field updates, or integrations;
- retry failed external actions with idempotency keys.

### 5. Analytics and search layer

Turns activity into decision-making surfaces.

Responsibilities:

- build read models for board throughput and flow metrics;
- expose dashboard endpoints;
- index searchable card content and structured filters;
- support saved searches and team views.

## Recommended deployment shape

For a portfolio build, start as a modular monolith with clear internal boundaries:

- `board` module
- `collaboration` module
- `automation` module
- `integration` module
- `analytics` module
- `search` module

Later, the automation and analytics modules can be extracted into separate services if workload grows.

## Frontend architecture

### State slices

- `entities`: normalized boards, columns, cards, users, labels, comments
- `ui`: active modal, selected board, filters, theme, drag overlay state
- `collaboration`: presence, remote cursors, active editors, locks
- `automation`: available triggers/actions, rule drafts, rule execution status
- `analytics`: dashboard filters, cached summaries, date range controls
- `network`: optimistic mutation queue, retries, and error banners

### Rendering strategy

- board data uses entity selectors to minimize re-renders;
- cursor/presence state is rendered separately from card entity state;
- collaborative text editor subscribes directly to Yjs updates;
- analytics pages query read models rather than reconstructing metrics client-side.

## Real-time interaction model

### Card movement

1. Client performs optimistic reorder.
2. Board API persists the move in a transaction.
3. Server emits `card.moved` with canonical `position`.
4. Other clients update normalized entities.
5. Automation engine consumes the same event.
6. Analytics projections incrementally update counters.

### Description editing

1. Client joins a Yjs room for the selected card.
2. Presence is announced with active field metadata.
3. Remote text operations merge without last-write-wins loss.
4. Optional soft lock warns other users before editing a locked field.
5. Final snapshots are periodically persisted for recovery and search indexing.

## Conflict management

Different data types use different strategies:

- **card order / column order**: server-authoritative positions;
- **rich text**: CRDT merge via Yjs;
- **simple scalar fields**: last-write-wins plus activity log and optional soft lock;
- **automation executions**: idempotent jobs with deduplication keys.

## Security model

Roles:

- `owner`
- `admin`
- `editor`
- `commenter`
- `viewer`

Additional controls:

- board-level permissions;
- optional card-level restrictions for sensitive work;
- OAuth SSO and TOTP 2FA;
- immutable audit log for security-sensitive changes.

## Scalability path

### Phase 1: modular monolith

- NestJS app with internal domain modules
- PostgreSQL as primary store
- Redis for cache, pub/sub, and queues

### Phase 2: extracted workers/services

- dedicated automation workers
- analytics projection worker
- webhook/integration workers

### Phase 3: advanced architecture

Potential future upgrades:

- CQRS read models for dashboards and search
- event sourcing for board history playback
- ClickHouse for heavy analytics
- GraphQL federation across workspace domains

## Testing strategy

- unit tests for reorder math, search parsing, rule evaluation, and lock expiry;
- integration tests for board transactions, socket events, and automation dispatch;
- collaboration tests for Yjs merge scenarios;
- end-to-end tests for drag-and-drop, live editing, and scheduled automations.
