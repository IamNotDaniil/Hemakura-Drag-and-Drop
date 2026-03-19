import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, CardTag } from '../store';

export function CardItem({
  card,
  tags,
  isActive,
  onOpen
}: {
  card: Card;
  tags: CardTag[];
  isActive: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`card ${isDragging ? 'card--dragging' : ''} ${isActive ? 'card--active' : ''}`}
      onClick={onOpen}
      {...attributes}
      {...listeners}
    >
      <div className="card__header">
        <h3>{card.title}</h3>
        <span>{card.assignee}</span>
      </div>
      <p>{card.description}</p>
      <div className="card__tags">
        {tags.map((tag) => (
          <span key={tag.id} className="tag-pill" style={{ backgroundColor: tag.color }}>
            {tag.name}
          </span>
        ))}
      </div>
      <footer className="card__footer">
        <span>{card.dueDate}</span>
        <span className="card__badge">{card.comments.length} comments</span>
      </footer>
    </article>
  );
}
