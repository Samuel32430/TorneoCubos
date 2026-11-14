"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FileText, Moon, Search, Sun, Trophy } from "lucide-react";
import { PodiumCards } from "@/components/PodiumCards";
import { RoundSelector } from "@/components/RoundSelector";
import { UpcomingTournamentView } from "@/components/UpcomingTournamentView";
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

function ConnectionBadge({ status, isDark }: { status: ConnectionStatus; isDark: boolean }) {
  if (status === "live") {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
          isDark
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
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
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
          isDark
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-amber-200 bg-amber-50 text-[#B45309]"
        }`}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Conectando
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        isDark
          ? "border-slate-700 bg-slate-800/80 text-slate-400"
          : "border-[#CBD5E1] bg-slate-100 text-[#64748B]"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      Sin conexión
    </span>
  );
}

function renderAverageCell(row: LeaderboardRow, isDark: boolean) {
  const result = row.result;
  if (!result || result.completed_count === 0) {
    return <span className={isDark ? "text-slate-600" : "text-[#CBD5E1]"}>—</span>;
  }

  if (result.completed_count >= 5) {
    if (result.average_cs !== null && result.average_cs >= 0) {
      return (
        <span className={`font-bold ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
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
        <span className={isDark ? "text-slate-500" : "text-[#94A3B8]"}>—</span>
        <span className={`mt-0.5 text-[11px] font-normal ${isDark ? "text-slate-400" : "text-[#64748B]"}`}>
          BPA {bpaText} · WPA {wpaText}
        </span>
      </div>
    );
  }

  return <span className={isDark ? "text-slate-600" : "text-[#CBD5E1]"}>—</span>;
}

function renderBestCell(row: LeaderboardRow, isDark: boolean) {
  const result = row.result;
  if (!result || result.completed_count === 0) {
    return <span className={isDark ? "text-slate-600" : "text-[#CBD5E1]"}>—</span>;
  }

  if (result.best_cs !== null && result.best_cs >= 0) {
    return (
      <span className={`font-medium ${isDark ? "text-slate-200" : "text-[#0F172A]"}`}>
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
    tournament: liveTournament,
    rounds,
    activeRound,
    setActiveRoundId,
    competitors,
    results,
    connectionStatus,
    lastUpdatedCompetitorId,
  } = useLiveRoundResults({
    tournamentId: snapshot.tournament?.id ?? null,
    initialTournament: snapshot.tournament,
    initialRound: snapshot.activeRound,
    initialRounds: snapshot.rounds,
    initialCompetitors: snapshot.competitors,
    initialResults: snapshot.results,
  });

  const currentTournament = liveTournament ?? snapshot.tournament;

  // Selector de tema (oscuro por defecto, con persistencia en localStorage)
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrambles, setShowScrambles] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("scoreboard_theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("scoreboard_theme", next);
  }

  const isDark = theme === "dark";

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
        row.competitor.club?.toLowerCase().includes(query) ?? false;
      return bibMatch || nameMatch || clubMatch;
    });
  }, [leaderboard, searchQuery]);

  if (!snapshot.configured) {
    return (
      <main className={`mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-12 ${isDark ? "bg-[#090D16]" : "bg-[#F1F5F9]"}`}>
        <div className={`w-full rounded-2xl border p-8 text-center shadow-xl ${isDark ? "border-[#1E293B] bg-[#111827]" : "border-[#CBD5E1] bg-white"}`}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-[#F59E0B]">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className={`mt-4 text-xl font-bold ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
            Marcador del Torneo
          </h1>
          <p className={`mt-2 text-sm ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
            El sistema se está configurando. En breve los resultados en vivo estarán disponibles.
          </p>
        </div>
      </main>
    );
  }

  if (!currentTournament) {
    return (
      <main className={`mx-auto flex min-h-screen max-w-xl items-center justify-center px-4 py-12 ${isDark ? "bg-[#090D16]" : "bg-[#F1F5F9]"}`}>
        <div className={`w-full rounded-2xl border p-8 text-center shadow-xl ${isDark ? "border-[#1E293B] bg-[#111827]" : "border-[#CBD5E1] bg-white"}`}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-[#F59E0B]">
            <Trophy className="h-6 w-6" />
          </div>
          <h1 className={`mt-4 text-xl font-bold ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
            El torneo comenzará pronto
          </h1>
          <p className={`mt-2 text-sm ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
            Los resultados oficiales y las posiciones se actualizarán aquí en vivo conforme los competidores realicen sus resoluciones.
          </p>
        </div>
      </main>
    );
  }

  // Si el torneo está en estado 'draft', mostrar la pantalla de presentación y cuenta regresiva
  if (currentTournament.status === "draft") {
    return (
      <UpcomingTournamentView
        tournament={currentTournament}
        rounds={rounds}
        competitors={competitors}
        connectionStatus={connectionStatus}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />
    );
  }

  const scramblesList = ((activeRound as unknown as { scrambles?: ScrambleItem[] })?.scrambles ?? []) as ScrambleItem[];
  const hasScrambles = scramblesList.length > 0;
  const isRoundFinished = activeRound?.status === "finished";

  return (
    <main className={`min-h-screen transition-colors duration-150 ${isDark ? "bg-[#090D16] text-[#F8FAFC]" : "bg-[#F1F5F9] text-[#0F172A]"}`}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">
        {/* Cabecera oficial del torneo con selector de tema */}
        <header className={`rounded-2xl border px-5 py-4 shadow-sm transition-colors ${isDark ? "border-[#1E293B] bg-[#111827]" : "border-[#CBD5E1] bg-white"}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-1 transition-colors overflow-hidden ${
                  isDark
                    ? "bg-[#0F172A] ring-1 ring-white/10 shadow-xs"
                    : "bg-transparent ring-0 shadow-none"
                }`}
              >
                <Image
                  src="/conquis-logo.png"
                  alt="Club Conquistadores"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className={`text-xl font-bold tracking-tight sm:text-2xl ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                    {currentTournament.name}
                  </h1>
                  <ConnectionBadge status={connectionStatus} isDark={isDark} />
                </div>
                <p className={`mt-1 text-sm ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                  {formatEventDate(currentTournament.event_date)}
                  {activeRound
                    ? ` · ${activeRound.event_name} — ${activeRound.name}`
                    : " · Sin rondas activas"}
                </p>
              </div>
            </div>

            {/* Alternar Tema Claro / Oscuro */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isDark
                    ? "border-[#1E293B] bg-[#090D16] text-[#94A3B8] hover:border-slate-700 hover:text-[#F8FAFC]"
                    : "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#0F172A] hover:text-[#0F172A]"
                }`}
              >
                {isDark ? (
                  <>
                    <Sun className="h-4 w-4 text-[#FACC15]" />
                    <span>Modo claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-[#0F172A]" />
                    <span>Modo oscuro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Selector de rondas */}
        <RoundSelector
          rounds={rounds}
          activeRound={activeRound}
          onSelectRound={setActiveRoundId}
          isDark={isDark}
        />

        {/* Podio provisional */}
        <PodiumCards rows={leaderboard} isDark={isDark} />

        {/* Buscador de competidores y botón de mezclas (solo cuando la ronda esté finalizada) */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-[#64748B]"}`} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o club..."
              className={`w-full rounded-xl border py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 ${
                isDark
                  ? "border-[#1E293B] bg-[#111827] text-[#F8FAFC] placeholder:text-[#94A3B8] focus:border-[#F59E0B] focus:ring-[#F59E0B]"
                  : "border-[#CBD5E1] bg-white text-[#0F172A] placeholder:text-[#64748B]/60 focus:border-[#0F172A] focus:ring-[#0F172A]"
              }`}
            />
          </div>

          {/* Scrambles: solo disponibles para el público cuando la ronda esté finalizada */}
          {isRoundFinished && hasScrambles && (
            <button
              type="button"
              onClick={() => setShowScrambles((prev) => !prev)}
              aria-label={showScrambles ? "Ocultar mezclas oficiales" : "Ver mezclas oficiales"}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                isDark
                  ? "border-[#1E293B] bg-[#111827] text-[#94A3B8] hover:border-slate-700 hover:text-[#F8FAFC]"
                  : "border-amber-200 bg-amber-50 text-[#B45309] hover:bg-amber-100"
              }`}
            >
              <FileText className="h-4 w-4 text-[#F59E0B]" />
              {showScrambles ? "Ocultar mezclas oficiales" : "Ver mezclas oficiales (Scrambles)"}
            </button>
          )}
        </div>

        {/* Sección de Scrambles: solo visible si la ronda ya terminó y el usuario lo solicitó */}
        {isRoundFinished && hasScrambles && showScrambles && (
          <section className={`rounded-2xl border p-4 sm:p-5 shadow-lg ${
            isDark
              ? "border-[#1E293B] bg-[#111827]"
              : "border-amber-200 bg-white"
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${isDark ? "border-[#1E293B]" : "border-amber-200/80"}`}>
              <div>
                <h3 className={`text-sm font-bold ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                  Mezclas Oficiales — {activeRound?.event_name} ({activeRound?.name})
                </h3>
                <p className={`text-xs ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                  Ronda finalizada: mezclas públicas para verificación de la comunidad.
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold ${isDark ? "bg-slate-800 text-slate-300" : "bg-amber-100 text-[#B45309]"}`}>
                10 mezclas
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-[#FACC15]" : "text-[#B45309]"}`}>
                  Grupo A (Intentos 1 - 5)
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs">
                  {scramblesList
                    .filter((s) => s.group === "A")
                    .map((scramble) => (
                      <div
                        key={scramble.id}
                        className={`rounded-lg p-2 border ${
                          isDark
                            ? "bg-[#090D16] border-[#1E293B] text-[#F8FAFC]"
                            : "bg-[#F8FAFC] border-amber-200/60 text-[#0F172A]"
                        }`}
                      >
                        <span className={`font-bold mr-2 ${isDark ? "text-[#F59E0B]" : "text-[#EA580C]"}`}>
                          #{scramble.attempt}:
                        </span>
                        <span>{scramble.sequence}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-slate-400" : "text-[#64748B]"}`}>
                  Grupo B (Intentos 1 - 5)
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs">
                  {scramblesList
                    .filter((s) => s.group === "B")
                    .map((scramble) => (
                      <div
                        key={scramble.id}
                        className={`rounded-lg p-2 border ${
                          isDark
                            ? "bg-[#090D16] border-[#1E293B] text-[#F8FAFC]"
                            : "bg-[#F8FAFC] border-amber-200/60 text-[#0F172A]"
                        }`}
                      >
                        <span className={`font-bold mr-2 ${isDark ? "text-slate-400" : "text-[#64748B]"}`}>
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
          className={`overflow-hidden rounded-2xl border shadow-sm transition-colors ${
            isDark
              ? "border-[#1E293B] bg-[#111827]"
              : "border-[#CBD5E1] bg-white"
          }`}
        >
          {competitors.length === 0 ? (
            <div className={`px-6 py-12 text-center ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
              <p className="text-sm">
                No hay competidores registrados en este torneo todavía.
              </p>
            </div>
          ) : !activeRound ? (
            <div className={`px-6 py-12 text-center ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
              <p className="text-sm">
                No hay rondas activas en este momento.
              </p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className={`px-6 py-12 text-center ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
              <p className="text-sm">
                No se encontraron competidores que coincidan con &ldquo;{searchQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr
                      className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                        isDark
                          ? "border-[#1E293B] bg-[#090D16]/60 text-[#94A3B8]"
                          : "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"
                      }`}
                    >
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
                  <tbody className={`divide-y text-sm ${isDark ? "divide-[#1E293B]" : "divide-[#CBD5E1]/60"}`}>
                    {filteredLeaderboard.map((row) => {
                      const solves = normalizeSolves(row.result?.solves ?? []);
                      const isFlashing =
                        row.competitor.id === lastUpdatedCompetitorId;

                      return (
                        <tr
                          key={row.competitor.id}
                          className={`transition-colors ${
                            isDark
                              ? "hover:bg-[#1E293B]/50"
                              : "hover:bg-[#F8FAFC]"
                          } ${isFlashing ? "animate-row-flash" : ""}`}
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
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/90 text-xs font-bold text-white">
                                3
                              </span>
                            ) : (
                              <span className={isDark ? "text-[#94A3B8]" : "text-[#64748B]"}>
                                {row.rank ?? "—"}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 sm:px-4">
                            <div className="min-w-0">
                              <span className={`font-semibold ${isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}`}>
                                {row.competitor.full_name}
                              </span>
                              {row.competitor.club && (
                                <span className={`block text-xs font-medium ${isDark ? "text-[#94A3B8]" : "text-[#64748B]"}`}>
                                  {row.competitor.club}
                                </span>
                              )}
                            </div>
                          </td>

                          {solves.map((slot, idx) => {
                            const formatted = formatSolveSlot(slot);
                            const isEmpty =
                              !formatted || formatted === "-" || formatted === "—";
                            const isDropped =
                              !isEmpty &&
                              (idx === row.droppedMinIndex ||
                                idx === row.droppedMaxIndex);

                            let textColor = isDark ? "text-[#F8FAFC]" : "text-[#0F172A]";
                            if (isEmpty) {
                              textColor = isDark ? "text-slate-600" : "text-[#CBD5E1]";
                            } else if (isDropped) {
                              textColor = isDark ? "text-[#64748B] line-through font-normal" : "text-[#94A3B8] line-through font-normal";
                            } else if (slot.penalty === "+2") {
                              textColor = "font-bold text-[#EA580C]";
                            } else if (
                              slot.penalty === "DNF" ||
                              slot.penalty === "DNS"
                            ) {
                              textColor = "font-bold text-[#EF4444]";
                            }

                            return (
                              <td
                                key={idx}
                                className={`px-2.5 py-3 text-right font-mono tabular-nums ${textColor}`}
                              >
                                {isDropped ? `(${formatted})` : formatted || "—"}
                              </td>
                            );
                          })}

                          <td className="px-3 py-3 text-right font-mono tabular-nums sm:px-4">
                            {renderAverageCell(row, isDark)}
                          </td>

                          <td className="px-3 py-3 text-right font-mono tabular-nums sm:px-4">
                            {renderBestCell(row, isDark)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={`border-t px-4 py-3 text-xs ${
                isDark ? "border-[#1E293B] bg-[#090D16]/40 text-[#94A3B8]" : "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B]"
              }`}>
                <p>
                  * Los tiempos entre paréntesis () indican los extremos descartados (mejor y peor intento) para el cálculo del promedio Ao5.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
