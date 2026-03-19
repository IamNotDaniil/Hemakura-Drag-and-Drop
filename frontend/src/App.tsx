import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { FormEvent, useMemo, useState } from 'react';
import { BoardColumn } from './components/BoardColumn';
import { useBoardStore } from './store';

function CardDetailsPanel() {
  const activeCardId = useBoardStore((state) => state.activeCardId);
  const card = useBoardStore((state) => (activeCardId ? state.cards[activeCardId] : null));
  const tags = useBoardStore((state) => state.tags);
  const updateCard = useBoardStore((state) => state.updateCard);
  const addTagToCard = useBoardStore((state) => state.addTagToCard);
  const addCommentToCard = useBoardStore((state) => state.addCommentToCard);
  const addAttachmentToCard = useBoardStore((state) => state.addAttachmentToCard);
  const [tagDraft, setTagDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [attachmentDraft, setAttachmentDraft] = useState('');

  if (!card) {
    return (
      <aside className="details-panel details-panel--empty">
        <h2>Card details</h2>
        <p>Select a card to edit title and description, add tags, comments, and attachments.</p>
      </aside>
    );
  }

  const cardTags = card.tagIds.map((tagId) => tags[tagId]).filter(Boolean);

  const submitTag = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addTagToCard(card.id, tagDraft);
    setTagDraft('');
  };

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addCommentToCard(card.id, commentDraft);
    setCommentDraft('');
  };

  const submitAttachment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addAttachmentToCard(card.id, attachmentDraft);
    setAttachmentDraft('');
  };

  return (
    <aside className="details-panel">
      <h2>Card details</h2>
      <label>
        Title
        <input value={card.title} onChange={(event) => updateCard(card.id, { title: event.target.value })} />
      </label>
      <label>
        Description
        <textarea
          rows={5}
          value={card.description}
          onChange={(event) => updateCard(card.id, { description: event.target.value })}
        />
      </label>
      <div className="details-panel__meta">
        <span>Assignee: {card.assignee}</span>
        <span>Due: {card.dueDate}</span>
      </div>

      <section className="details-section">
        <div className="details-section__header">
          <h3>Tags</h3>
          <span>{cardTags.length}</span>
        </div>
        <div className="card__tags">
          {cardTags.map((tag) => (
            <span key={tag.id} className="tag-pill" style={{ backgroundColor: tag.color }}>
              {tag.name}
            </span>
          ))}
        </div>
        <form onSubmit={submitTag} className="inline-form">
          <input value={tagDraft} placeholder="Add tag" onChange={(event) => setTagDraft(event.target.value)} />
          <button type="submit">Add</button>
        </form>
      </section>

      <section className="details-section">
        <div className="details-section__header">
          <h3>Comments</h3>
          <span>{card.comments.length}</span>
        </div>
        <div className="stack-list">
          {card.comments.map((comment) => (
            <article key={comment.id} className="stack-list__item">
              <strong>{comment.author}</strong>
              <p>{comment.body}</p>
              <small>{comment.createdAt}</small>
            </article>
          ))}
        </div>
        <form onSubmit={submitComment} className="inline-form">
          <input
            value={commentDraft}
            placeholder="Leave a comment"
            onChange={(event) => setCommentDraft(event.target.value)}
          />
          <button type="submit">Post</button>
        </form>
      </section>

      <section className="details-section">
        <div className="details-section__header">
          <h3>Attachments</h3>
          <span>{card.attachments.length}</span>
        </div>
        <div className="stack-list">
          {card.attachments.map((attachment) => (
            <article key={attachment.id} className="stack-list__item stack-list__item--row">
              <span>{attachment.fileName}</span>
              <a href={attachment.fileUrl}>Open</a>
            </article>
          ))}
        </div>
        <form onSubmit={submitAttachment} className="inline-form">
          <input
            value={attachmentDraft}
            placeholder="Attach file name"
            onChange={(event) => setAttachmentDraft(event.target.value)}
          />
          <button type="submit">Attach</button>
        </form>
      </section>
    </aside>
  );
}

function InsightsPanel() {
  return (
    <section className="insights-panel">
      <div className="insight-card">
        <span>Cycle time P50</span>
        <strong>18.4h</strong>
      </div>
      <div className="insight-card">
        <span>Throughput</span>
        <strong>24</strong>
      </div>
      <div className="insight-card">
        <span>Overdue</span>
        <strong>3</strong>
      </div>
      <div className="insight-card insight-card--wide">
        <span>Automation</span>
        <p>When a card moves to Done, notify Telegram and refresh analytics.</p>
      </div>
    </section>
  );
}

export default function App() {
  const columns = useBoardStore((state) => state.columns);
  const cards = useBoardStore((state) => state.cards);
  const tags = useBoardStore((state) => state.tags);
  const columnOrder = useBoardStore((state) => state.columnOrder);
  const search = useBoardStore((state) => state.search);
  const activeCardId = useBoardStore((state) => state.activeCardId);
  const setSearch = useBoardStore((state) => state.setSearch);
  const setActiveCardId = useBoardStore((state) => state.setActiveCardId);
  const moveCard = useBoardStore((state) => state.moveCard);
  const statusMessage = useBoardStore((state) => state.statusMessage);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filteredColumns = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return columnOrder.map((columnId) => {
      const column = columns[columnId];
      const columnCards = column.cardIds
        .map((cardId) => cards[cardId])
        .filter((card) => {
          if (!normalizedSearch) {
            return true;
          }

          const tagNames = card.tagIds.map((tagId) => tags[tagId]?.name ?? '');
          return [card.title, card.description, card.assignee, ...tagNames].some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          );
        });

      return {
        ...column,
        cards: columnCards,
        tagsByCard: Object.fromEntries(
          columnCards.map((card) => [card.id, card.tagIds.map((tagId) => tags[tagId]).filter(Boolean)])
        )
      };
    });
  }, [cards, columnOrder, columns, search, tags]);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!over || active.id === over.id) {
      return;
    }

    await moveCard({ activeId: String(active.id), overId: String(over.id) });
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="hero__eyebrow">HEMAKURA</p>
          <h1>Collaborative Kanban board starter</h1>
          <p className="hero__copy">
            A runnable frontend scaffold with dnd-kit interactions, Zustand state, inline editing, optimistic reorder,
            and starter analytics + automation surfaces.
          </p>
        </div>
        <div className="hero__stats">
          <div>
            <strong>3</strong>
            <span>Columns</span>
          </div>
          <div>
            <strong>4</strong>
            <span>Cards</span>
          </div>
          <div>
            <strong>Live</strong>
            <span>Optimistic UI</span>
          </div>
        </div>
      </header>

      <InsightsPanel />

      <section className="toolbar">
        <input
          className="toolbar__search"
          placeholder="Search cards, assignees, descriptions, or tags"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="toolbar__presence">
          <span className="presence presence--purple">HK</span>
          <span className="presence presence--blue">AI</span>
          <span className="presence presence--green">RN</span>
          <span className="toolbar__label">Realtime collaborators</span>
        </div>
      </section>

      <div className="status-banner">{statusMessage}</div>

      <main className="workspace">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => setDraggingId(String(active.id))}
          onDragEnd={handleDragEnd}
        >
          <section className="board-grid">
            {filteredColumns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                cards={column.cards}
                tagsByCard={column.tagsByCard}
                activeCardId={activeCardId}
                onOpenCard={setActiveCardId}
              />
            ))}
          </section>
          <DragOverlay>
            {draggingId ? <div className="drag-overlay">Moving {cards[draggingId]?.title}</div> : null}
          </DragOverlay>
        </DndContext>
        <CardDetailsPanel />
      </main>
    </div>
  );
}
