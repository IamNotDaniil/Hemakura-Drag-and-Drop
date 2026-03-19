import crypto from 'node:crypto';
import { Pool } from 'pg';
import { hashPassword, verifyPassword } from './auth.js';

const makeId = (prefix) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

export async function createPostgresStore() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async function init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS columns (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        assignee TEXT NOT NULL DEFAULT '',
        due_date DATE,
        position INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        UNIQUE(board_id, name)
      );
      CREATE TABLE IF NOT EXISTS card_tags (
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (card_id, tag_id)
      );
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const boardResult = await pool.query('SELECT id FROM boards WHERE id = $1', ['board_1']);
    if (boardResult.rowCount === 0) {
      await pool.query("INSERT INTO boards (id, title, revision) VALUES ('board_1', 'HEMAKURA Demo Board', 1)");
      await pool.query(`
        INSERT INTO columns (id, board_id, title, position) VALUES
        ('todo', 'board_1', 'To Do', 1000),
        ('doing', 'board_1', 'In Progress', 2000),
        ('done', 'board_1', 'Done', 3000)
      `);
      await pool.query(`
        INSERT INTO cards (id, column_id, title, description, assignee, due_date, position) VALUES
        ('card_1', 'todo', 'Implement dnd-kit board', 'Build real drag-and-drop board UI.', 'Hemakura', '2026-03-22', 1000),
        ('card_2', 'todo', 'Wire collaborative presence', 'Show active collaborators and cursors.', 'Aiko', '2026-03-24', 2000),
        ('card_3', 'doing', 'Prototype automation worker', 'Trigger notifications on Done.', 'Ren', '2026-03-26', 1000),
        ('card_4', 'done', 'Sketch analytics dashboard', 'Show cycle time and throughput.', 'Mika', '2026-03-28', 1000)
      `);
    }
  }

  const getBoard = async () => {
    const board = (await pool.query('SELECT * FROM boards WHERE id = $1', ['board_1'])).rows[0];
    const columns = (await pool.query('SELECT * FROM columns WHERE board_id = $1 ORDER BY position', ['board_1'])).rows;
    const cards = (await pool.query('SELECT * FROM cards WHERE column_id = ANY($1::text[]) ORDER BY position', [columns.map((column) => column.id)])).rows;
    return {
      id: board.id,
      title: board.title,
      revision: board.revision,
      columns: columns.map((column) => ({
        id: column.id,
        title: column.title,
        position: column.position,
        cardIds: cards.filter((card) => card.column_id === column.id).map((card) => card.id)
      })),
      cards: cards.map((card) => ({
        id: card.id,
        columnId: card.column_id,
        title: card.title,
        description: card.description,
        assignee: card.assignee,
        dueDate: card.due_date,
        position: card.position
      })),
      presence: []
    };
  };

  const reorderCard = async ({ cardId, overId, destinationColumnId }) => {
    const board = await getBoard();
    const sourceColumn = board.columns.find((column) => column.cardIds.includes(cardId));
    const destinationColumn = destinationColumnId
      ? board.columns.find((column) => column.id === destinationColumnId)
      : board.columns.find((column) => column.cardIds.includes(overId)) ?? board.columns.find((column) => column.id === overId);
    if (!sourceColumn || !destinationColumn) return null;

    const sourceCards = sourceColumn.cardIds.filter((id) => id !== cardId);
    const targetCards = sourceColumn.id === destinationColumn.id ? sourceCards : [...destinationColumn.cardIds];
    const insertIndex = !overId || overId === destinationColumn.id ? targetCards.length : Math.max(targetCards.indexOf(overId), 0);
    targetCards.splice(insertIndex, 0, cardId);

    await pool.query('BEGIN');
    try {
      sourceColumn.cardIds = sourceCards;
      destinationColumn.cardIds = targetCards;
      for (const [index, id] of sourceColumn.cardIds.entries()) {
        await pool.query('UPDATE cards SET column_id = $1, position = $2 WHERE id = $3', [sourceColumn.id, (index + 1) * 1000, id]);
      }
      for (const [index, id] of destinationColumn.cardIds.entries()) {
        await pool.query('UPDATE cards SET column_id = $1, position = $2 WHERE id = $3', [destinationColumn.id, (index + 1) * 1000, id]);
      }
      const revision = (await pool.query('UPDATE boards SET revision = revision + 1 WHERE id = $1 RETURNING revision', ['board_1'])).rows[0].revision;
      await pool.query('COMMIT');
      const updatedCard = (await pool.query('SELECT * FROM cards WHERE id = $1', [cardId])).rows[0];
      const refreshedBoard = await getBoard();
      return {
        card: {
          id: updatedCard.id,
          columnId: updatedCard.column_id,
          title: updatedCard.title,
          description: updatedCard.description,
          assignee: updatedCard.assignee,
          dueDate: updatedCard.due_date,
          position: updatedCard.position
        },
        boardRevision: revision,
        eventId: `evt_${revision}`,
        columns: refreshedBoard.columns
      };
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  };

  const registerUser = async ({ name, email, password }) => {
    const id = makeId('user');
    const passwordHash = await hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [id, name, email, passwordHash]
    );
    return result.rows[0];
  };

  const loginUser = async ({ email, password }) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return null;
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return null;
    return { id: user.id, name: user.name, email: user.email };
  };

  const listTags = async () => (await pool.query('SELECT * FROM tags WHERE board_id = $1 ORDER BY name', ['board_1'])).rows;
  const addTag = async ({ cardId, name, color }) => {
    let tag = (await pool.query('SELECT * FROM tags WHERE board_id = $1 AND name = $2', ['board_1', name])).rows[0];
    if (!tag) {
      tag = (await pool.query('INSERT INTO tags (id, board_id, name, color) VALUES ($1, $2, $3, $4) RETURNING *', [makeId('tag'), 'board_1', name, color])).rows[0];
    }
    await pool.query('INSERT INTO card_tags (card_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [cardId, tag.id]);
    return tag;
  };

  const listComments = async (cardId) => (await pool.query('SELECT c.id, c.body, c.created_at, u.name AS author_name FROM comments c JOIN users u ON u.id = c.author_id WHERE c.card_id = $1 ORDER BY c.created_at', [cardId])).rows;
  const addComment = async ({ cardId, userId, body }) => (await pool.query('INSERT INTO comments (id, card_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING id, card_id, body, created_at', [makeId('comment'), cardId, userId, body])).rows[0];
  const listAttachments = async (cardId) => (await pool.query('SELECT * FROM attachments WHERE card_id = $1 ORDER BY created_at DESC', [cardId])).rows;
  const addAttachment = async ({ cardId, userId, fileName, fileUrl }) => (await pool.query('INSERT INTO attachments (id, card_id, uploaded_by, file_name, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING *', [makeId('attachment'), cardId, userId, fileName, fileUrl])).rows[0];

  await init();

  return {
    getBoard,
    getPresence: async () => [],
    getAnalyticsSummary: async () => {
      const board = await getBoard();
      return {
        cycleTimeP50Hours: 18.4,
        cycleTimeP90Hours: 42.1,
        throughput: board.cards.filter((card) => card.columnId === 'done').length,
        overdueCards: board.cards.filter((card) => card.columnId !== 'done').length
      };
    },
    reorderCard,
    registerUser,
    loginUser,
    listTags,
    addTag,
    listComments,
    addComment,
    listAttachments,
    addAttachment
  };
}
