import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CardItem } from './CardItem';
import type { Card, CardTag, Column } from '../store';

export function BoardColumn({
  column,
  cards,
  tagsByCard,
  activeCardId,
  onOpenCard
}: {
  column: Column;
  cards: Card[];
  tagsByCard: Record<string, CardTag[]>;
  activeCardId: string | null;
  onOpenCard: (cardId: string) => void;
}) {
  return (
    <section className="column">
      <header className="column__header">
        <div>
          <p className="column__eyebrow">Column</p>
          <h2>{column.title}</h2>
        </div>
        <span className="column__count">{cards.length}</span>
      </header>
      <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
        <div className="column__cards">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              tags={tagsByCard[card.id] ?? []}
              isActive={activeCardId === card.id}
              onOpen={() => onOpenCard(card.id)}
            />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}
