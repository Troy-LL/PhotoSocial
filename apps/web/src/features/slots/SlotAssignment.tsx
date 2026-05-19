import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Participant } from "@passandpic/shared";
import { api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import { CollageGrid } from "../collage/CollageGrid";
import styles from "./SlotAssignment.module.css";

function DraggableParticipant({
  participant,
  selected,
  onSelect,
}: {
  participant: Participant;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: participant.id,
    data: { participant },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`${styles.participant} ${isDragging ? styles.dragging : ""} ${selected ? styles.selected : ""}`}
      {...listeners}
      {...attributes}
      onClick={onSelect}
    >
      {participant.displayName}
    </button>
  );
}

export function SlotAssignment() {
  const { stored, state, refresh } = useSession();
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!stored || !state) return null;

  const unassigned = state.participants.filter(
    (p) =>
      p.assignedSlot === null &&
      !state.collage.slots.some(
        (s) => s.participantId === p.id && s.photoUrl
      )
  );

  async function assign(participantId: string, slotIndex: number) {
    await api.assignSlot(stored!.sessionId, stored!.wsToken, {
      participantId,
      slotIndex,
    });
    setSelectedParticipant(null);
    await refresh();
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !String(over.id).startsWith("slot-")) return;
    const slotIndex = Number(String(over.id).replace("slot-", ""));
    void assign(active.id as string, slotIndex);
  }

  const activeParticipant = state.participants.find((p) => p.id === activeId);

  return (
    <DndContext
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <h2>Participants</h2>
          <p className={styles.hint}>
            Drag onto a slot, or select a name then tap a slot
          </p>
          {unassigned.map((p) => (
            <DraggableParticipant
              key={p.id}
              participant={p}
              selected={selectedParticipant === p.id}
              onSelect={() =>
                setSelectedParticipant(
                  selectedParticipant === p.id ? null : p.id
                )
              }
            />
          ))}
          {unassigned.length === 0 && (
            <p className={styles.hint}>Everyone assigned!</p>
          )}
        </aside>

        <div className={styles.gridWrap}>
          <CollageGrid
            state={state}
            droppableSlots
            onSlotClick={(idx) => {
              if (selectedParticipant) {
                void assign(selectedParticipant, idx);
              } else if (activeId) {
                void assign(activeId, idx);
              }
            }}
          />
        </div>
        </div>

      <DragOverlay>
        {activeParticipant ? (
          <span className={styles.participant}>
            {activeParticipant.displayName}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
