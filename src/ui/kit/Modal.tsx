"use client";

import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
  /** Footer actions (right-aligned). */
  actions?: ReactNode;
}

/** Rare, deliberate: skewed sheet on a dim veil (UI_UX_DESIGN §4). */
export function Modal({ open, title, onClose, children, actions }: ModalProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="skewed panel-shadow w-full max-w-lg overflow-hidden rounded-sm bg-paper-050"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="unskew px-8 py-6">
          <h2 className="display-hero slash-underline mb-6 text-3xl text-ink-900">{title}</h2>
          <div className="text-ink-900">{children}</div>
          {actions && <div className="mt-8 flex justify-end gap-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
