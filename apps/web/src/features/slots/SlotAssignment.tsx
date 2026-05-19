import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Participant } from "@photosocial/shared";
import { api } from "../../lib/api";
import { useSession } from "../../context/SessionContext";
import { CollageGrid } from "../collage/CollageGrid";
import { Button } from "../../components/Button";
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
  const { t } = useTranslation();
  const { code } = useParams();
  const navigate = useNavigate();
  const { stored, state, refresh } = useSession();
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(
    null
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!stored || !state) return null;

  const isHost = stored.isHost;
  const hostParticipant = state.participants.find(
    (p) => p.id === stored.participantId
  );
  const hostNeedsSlot = isHost && hostParticipant?.assignedSlot === null;

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

  async function assignHostAndShoot() {
    if (!stored || !state) return;
    const free = state.session.layout.slots.find((s) => !s.assignedTo);
    if (!free) return;
    await assign(stored.participantId, free.index);
    navigate(`/party/${code}/camera`);
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
          {hostNeedsSlot && (
            <Button fullWidth onClick={() => void assignHostAndShoot()}>
              {t("putMeInCollage")}
            </Button>
          )}
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
