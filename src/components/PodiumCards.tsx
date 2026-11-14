import { Medal, Trophy } from "lucide-react";
import { formatCentiseconds } from "@/lib/wca";
import type { LeaderboardRow } from "@/types/tournament";

interface PodiumCardsProps {
  rows: LeaderboardRow[];
  isDark?: boolean;
}

const PODIUM_STYLES_DARK = [
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

const PODIUM_STYLES_LIGHT = [
  {
    placeLabel: "1.º",
    cardBorder: "border-t-4 border-t-[#F59E0B]",
    badgeClass: "bg-amber-50 text-[#B45309] border-amber-200",
    iconClass: "text-[#F59E0B]",
  },
  {
    placeLabel: "2.º",
    cardBorder: "border-t-4 border-t-slate-400",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
    iconClass: "text-slate-500",
  },
  {
    placeLabel: "3.º",
    cardBorder: "border-t-4 border-t-[#EA580C]",
    badgeClass: "bg-orange-50 text-[#EA580C] border-orange-200",
    iconClass: "text-[#EA580C]",
  },
] as const;

function hasValidTime(cs: number | null | undefined): cs is number {
  return cs !== null && cs !== undefined && cs >= 0;
}

export function PodiumCards({ rows, isDark = true }: PodiumCardsProps) {
  const contenders = rows
    .filter((row) => {
      if (!row.result || row.result.completed_count === 0) return false;
      return hasValidTime(row.result.average_cs) || hasValidTime(row.result.best_cs);
    })
    .slice(0, 3);

  if (contenders.length === 0) return null;

  const styleList = isDark ? PODIUM_STYLES_DARK : PODIUM_STYLES_LIGHT;

  return (
    <section aria-label="Podio provisional" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {contenders.map((row, index) => {
        const style = styleList[index] ?? styleList[2];
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
            className={`rounded-2xl border p-4 shadow-sm transition-colors ${style.cardBorder} ${
              isDark
                ? "border-[#1E293B] bg-[#111827]"
                : "border-[#CBD5E1] bg-white"
            }`}
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

              <span className={`font-mono text-xs tabular-nums ${isDark ? "text-slate-500" : "text-[#64748B]"}`}>
                {result.completed_count}/5
              </span>
            </div>

            <div className="mt-2.5">
              <p className={`truncate font-semibold text-base ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                {row.competitor.full_name}
              </p>
              {row.competitor.club && (
                <p className={`text-xs font-medium ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                  {row.competitor.club}
                </p>
              )}
            </div>

            <div
              className={`mt-3 flex items-baseline justify-between border-t pt-2.5 ${
                isDark ? "border-[#1E293B]" : "border-[#CBD5E1]"
              }`}
            >
              <div>
                <span className={`block text-[11px] font-medium uppercase tracking-wide ${isDark ? "text-slate-400" : "text-[#64748B]"}`}>
                  {mainLabel}
                </span>
                <span className={`font-mono font-bold tabular-nums text-xl ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                  {mainValue}
                </span>
              </div>

              <div className="text-right">
                <span className={`block text-[11px] font-medium uppercase tracking-wide ${isDark ? "text-slate-400" : "text-[#64748B]"}`}>
                  Mejor
                </span>
                <span className={`font-mono font-semibold tabular-nums text-sm ${isDark ? "text-slate-300" : "text-[#0F172A]"}`}>
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
