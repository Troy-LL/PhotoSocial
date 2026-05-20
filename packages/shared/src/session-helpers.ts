import type { CollageLayout, SlotState } from "./types.js";

type SlotPhotoFields = Pick<SlotState, "photoUrl" | "thumbnailUrl">;

/** Whether a slot has any uploaded photo (full or thumbnail). */
export function slotHasPhoto(
  slot: SlotPhotoFields | null | undefined
): boolean {
  return Boolean(slot?.photoUrl || slot?.thumbnailUrl);
}

/** Best URL to display in collage previews (prefer full photo, fall back to thumb). */
export function slotPhotoDisplayUrl(
  slot: SlotPhotoFields | null | undefined
): string | null {
  if (!slot) return null;
  return slot.photoUrl ?? slot.thumbnailUrl ?? null;
}

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
    return slotHasPhoto(slot);
  }).length;
  return { filled, total: assigned.length };
}

export function formatSlotNumbers(slots: number[]): string {
  return slots.map((n) => String(n + 1)).join(", ");
}
