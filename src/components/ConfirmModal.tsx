"use client";

import { useEffect, type ReactNode } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

export interface ModalAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "danger" | "primary" | "secondary" | "subtle";
  disabled?: boolean;
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  icon?: "danger" | "warning";
  actions: ModalAction[];
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  icon = "danger",
  actions,
  onClose,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Fondo con desenfoque estético (backdrop blur) */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
      />

      {/* Contenedor del Modal */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar modal"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              icon === "danger"
                ? "bg-red-50 text-red-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            {icon === "danger" ? (
              <Trash2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <div className="mt-2 text-sm text-slate-600 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {actions.map((action, idx) => {
            const variantClasses =
              action.variant === "danger"
                ? "bg-[#EF4444] text-white hover:bg-red-600 focus:ring-red-500"
                : action.variant === "primary"
                ? "bg-[#0F172A] text-white hover:bg-slate-800 focus:ring-slate-900"
                : action.variant === "secondary"
                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-300";

            return (
              <button
                key={idx}
                type="button"
                disabled={action.disabled}
                onClick={action.onClick}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 ${variantClasses}`}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
