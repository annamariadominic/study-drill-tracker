"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InlineAlert } from "./feedback";
import { RowList } from "./list";

export type SortableItem = {
  id: string;
  /** Names the item for its drag handle and screen-reader announcements. */
  label: string;
  content: ReactNode;
};

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * A hairline list whose rows can be dragged into a new order by a handle, with
 * the pointer or the keyboard. Each new order is sent to `saveUrl` as
 * `{ [idsKey]: ids }` and the page's server data refreshed; if the save fails,
 * the list goes back to the order last saved on the server.
 */
export function SortableList({
  items,
  saveUrl,
  idsKey,
  className,
  itemClassName,
}: {
  items: SortableItem[];
  saveUrl: string;
  /** The request-body key the ordered ids are sent under. */
  idsKey: string;
  className?: string;
  itemClassName?: string;
}) {
  const router = useRouter();
  const contextId = useId();
  const serverOrder = items.map((item) => item.id);
  const [order, setOrder] = useState(serverOrder);
  const [lastServerOrder, setLastServerOrder] = useState(serverOrder);
  const [saving, setSaving] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [saveFailed, setSaveFailed] = useState(false);

  // Take up the server's order whenever it changes, e.g. after a refresh.
  if (serverOrder.join() !== lastServerOrder.join()) {
    setLastServerOrder(serverOrder);
    setOrder(serverOrder);
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = order.flatMap((id) => byId.get(id) ?? []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: UniqueIdentifier) => byId.get(String(id))?.label ?? "item";
  const placeOf = (id: UniqueIdentifier) => `position ${order.indexOf(String(id)) + 1} of ${order.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${labelOf(active.id)}, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${labelOf(active.id)} moved to ${placeOf(over.id)}.` : `${labelOf(active.id)} is outside the list.`,
    onDragEnd: ({ active, over }) =>
      over ? `${labelOf(active.id)} dropped at ${placeOf(over.id)}.` : `${labelOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${labelOf(active.id)} cancelled.`,
  };

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) {
      return;
    }
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    setSaving(true);
    setSaveFailed(false);
    try {
      const response = await fetch(saveUrl, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [idsKey]: next }),
      });
      // Anything but 204 (including a redirect to /login) means it wasn't saved.
      if (response.status !== 204) {
        throw new Error(`Saving the order failed: ${response.status}`);
      }
    } catch {
      setOrder(lastServerOrder);
      setSaveFailed(true);
    } finally {
      setSaving(false);
      // Rows stay locked until the refreshed order arrives, so a late refresh
      // can't overwrite a newer drag.
      startRefresh(() => router.refresh());
    }
  }

  return (
    <>
      {saveFailed ? <InlineAlert className="mb-4">Couldn&apos;t save the new order. Please try again.</InlineAlert> : null}
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To reorder, press space or enter to pick up this item, use the up and down arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.",
          },
        }}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <RowList className={className}>
            {shown.map((item) => (
              <SortableRow key={item.id} item={item} disabled={saving || refreshing} className={itemClassName} />
            ))}
          </RowList>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableRow({ item, disabled, className }: { item: SortableItem; disabled: boolean; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex items-center gap-1 bg-bg",
        isDragging && "z-10 rounded-control shadow-lg ring-1 ring-line-strong",
        className,
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${item.label}`}
        className="-ml-2 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-control text-faint transition-colors duration-150 hover:bg-surface hover:text-muted active:cursor-grabbing aria-disabled:cursor-default aria-disabled:opacity-50"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{item.content}</div>
    </li>
  );
}
