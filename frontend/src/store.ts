import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';

export type CardComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type CardAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
};

export type CardTag = {
  id: string;
  name: string;
  color: string;
};

export type Card = {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  tagIds: string[];
  comments: CardComment[];
  attachments: CardAttachment[];
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

type BoardState = {
  cards: Record<string, Card>;
  columns: Record<string, Column>;
  tags: Record<string, CardTag>;
  columnOrder: string[];
  search: string;
  activeCardId: string | null;
  statusMessage: string;
  setSearch: (value: string) => void;
  updateCard: (cardId: string, patch: Partial<Card>) => void;
  addTagToCard: (cardId: string, tagName: string) => void;
  addCommentToCard: (cardId: string, body: string) => void;
  addAttachmentToCard: (cardId: string, fileName: string) => void;
  setActiveCardId: (cardId: string | null) => void;
  moveCard: (params: { activeId: string; overId: string }) => Promise<void>;
};

const initialTags: Record<string, CardTag> = {
  tag_ui: { id: 'tag_ui', name: 'UI', color: '#2563eb' },
  tag_realtime: { id: 'tag_realtime', name: 'Realtime', color: '#7c3aed' },
  tag_backend: { id: 'tag_backend', name: 'Backend', color: '#f97316' }
};

const initialCards: Record<string, Card> = {
  card_1: {
    id: 'card_1',
    title: 'Собрать drag-and-drop прототип',
    description: 'Подключить dnd-kit и сделать optimistic reorder.',
    assignee: 'Hemakura',
    dueDate: '2026-03-22',
    tagIds: ['tag_ui'],
    comments: [{ id: 'comment_1', author: 'Aiko', body: 'Давай ещё drag overlay улучшим.', createdAt: '2026-03-19 10:15' }],
    attachments: [{ id: 'attachment_1', fileName: 'wireframe.fig', fileUrl: '#' }]
  },
  card_2: {
    id: 'card_2',
    title: 'Спроектировать real-time слой',
    description: 'Определить события presence, locks и card.moved.',
    assignee: 'Aiko',
    dueDate: '2026-03-24',
    tagIds: ['tag_realtime'],
    comments: [],
    attachments: []
  },
  card_3: {
    id: 'card_3',
    title: 'Сделать automation rules',
    description: 'Триггер card.moved -> notify.telegram.',
    assignee: 'Ren',
    dueDate: '2026-03-26',
    tagIds: ['tag_backend'],
    comments: [],
    attachments: []
  },
  card_4: {
    id: 'card_4',
    title: 'Подготовить analytics dashboard',
    description: 'Cycle time, throughput, overdue cards.',
    assignee: 'Mika',
    dueDate: '2026-03-28',
    tagIds: ['tag_ui', 'tag_backend'],
    comments: [],
    attachments: []
  }
};

const initialColumns: Record<string, Column> = {
  todo: { id: 'todo', title: 'To Do', cardIds: ['card_1', 'card_2'] },
  doing: { id: 'doing', title: 'In Progress', cardIds: ['card_3'] },
  done: { id: 'done', title: 'Done', cardIds: ['card_4'] }
};

const fakePersist = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 350);
  });

const findContainerByItem = (columns: Record<string, Column>, itemId: string): string | undefined => {
  if (itemId in columns) {
    return itemId;
  }

  return Object.values(columns).find((column) => column.cardIds.includes(itemId))?.id;
};

export const useBoardStore = create<BoardState>((set, get) => ({
  cards: initialCards,
  columns: initialColumns,
  tags: initialTags,
  columnOrder: ['todo', 'doing', 'done'],
  search: '',
  activeCardId: null,
  statusMessage: 'Ready to organize work.',
  setSearch: (value) => set({ search: value }),
  setActiveCardId: (cardId) => set({ activeCardId: cardId }),
  updateCard: (cardId, patch) =>
    set((state) => ({
      cards: {
        ...state.cards,
        [cardId]: {
          ...state.cards[cardId],
          ...patch
        }
      },
      statusMessage: `Card ${cardId} updated locally.`
    })),
  addTagToCard: (cardId, tagName) =>
    set((state) => {
      const normalizedName = tagName.trim();
      if (!normalizedName) {
        return state;
      }

      const existingTag = Object.values(state.tags).find(
        (tag) => tag.name.toLowerCase() === normalizedName.toLowerCase()
      );
      const tagId = existingTag?.id ?? `tag_${normalizedName.toLowerCase().replace(/\s+/g, '_')}`;
      const tag = existingTag ?? { id: tagId, name: normalizedName, color: '#14b8a6' };
      const currentTagIds = state.cards[cardId].tagIds;

      return {
        tags: {
          ...state.tags,
          [tagId]: tag
        },
        cards: {
          ...state.cards,
          [cardId]: {
            ...state.cards[cardId],
            tagIds: currentTagIds.includes(tagId) ? currentTagIds : [...currentTagIds, tagId]
          }
        },
        statusMessage: `Added tag ${normalizedName} to ${cardId}.`
      };
    }),
  addCommentToCard: (cardId, body) =>
    set((state) => {
      const trimmedBody = body.trim();
      if (!trimmedBody) {
        return state;
      }

      return {
        cards: {
          ...state.cards,
          [cardId]: {
            ...state.cards[cardId],
            comments: [
              ...state.cards[cardId].comments,
              {
                id: `comment_${Date.now()}`,
                author: 'Hemakura',
                body: trimmedBody,
                createdAt: new Date().toLocaleString()
              }
            ]
          }
        },
        statusMessage: `Added comment to ${cardId}.`
      };
    }),
  addAttachmentToCard: (cardId, fileName) =>
    set((state) => {
      const trimmedFileName = fileName.trim();
      if (!trimmedFileName) {
        return state;
      }

      return {
        cards: {
          ...state.cards,
          [cardId]: {
            ...state.cards[cardId],
            attachments: [
              ...state.cards[cardId].attachments,
              {
                id: `attachment_${Date.now()}`,
                fileName: trimmedFileName,
                fileUrl: '#'
              }
            ]
          }
        },
        statusMessage: `Added attachment ${trimmedFileName} to ${cardId}.`
      };
    }),
  moveCard: async ({ activeId, overId }) => {
    const snapshot = get();
    const sourceColumnId = findContainerByItem(snapshot.columns, activeId);
    const targetColumnId = findContainerByItem(snapshot.columns, overId);

    if (!sourceColumnId || !targetColumnId) {
      return;
    }

    set((state) => {
      const nextColumns = { ...state.columns };
      const sourceCards = [...nextColumns[sourceColumnId].cardIds];
      const targetCards = sourceColumnId === targetColumnId ? sourceCards : [...nextColumns[targetColumnId].cardIds];
      const sourceIndex = sourceCards.indexOf(activeId);
      const targetIndex = overId in nextColumns ? targetCards.length : targetCards.indexOf(overId);

      if (sourceColumnId === targetColumnId) {
        nextColumns[sourceColumnId] = {
          ...nextColumns[sourceColumnId],
          cardIds: arrayMove(sourceCards, sourceIndex, targetIndex)
        };
      } else {
        sourceCards.splice(sourceIndex, 1);
        const insertAt = targetIndex < 0 ? targetCards.length : targetIndex;
        targetCards.splice(insertAt, 0, activeId);

        nextColumns[sourceColumnId] = {
          ...nextColumns[sourceColumnId],
          cardIds: sourceCards
        };
        nextColumns[targetColumnId] = {
          ...nextColumns[targetColumnId],
          cardIds: targetCards
        };
      }

      return {
        columns: nextColumns,
        statusMessage: `Optimistic update: moved ${activeId} to ${targetColumnId}.`
      };
    });

    try {
      await fakePersist();
      set({ statusMessage: `Server confirmed ${activeId} reorder.` });
    } catch {
      set({
        columns: snapshot.columns,
        statusMessage: `Server rejected ${activeId} reorder, rolled back.`
      });
    }
  }
}));
