"use client";

import { Modal } from "@/components/ui/modal";

/**
 * Stub — full detail bottom sheet ships in Commit 5 (sub-score rings,
 * contributors list, baseline status, 30-day trend chart). For now the
 * hero card's tap opens an empty modal so the affordance reads.
 */
export function PeakStateDetailModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  rowDate: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Peak State"
      description="Detail view coming next"
      size="lg"
    >
      <p className="text-sm text-[var(--color-fg-2)]">
        Sub-score breakdown, contributors, baseline status, and the
        30-day trend land in Commit 5 of this feature.
      </p>
    </Modal>
  );
}
