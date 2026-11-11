"use client";

import type { Round, RoundStatus } from "@/types/tournament";

interface RoundSelectorProps {
  rounds: Round[];
  activeRound: Round | null;
  onSelectRound: (roundId: string) => void;
  tvMode?: boolean;
}

const STATUS_BADGE: Record<RoundStatus, { label: string; className: string }> = {
  active: {
    label: "En curso",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  finished: {
    label: "Finalizada",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  upcoming: {
    label: "Próxima",
    className: "bg-sky-50 text-sky-700 border-sky-200",
  },
};

export function RoundSelector({
  rounds,
  activeRound,
  onSelectRound,
  tvMode = false,
}: RoundSelectorProps) {
  if (rounds.length === 0) return null;

  if (rounds.length === 1) {
    const onlyRound = rounds[0];
    const badge = STATUS_BADGE[onlyRound.status];

    return (
      <div className="flex items-center">
        <div
          className={`inline-flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 shadow-xs ${
            tvMode ? "text-base" : "text-sm"
          }`}
        >
          <span className="font-semibold text-slate-900">
            {onlyRound.event_name} — {onlyRound.name}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="tablist"
      aria-label="Rondas del torneo"
    >
      {rounds.map((round) => {
        const isActive = activeRound?.id === round.id;
        const badge = STATUS_BADGE[round.status];

        return (
          <button
            key={round.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectRound(round.id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 transition-colors cursor-pointer ${
              tvMode ? "text-base" : "text-sm"
            } ${
              isActive
                ? "border-blue-600 bg-white text-slate-900 ring-1 ring-blue-600/20 shadow-xs font-semibold"
                : "border-slate-200 bg-white/70 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-slate-900 font-medium"
            }`}
          >
            <span>
              {round.event_name} — {round.name}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
