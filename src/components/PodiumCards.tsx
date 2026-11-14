import { Medal, Trophy } from "lucide-react";
import { formatCentiseconds } from "@/lib/wca";
import type { LeaderboardRow } from "@/types/tournament";

interface PodiumCardsProps {
  rows: LeaderboardRow[];
}

const PODIUM_STYLES = [
  {
    placeLabel: "1.º",
    cardBorder: "border-t-2 border-t-[#FACC15]",
    badgeClass: "bg-amber-400/10 text-[#FACC15] border-amber-400/30",
    iconClass: "text-[#FACC15]",
  },
  {
    placeLabel: "2.º",
    cardBorder: "border-t-2 border-t-slate-400",
    badgeClass: "bg-slate-700/30 text-slate-300 border-slate-600",
    iconClass: "text-slate-400",
  },
  {
    placeLabel: "3.º",
    cardBorder: "border-t-2 border-t-[#EA580C]",
    badgeClass: "bg-orange-500/10 text-[#EA580C] border-orange-500/30",
    iconClass: "text-[#EA580C]",
  },
] as const;

function hasValidTime(cs: number | null | undefined): cs is number {
  return cs !== null && cs !== undefined && cs >= 0;
}

export function PodiumCards({ rows }: PodiumCardsProps) {
  const contenders = rows
    .filter((row) => {
      if (!row.result || row.result.completed_count === 0) return false;
      return hasValidTime(row.result.average_cs) || hasValidTime(row.result.best_cs);
    })
    .slice(0, 3);

  if (contenders.length === 0) return null;

  return (
    <section aria-label="Podio provisional" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {contenders.map((row, index) => {
        const style = PODIUM_STYLES[index] ?? PODIUM_STYLES[2];
        const result = row.result!;
        const hasValidAverage = hasValidTime(result.average_cs);
        const isFinished = result.completed_count >= 5;
        const placeText = row.rank !== null ? `${row.rank}.º` : style.placeLabel;

        let mainLabel = "Ao5";
        let mainValue = "DNF";

        if (hasValidAverage) {
          mainValue = formatCentiseconds(result.average_cs);
        } else if (!isFinished) {
          if (hasValidTime(row.bpaCs)) {
            mainLabel = "BPA (en curso)";
            mainValue = formatCentiseconds(row.bpaCs);
          } else {
            mainLabel = "Mejor parcial";
            mainValue = hasValidTime(result.best_cs)
              ? formatCentiseconds(result.best_cs)
              : "—";
          }
        }

        const bestValue = hasValidTime(result.best_cs)
          ? formatCentiseconds(result.best_cs)
          : "DNF";

        return (
          <div
            key={row.competitor.id}
            className={`rounded-2xl border border-[#1E293B] bg-[#111827] p-4 shadow-lg ${style.cardBorder}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.badgeClass}`}
              >
                {index === 0 ? (
                  <Trophy className={`h-3.5 w-3.5 ${style.iconClass}`} />
                ) : (
                  <Medal className={`h-3.5 w-3.5 ${style.iconClass}`} />
                )}
                {placeText}
              </span>

              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {isFinished ? `#${row.competitor.bib_number}` : `${result.completed_count}/5`}
              </span>
            </div>

            <div className="mt-2.5">
              <p className="truncate font-semibold text-[#F8FAFC] text-base">
                {row.competitor.full_name}
              </p>
              {row.competitor.wca_id && (
                <p className="text-xs text-[#94A3B8] font-medium">{row.competitor.wca_id}</p>
              )}
            </div>

            <div className="mt-3 flex items-baseline justify-between border-t border-[#1E293B] pt-2.5">
              <div>
                <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {mainLabel}
                </span>
                <span className="font-mono font-bold tabular-nums text-[#F8FAFC] text-xl">
                  {mainValue}
                </span>
              </div>

              <div className="text-right">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Mejor
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-300 text-sm">
                  {bestValue}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
