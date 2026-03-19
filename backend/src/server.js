import express from 'express';
import cors from 'cors';
import { createBoardService } from './boardService.js';
import { createPostgresStore } from './postgresStore.js';
import { createToken, verifyToken } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());

const resolveStore = async () => {
  if (process.env.DATABASE_URL) {
    return createPostgresStore();
  }
  return createBoardService();
};

const authMiddleware = (request, response, next) => {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token ? verifyToken(token) : null;

  if (!user) {
    response.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Provide a valid Bearer token.'
      }
    });
    return;
  }

  request.user = user;
  next();
};

const store = await resolveStore();

app.get('/health', (_request, response) => {
  response.json({ ok: true, database: Boolean(process.env.DATABASE_URL) ? 'postgres' : 'memory' });
});

app.post('/api/auth/register', async (request, response) => {
  try {
    const user = await store.registerUser(request.body);
    const token = createToken({ sub: user.id, email: user.email, name: user.name });
    response.status(201).json({ user, token });
  } catch (error) {
    response.status(400).json({
      error: {
        code: error instanceof Error ? error.message : 'REGISTER_FAILED',
        message: 'Could not create account.'
      }
    });
  }
});

app.post('/api/auth/login', async (request, response) => {
  const user = await store.loginUser(request.body);
  if (!user) {
    response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    return;
  }
  const token = createToken({ sub: user.id, email: user.email, name: user.name });
  response.json({ user, token });
});

app.get('/api/boards/:boardId', async (_request, response) => {
  const board = await store.getBoard();

  response.json({
    board: {
      id: board.id,
      title: board.title,
      revision: board.revision,
      columnIds: board.columns.map((column) => column.id)
    },
    columns: board.columns,
    cards: board.cards,
    presence: {
      activeUsers: board.presence.length
    }
  });
});

app.get('/api/boards/:boardId/presence', async (_request, response) => {
  response.json({ members: await store.getPresence() });
});

app.get('/api/boards/:boardId/analytics/summary', async (_request, response) => {
  response.json(await store.getAnalyticsSummary());
});

app.get('/api/boards/:boardId/tags', async (_request, response) => {
  response.json({ tags: await store.listTags() });
});

app.post('/api/cards/reorder', authMiddleware, async (request, response) => {
  const result = await store.reorderCard(request.body);

  if (!result) {
    response.status(400).json({
      error: {
        code: 'INVALID_REORDER',
        message: 'Could not resolve card or destination column.'
      }
    });
    return;
  }

  response.json({ ok: true, ...result });
});

app.post('/api/cards/:cardId/tags', authMiddleware, async (request, response) => {
  const tag = await store.addTag({ cardId: request.params.cardId, ...request.body });
  response.status(201).json({ tag });
});

app.get('/api/cards/:cardId/comments', async (request, response) => {
  response.json({ comments: await store.listComments(request.params.cardId) });
});

app.post('/api/cards/:cardId/comments', authMiddleware, async (request, response) => {
  const comment = await store.addComment({
    cardId: request.params.cardId,
    userId: request.user.sub,
    body: request.body.body
  });
  response.status(201).json({ comment });
});

app.get('/api/cards/:cardId/attachments', async (request, response) => {
  response.json({ attachments: await store.listAttachments(request.params.cardId) });
});

app.post('/api/cards/:cardId/attachments', authMiddleware, async (request, response) => {
  const attachment = await store.addAttachment({
    cardId: request.params.cardId,
    userId: request.user.sub,
    fileName: request.body.fileName,
    fileUrl: request.body.fileUrl
  });
  response.status(201).json({ attachment });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`HEMAKURA backend listening on http://localhost:${port}`);
});
