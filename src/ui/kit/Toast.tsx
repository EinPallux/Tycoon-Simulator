"use client";

import { create } from "zustand";

export type ToastTone = "info" | "success" | "warning" | "danger";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

let toastCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (tone, message) => {
    const id = ++toastCounter;
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, tone, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper usable from anywhere in the UI layer. */
export const toast = (tone: ToastTone, message: string): void =>
  useToastStore.getState().push(tone, message);

const TONE_BAR: Record<ToastTone, string> = {
  info: "bg-info-400",
  success: "bg-good-500",
  warning: "bg-card-orange",
  danger: "bg-danger-500",
};

/** Bottom-right toast rail (UI_UX_DESIGN §7.4). Mount once per screen tree. */
export function ToastRail() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className="skewed panel-shadow pointer-events-auto flex cursor-pointer overflow-hidden bg-paper-050 text-left"
        >
          <span className={`w-1.5 shrink-0 ${TONE_BAR[t.tone]}`} />
          <span className="unskew block px-3 py-2 text-sm font-medium text-ink-900">
            {t.message}
          </span>
        </button>
      ))}
    </div>
  );
}
