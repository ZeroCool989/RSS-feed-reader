"use client";

import { X } from "lucide-react";
import { useStore } from "@/lib/store";

export default function Toast() {
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg"
    >
      <span className="text-sm text-text-primary">{toast.message}</span>
      {toast.undo && (
        <button
          onClick={() => {
            toast.undo?.();
            dismissToast();
          }}
          className="text-sm font-semibold text-accent hover:text-accent-hover"
        >
          Undo
        </button>
      )}
      <button
        onClick={dismissToast}
        className="rounded p-0.5 text-text-tertiary hover:text-text-primary"
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
