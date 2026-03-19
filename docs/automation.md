# Automation engine design

## Vision

Automation turns HEMAKURA from a task board into an operational workflow tool. Users should be able to define rules in the UI without writing code.

## Rule model

A rule contains:

- `trigger`
- `conditions`
- `actions`
- `enabled`
- `scope` (workspace or board)
- `cooldown` / deduplication settings

Example:

```json
{
  "name": "Notify Telegram when work is done",
  "trigger": "card.moved",
  "conditions": [
    { "field": "destinationColumnId", "operator": "equals", "value": "done" }
  ],
  "actions": [
    { "type": "notify.telegram", "template": "{{card.title}} completed" }
  ]
}
```

## Trigger categories

### Event triggers

- card created / moved / updated
- due date changed
- checklist completed
- comment added
- PR merged via GitHub webhook

### Scheduled triggers

- every day / week / month
- cron expressions for advanced users
- relative reminders such as `1h before due date`

## Action categories

- create card
- move card
- update card fields
- assign user
- post Slack or Telegram message
- create GitHub issue or comment on PR
- send email or in-app notification
- invoke generic webhook

## Execution pipeline

1. Board mutation emits a domain event.
2. Automation module matches enabled rules by trigger.
3. Conditions are evaluated against the event payload plus current DB state.
4. Matching actions are transformed into BullMQ jobs.
5. Workers execute actions with retries and dead-letter handling.
6. Execution results are written to an automation log visible in the UI.

## Safety requirements

- idempotency keys for external side effects;
- recursion protection so rules do not trigger themselves forever;
- rate limits per rule and per integration;
- secret storage for API tokens;
- dry-run / test mode in the rule builder.

## Suggested MVP

Start with:

- `card.moved` trigger
- scheduled recurring card creation
- overdue card highlighting
- Telegram/Slack notification action
- execution history page
