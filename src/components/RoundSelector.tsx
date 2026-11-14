"use client";

import type { Round, RoundStatus } from "@/types/tournament";

interface RoundSelectorProps {
  rounds: Round[];
  activeRound: Round | null;
  onSelectRound: (roundId: string) => void;
  isDark?: boolean;
}

const STATUS_BADGE_DARK: Record<RoundStatus, { label: string; className: string }> = {
  active: {
    label: "En curso",
    className: "bg-emerald-500/10 text-[#10B981] border-emerald-500/30",
  },
  finished: {
    label: "Finalizada",
    className: "bg-slate-800 text-slate-400 border-slate-700",
  },
  upcoming: {
    label: "Próxima",
    className: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  },
};

const STATUS_BADGE_LIGHT: Record<RoundStatus, { label: string; className: string }> = {
  active: {
    label: "En curso",
    className: "bg-emerald-50 text-[#10B981] border-emerald-200",
  },
  finished: {
    label: "Finalizada",
    className: "bg-slate-100 text-[#64748B] border-[#CBD5E1]",
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
  isDark = true,
}: RoundSelectorProps) {
  if (rounds.length === 0) return null;

  const statusMap = isDark ? STATUS_BADGE_DARK : STATUS_BADGE_LIGHT;

  if (rounds.length === 1) {
    const onlyRound = rounds[0];
    const badge = statusMap[onlyRound.status];

    return (
      <div className="flex items-center">
        <div
          className={`inline-flex items-center gap-2.5 rounded-xl border px-4 py-2 text-sm shadow-sm ${
            isDark
              ? "border-[#1E293B] bg-[#111827] text-[#F8FAFC]"
              : "border-[#CBD5E1] bg-white text-[#0F172A]"
          }`}
        >
          <span className="font-semibold">
            {onlyRound.event_name} — {onlyRound.name}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
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
        const badge = statusMap[round.status];

        const activeClasses = isDark
          ? "border-[#F59E0B] bg-[#1E293B] text-[#F8FAFC] font-semibold shadow-md ring-1 ring-[#F59E0B]/30"
          : "border-[#0F172A] bg-[#0F172A] text-white font-bold shadow-sm ring-1 ring-[#0F172A]/20";

        const inactiveClasses = isDark
          ? "border-[#1E293B] bg-[#111827] text-[#94A3B8] hover:text-[#F8FAFC] hover:border-slate-700 font-medium"
          : "border-[#CBD5E1] bg-white text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] font-semibold";

        return (
          <button
            key={round.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectRound(round.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-all cursor-pointer ${
              isActive ? activeClasses : inactiveClasses
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
