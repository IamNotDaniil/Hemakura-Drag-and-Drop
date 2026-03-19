# API contract draft

## Authentication

### `POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

### `POST /api/auth/totp/verify`

```json
{
  "code": "123456"
}
```

## Fetch board

### `GET /api/boards/:boardId`

```json
{
  "board": {
    "id": "board_1",
    "title": "Launch plan",
    "columnIds": ["col_1", "col_2"],
    "revision": 84
  },
  "columns": [
    {
      "id": "col_1",
      "title": "To do",
      "position": 1000,
      "cardIds": ["card_1"]
    }
  ],
  "cards": [
    {
      "id": "card_1",
      "columnId": "col_1",
      "title": "Prepare roadmap",
      "descriptionDocId": "ydoc_card_1",
      "position": 1000,
      "lock": null
    }
  ],
  "presence": {
    "activeUsers": 3
  }
}
```

## Move card

### `POST /api/cards/reorder`

```json
{
  "cardId": "card_1",
  "sourceColumnId": "col_1",
  "destinationColumnId": "col_2",
  "beforeCardId": null,
  "afterCardId": "card_8",
  "clientMutationId": "mut_123"
}
```

Response:

```json
{
  "card": {
    "id": "card_1",
    "columnId": "col_2",
    "position": 1500
  },
  "boardRevision": 85,
  "eventId": "evt_9001"
}
```

## Presence updates

### `GET /api/boards/:boardId/presence`

```json
{
  "members": [
    {
      "userId": "user_42",
      "name": "Hemakura",
      "activeCardId": "card_1",
      "cursor": { "x": 100, "y": 120 }
    }
  ]
}
```

## Card field locks

### `POST /api/cards/:cardId/locks`

```json
{
  "fieldName": "title"
}
```

### `DELETE /api/cards/:cardId/locks/:lockId`

## Automations

### `POST /api/boards/:boardId/automations`

```json
{
  "name": "Move done cards to notify",
  "trigger": "card.moved",
  "conditions": [
    { "field": "destinationColumnId", "operator": "equals", "value": "done" }
  ],
  "actions": [
    { "type": "notify.telegram", "template": "{{card.title}} done" }
  ]
}
```

### `GET /api/boards/:boardId/automations/executions`

Returns recent automation runs and failures.

## Search

### `GET /api/search?query=assignee:me%20and%20due:today`

Response shape:

```json
{
  "items": [
    {
      "type": "card",
      "id": "card_7",
      "title": "Fix due-date parser",
      "boardId": "board_1",
      "columnId": "col_doing"
    }
  ],
  "parsedQuery": {
    "assignee": "me",
    "due": "today"
  }
}
```

## Analytics

### `GET /api/boards/:boardId/analytics/summary?range=30d`

```json
{
  "cycleTimeP50Hours": 18.4,
  "cycleTimeP90Hours": 42.1,
  "throughput": 24,
  "overdueCards": 3
}
```

## WebSocket channels

### Board room

Channel scope: `/boards/:boardId`

Event examples:

- `presence.updated`
- `card.moved`
- `card.updated`
- `card.locked`
- `card.unlocked`
- `automation.executed`

### Collaboration room

Channel scope: `/collab/cards/:cardId`

Event examples:

- `yjs.update`
- `cursor.updated`
- `awareness.updated`

## Error model

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Destination column does not belong to the board"
  }
}
```
