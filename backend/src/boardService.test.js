import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardService } from './boardService.js';

test('reorders a card within the same column', () => {
  const service = createBoardService();
  const result = service.reorderCard({ cardId: 'card_2', overId: 'card_1' });
  assert.ok(result);
  assert.equal(result.card.columnId, 'todo');
  assert.deepEqual(result.columns.find((column) => column.id === 'todo')?.cardIds, ['card_2', 'card_1']);
});

test('moves a card into another column', () => {
  const service = createBoardService();
  const result = service.reorderCard({ cardId: 'card_2', overId: 'card_3' });
  assert.ok(result);
  assert.equal(result.card.columnId, 'doing');
  assert.deepEqual(result.columns.find((column) => column.id === 'todo')?.cardIds, ['card_1']);
  assert.deepEqual(result.columns.find((column) => column.id === 'doing')?.cardIds, ['card_2', 'card_3']);
});

test('registers and logs in a real user account', async () => {
  const service = createBoardService();
  const user = await service.registerUser({ name: 'Hemakura', email: 'hk@example.com', password: 'secret123' });
  assert.equal(user.email, 'hk@example.com');
  const loggedIn = await service.loginUser({ email: 'hk@example.com', password: 'secret123' });
  assert.equal(loggedIn?.name, 'Hemakura');
});

test('adds tags, comments, and attachments to cards', () => {
  const service = createBoardService();
  const tag = service.addTag({ cardId: 'card_1', name: 'Backend', color: '#f97316' });
  const comment = service.addComment({ cardId: 'card_1', userId: 'user_1', body: 'Need persistence before release.' });
  const attachment = service.addAttachment({ cardId: 'card_1', userId: 'user_1', fileName: 'spec.pdf', fileUrl: 'https://files.example/spec.pdf' });

  assert.equal(tag.name, 'Backend');
  assert.equal(service.listComments('card_1')[0].body, 'Need persistence before release.');
  assert.equal(service.listAttachments('card_1')[0].fileName, 'spec.pdf');
  assert.equal(comment.cardId, 'card_1');
  assert.equal(attachment.cardId, 'card_1');
});

test('returns analytics summary for the board', () => {
  const service = createBoardService();
  const summary = service.getAnalyticsSummary();
  assert.equal(summary.throughput, 1);
  assert.equal(summary.overdueCards, 3);
});
