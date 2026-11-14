"use client";

import { useMemo, useState } from "react";
import { Search, Trophy } from "lucide-react";
import { PodiumCards } from "@/components/PodiumCards";
import { RoundSelector } from "@/components/RoundSelector";
import {
  useLiveRoundResults,
  type ConnectionStatus,
} from "@/hooks/useLiveRoundResults";
import type { TournamentSnapshot } from "@/lib/tournament-data";
import {
  buildLeaderboard,
  formatCentiseconds,
  formatSolveSlot,
  normalizeSolves,
} from "@/lib/wca";
import type { LeaderboardRow, ScrambleItem } from "@/types/tournament";

interface LiveScoreboardProps {
  snapshot: TournamentSnapshot;
}

function formatEventDate(dateValue: string): string {
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        En vivo
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Conectando
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-400">
      <span className="h-2 w-2 rounded-full bg-slate-500" />
      Sin conexión
    </span>
  );
}

function renderAverageCell(row: LeaderboardRow) {
  const result = row.result;
  if (!result || result.completed_count === 0) {
    return <span className="text-slate-600">—</span>;
  }

  if (result.completed_count >= 5) {
    if (result.average_cs !== null && result.average_cs >= 0) {
      return (
        <span className="font-bold text-[#F8FAFC]">
          {formatCentiseconds(result.average_cs)}
        </span>
      );
    }
    const dnfText =
      result.average_cs !== null ? formatCentiseconds(result.average_cs) : "DNF";
    return <span className="font-semibold text-[#EF4444]">{dnfText}</span>;
  }

  if (result.completed_count === 4) {
    const bpaText = row.bpaCs !== null ? formatCentiseconds(row.bpaCs) : "DNF";
    const wpaText = row.wpaCs !== null ? formatCentiseconds(row.wpaCs) : "DNF";

    return (
      <div className="flex flex-col items-end">
        <span className="text-slate-500">—</span>
        <span className="mt-0.5 text-[11px] font-normal text-slate-400">
          BPA {bpaText} · WPA {wpaText}
        </span>
      </div>
    );
  }

  return <span className="text-slate-600">—</span>;
}

function renderBestCell(row: LeaderboardRow) {
  const result = row.result;
  if (!result || result.completed_count === 0) {
    return <span className="text-slate-600">—</span>;
  }

  if (result.best_cs !== null && result.best_cs >= 0) {
    return (
      <span className="font-medium text-slate-200">
        {formatCentiseconds(result.best_cs)}
      </span>
    );
  }

  const fallback =
    result.best_cs !== null ? formatCentiseconds(result.best_cs) : "DNF";
  return <span className="font-medium text-[#EF4444]">{fallback}</span>;
}

export function LiveScoreboard({ snapshot }: LiveScoreboardProps) {
  const {
    rounds,
    activeRound,
    setActiveRoundId,
    competitors,
    results,
    connectionStatus,
    lastUpdatedCompetitorId,
  } = useLiveRoundResults({
    tournamentId: snapshot.tournament?.id ?? null,
    initialRound: snapshot.activeRound,
    initialRounds: snapshot.rounds,
    initialCompetitors: snapshot.competitors,
    initialResults: snapshot.results,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [showScrambles, setShowScrambles] = useState(false);

  const leaderboard = useMemo(
    () => buildLeaderboard(competitors, results),
    [competitors, results]
  );

  const filteredLeaderboard = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return leaderboard;

    return leaderboard.filter((row) => {
      const bibMatch = String(row.competitor.bib_number).includes(query);
      const nameMatch = row.competitor.full_name.toLowerCase().includes(query);
      const clubMatch =
        row.competitor.wca_id?.toLowerCase().includes(query) ?? false;
      return bibMatch || nameMatch || clubMatch;
    });
  }, [leaderboard, searchQuery]);

  if (!snapshot.configured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-[#1E293B] bg-[#111827] p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-[#F59E0B]">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#F8FAFC]">
            Marcador del Torneo
          </h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            El sistema se está configurando. En breve los resultados en vivo estarán disponibles.
          </p>
        </div>
      </main>
    );
  }

  if (!snapshot.tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-2xl border border-[#1E293B] bg-[#111827] p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-[#F59E0B]">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#F8FAFC]">
            El torneo comenzará pronto
          </h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            Los resultados oficiales y las posiciones se actualizarán aquí en vivo y en directo conforme los competidores realicen sus resoluciones.
          </p>
        </div>
      </main>
    );
  }

  const scramblesList = ((activeRound as unknown as { scrambles?: ScrambleItem[] })?.scrambles ?? []) as ScrambleItem[];
  const hasScrambles = scramblesList.length > 0;
  const isRoundFinished = activeRound?.status === "finished";

  return (
    <div className="min-h-screen bg-[#090D16] text-[#F8FAFC]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">
        {/* Cabecera oficial del torneo */}
        <header className="rounded-2xl border border-[#1E293B] bg-[#111827] px-5 py-4 shadow-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-[#F8FAFC] sm:text-2xl">
                  {snapshot.tournament.name}
                </h1>
                <ConnectionBadge status={connectionStatus} />
              </div>
              <p className="mt-1 text-sm text-[#94A3B8]">
                {formatEventDate(snapshot.tournament.event_date)}
                {activeRound
                  ? ` · ${activeRound.event_name} — ${activeRound.name}`
                  : " · Sin rondas activas"}
              </p>
            </div>
          </div>
        </header>

        {/* Selector de rondas */}
        <RoundSelector
          rounds={rounds}
          activeRound={activeRound}
          onSelectRound={setActiveRoundId}
        />

        {/* Tarjetas Top 3 (Podio) */}
        <PodiumCards rows={leaderboard} />

        {/* Buscador de competidores */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, #bib o club..."
              className="w-full rounded-xl border border-[#1E293B] bg-[#111827] py-2 pl-9 pr-4 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:border-[#F59E0B] focus:outline-none focus:ring-1 focus:ring-[#F59E0B]"
            />
          </div>

          {hasScrambles && (
            <button
              type="button"
              onClick={() => setShowScrambles((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1E293B] bg-[#111827] px-3.5 py-2 text-xs font-semibold text-[#94A3B8] transition-colors hover:border-slate-700 hover:text-[#F8FAFC]"
            >
              {showScrambles ? "Ocultar mezclas oficiales" : "Ver mezclas oficiales (Scrambles)"}
            </button>
          )}
        </div>

        {/* Sección de Scrambles (Mezclas) */}
        {hasScrambles && (showScrambles || isRoundFinished) && (
          <section className="rounded-2xl border border-[#1E293B] bg-[#111827] p-4 sm:p-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#F8FAFC]">
                  Mezclas Oficiales — {activeRound?.event_name}
                </h3>
                <p className="text-xs text-[#94A3B8]">
                  {isRoundFinished
                    ? "Ronda finalizada: mezclas públicas para verificación."
                    : "Mezclas oficiales registradas para esta ronda."}
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 font-mono text-xs text-slate-300">
                10 mezclas
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#FACC15]">
                  Grupo A (Intentos 1 - 5)
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs text-[#F8FAFC]">
                  {scramblesList
                    .filter((s) => s.group === "A")
                    .map((scramble) => (
                      <div
                        key={scramble.id}
                        className="rounded-lg bg-[#090D16] p-2 border border-[#1E293B]"
                      >
                        <span className="font-bold text-[#F59E0B] mr-2">
                          #{scramble.attempt}:
                        </span>
                        <span>{scramble.sequence}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Grupo B (Intentos 1 - 5)
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs text-[#F8FAFC]">
                  {scramblesList
                    .filter((s) => s.group === "B")
                    .map((scramble) => (
                      <div
                        key={scramble.id}
                        className="rounded-lg bg-[#090D16] p-2 border border-[#1E293B]"
                      >
                        <span className="font-bold text-slate-400 mr-2">
                          #{scramble.attempt}:
                        </span>
                        <span>{scramble.sequence}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tabla oficial de resultados */}
        <section
          aria-label="Tabla oficial de resultados"
          className="overflow-hidden rounded-2xl border border-[#1E293B] bg-[#111827] shadow-xl"
        >
          {competitors.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#94A3B8]">
              <p className="text-sm">
                No hay competidores registrados en este torneo todavía.
              </p>
            </div>
          ) : !activeRound ? (
            <div className="px-6 py-12 text-center text-[#94A3B8]">
              <p className="text-sm">
                No hay rondas activas en este momento.
              </p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="px-6 py-12 text-center text-[#94A3B8]">
              <p className="text-sm">
                No se encontraron competidores que coincidan con &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#1E293B] bg-[#090D16]/60 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                      <th className="w-12 px-3 py-3 text-center sm:px-4">#</th>
                      <th className="min-w-[180px] px-3 py-3 sm:px-4">Competidor</th>
                      <th className="px-2.5 py-3 text-right font-mono">1</th>
                      <th className="px-2.5 py-3 text-right font-mono">2</th>
                      <th className="px-2.5 py-3 text-right font-mono">3</th>
                      <th className="px-2.5 py-3 text-right font-mono">4</th>
                      <th className="px-2.5 py-3 text-right font-mono">5</th>
                      <th className="min-w-[110px] px-3 py-3 text-right sm:px-4">
                        Promedio
                      </th>
                      <th className="min-w-[85px] px-3 py-3 text-right sm:px-4">
                        Mejor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E293B] text-sm">
                    {filteredLeaderboard.map((row) => {
                      const solves = normalizeSolves(row.result?.solves ?? []);
                      const isFlashing =
                        row.competitor.id === lastUpdatedCompetitorId;

                      return (
                        <tr
                          key={row.competitor.id}
                          className={`transition-colors hover:bg-[#1E293B]/50 ${
                            isFlashing ? "animate-row-flash" : ""
                          }`}
                        >
                          <td className="px-3 py-3 text-center font-mono tabular-nums font-semibold sm:px-4">
                            {row.rank === 1 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#FACC15] text-xs font-bold text-slate-950 shadow-xs">
                                1
                              </span>
                            ) : row.rank === 2 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-900">
                                2
                              </span>
                            ) : row.rank === 3 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/80 text-xs font-bold text-white">
                                3
                              </span>
                            ) : (
                              <span className="text-[#94A3B8]">
                                {row.rank ?? "—"}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 sm:px-4">
                            <div className="flex items-baseline gap-2">
                              <span className="font-semibold text-[#F8FAFC]">
                                {row.competitor.full_name}
                              </span>
                              <span className="font-mono text-xs text-slate-500 tabular-nums">
                                #{row.competitor.bib_number}
                              </span>
                            </div>
                            {row.competitor.wca_id && (
                              <span className="block text-xs text-[#94A3B8] font-medium">
                                {row.competitor.wca_id}
                              </span>
                            )}
                          </td>

                          {solves.map((slot, idx) => {
                            const formatted = formatSolveSlot(slot);
                            const isEmpty =
                              !formatted || formatted === "-" || formatted === "—";
                            const isDropped =
                              !isEmpty &&
                              (idx === row.droppedMinIndex ||
                                idx === row.droppedMaxIndex);
                            const isDnfOrDns =
                              slot.penalty === "DNF" || slot.penalty === "DNS";

                            return (
                              <td
                                key={idx}
                                className="whitespace-nowrap px-2.5 py-3 text-right font-mono tabular-nums"
                              >
                                {isEmpty ? (
                                  <span className="text-slate-600">—</span>
                                ) : isDropped ? (
                                  <span className="text-[#64748B]">({formatted})</span>
                                ) : isDnfOrDns ? (
                                  <span className="font-semibold text-[#EF4444]">
                                    {formatted}
                                  </span>
                                ) : (
                                  <span className="text-[#F8FAFC]">{formatted}</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums sm:px-4">
                            {renderAverageCell(row)}
                          </td>

                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums sm:px-4">
                            {renderBestCell(row)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1E293B] bg-[#090D16]/60 px-4 py-3 text-xs text-[#94A3B8]">
                <span>
                  Reglas WCA (Ao5): los tiempos entre paréntesis corresponden al mejor y peor intento descartados.
                </span>
                <span className="font-mono tabular-nums text-slate-400">
                  {filteredLeaderboard.length}{" "}
                  {filteredLeaderboard.length === 1 ? "competidor" : "competidores"}
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
