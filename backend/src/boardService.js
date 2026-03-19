import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from './auth.js';

const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

const initialBoard = () => ({
  id: 'board_1',
  title: 'HEMAKURA Demo Board',
  revision: 1,
  columns: [
    { id: 'todo', title: 'To Do', position: 1000, cardIds: ['card_1', 'card_2'] },
    { id: 'doing', title: 'In Progress', position: 2000, cardIds: ['card_3'] },
    { id: 'done', title: 'Done', position: 3000, cardIds: ['card_4'] }
  ],
  cards: [
    { id: 'card_1', columnId: 'todo', title: 'Implement dnd-kit board', description: 'Build real drag-and-drop board UI.', assignee: 'Hemakura', dueDate: '2026-03-22', position: 1000 },
    { id: 'card_2', columnId: 'todo', title: 'Wire collaborative presence', description: 'Show active collaborators and cursors.', assignee: 'Aiko', dueDate: '2026-03-24', position: 2000 },
    { id: 'card_3', columnId: 'doing', title: 'Prototype automation worker', description: 'Trigger notifications on Done.', assignee: 'Ren', dueDate: '2026-03-26', position: 1000 },
    { id: 'card_4', columnId: 'done', title: 'Sketch analytics dashboard', description: 'Show cycle time and throughput.', assignee: 'Mika', dueDate: '2026-03-28', position: 1000 }
  ],
  presence: [
    { userId: 'user_1', name: 'Hemakura', activeCardId: 'card_1', cursor: { x: 120, y: 96 } },
    { userId: 'user_2', name: 'Aiko', activeCardId: 'card_3', cursor: { x: 540, y: 220 } },
    { userId: 'user_3', name: 'Ren', activeCardId: null, cursor: { x: 860, y: 180 } }
  ],
  users: [],
  tags: [
    { id: 'tag_ui', boardId: 'board_1', name: 'UI', color: '#2563eb' },
    { id: 'tag_realtime', boardId: 'board_1', name: 'Realtime', color: '#7c3aed' }
  ],
  cardTags: {
    card_1: ['tag_ui'],
    card_2: ['tag_realtime']
  },
  comments: {
    card_1: []
  },
  attachments: {
    card_1: []
  }
});

const clone = (value) => structuredClone(value);
const findColumn = (board, columnId) => board.columns.find((column) => column.id === columnId);
const findCard = (board, cardId) => board.cards.find((card) => card.id === cardId);
const findColumnByCardId = (board, cardId) => board.columns.find((column) => column.cardIds.includes(cardId));

const recalculatePositions = (board, columnId) => {
  const column = findColumn(board, columnId);
  if (!column) return;
  column.cardIds.forEach((cardId, index) => {
    const card = findCard(board, cardId);
    if (card) {
      card.position = (index + 1) * 1000;
      card.columnId = columnId;
    }
  });
};

export function createBoardService() {
  const board = initialBoard();

  return {
    getBoard() {
      return clone(board);
    },
    getPresence() {
      return clone(board.presence);
    },
    getAnalyticsSummary() {
      const completedCards = board.cards.filter((card) => card.columnId === 'done').length;
      const overdueCards = board.cards.filter((card) => card.columnId !== 'done').length;

      return {
        cycleTimeP50Hours: 18.4,
        cycleTimeP90Hours: 42.1,
        throughput: completedCards,
        overdueCards
      };
    },
    async registerUser({ name, email, password }) {
      const existingUser = board.users.find((user) => user.email === email);
      if (existingUser) {
        throw new Error('EMAIL_TAKEN');
      }
      const user = {
        id: makeId('user'),
        name,
        email,
        passwordHash: await hashPassword(password)
      };
      board.users.push(user);
      return { id: user.id, name: user.name, email: user.email };
    },
    async loginUser({ email, password }) {
      const user = board.users.find((entry) => entry.email === email);
      if (!user) return null;
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) return null;
      return { id: user.id, name: user.name, email: user.email };
    },
    listTags() {
      return clone(board.tags);
    },
    addTag({ cardId, name, color }) {
      let tag = board.tags.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
      if (!tag) {
        tag = { id: makeId('tag'), boardId: 'board_1', name, color };
        board.tags.push(tag);
      }
      board.cardTags[cardId] ??= [];
      if (!board.cardTags[cardId].includes(tag.id)) {
        board.cardTags[cardId].push(tag.id);
      }
      return clone(tag);
    },
    listComments(cardId) {
      return clone(board.comments[cardId] ?? []);
    },
    addComment({ cardId, userId, body }) {
      const comment = { id: makeId('comment'), cardId, authorId: userId, body, createdAt: new Date().toISOString() };
      board.comments[cardId] ??= [];
      board.comments[cardId].push(comment);
      return clone(comment);
    },
    listAttachments(cardId) {
      return clone(board.attachments[cardId] ?? []);
    },
    addAttachment({ cardId, userId, fileName, fileUrl }) {
      const attachment = { id: makeId('attachment'), cardId, uploadedBy: userId, fileName, fileUrl, createdAt: new Date().toISOString() };
      board.attachments[cardId] ??= [];
      board.attachments[cardId].push(attachment);
      return clone(attachment);
    },
    reorderCard({ cardId, overId, destinationColumnId }) {
      const card = findCard(board, cardId);
      const sourceColumn = findColumnByCardId(board, cardId);
      const explicitDestination = destinationColumnId ? findColumn(board, destinationColumnId) : undefined;
      const overColumn = overId ? findColumnByCardId(board, overId) ?? findColumn(board, overId) : undefined;
      const destinationColumn = explicitDestination ?? overColumn;

      if (!card || !sourceColumn || !destinationColumn) {
        return null;
      }

      sourceColumn.cardIds = sourceColumn.cardIds.filter((id) => id !== cardId);
      const insertIndex = !overId || overId === destinationColumn.id ? destinationColumn.cardIds.length : Math.max(destinationColumn.cardIds.indexOf(overId), 0);
      destinationColumn.cardIds.splice(insertIndex, 0, cardId);

      recalculatePositions(board, sourceColumn.id);
      if (sourceColumn.id !== destinationColumn.id) {
        recalculatePositions(board, destinationColumn.id);
      }

      board.revision += 1;

      return {
        card: clone(findCard(board, cardId)),
        boardRevision: board.revision,
        eventId: `evt_${board.revision}`,
        columns: clone(board.columns)
      };
    }
  };
}
