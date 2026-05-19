import type { CollageLayout, SlotState } from "./types.js";

/** Slot indices assigned to a participant (sorted). */
export function slotsForParticipant(
  layout: CollageLayout,
  participantId: string
): number[] {
  return layout.slots
    .filter((s) => s.assignedTo === participantId)
    .map((s) => s.index)
    .sort((a, b) => a - b);
}

export function participantPhotoProgress(
  layout: CollageLayout,
  collageSlots: SlotState[],
  participantId: string
): { filled: number; total: number } {
  const assigned = slotsForParticipant(layout, participantId);
  const filled = assigned.filter((idx) => {
    const slot = collageSlots.find((c) => c.index === idx);
    return Boolean(slot?.photoUrl || slot?.thumbnailUrl);
  }).length;
  return { filled, total: assigned.length };
}

export function formatSlotNumbers(slots: number[]): string {
  return slots.map((n) => String(n + 1)).join(", ");
}
