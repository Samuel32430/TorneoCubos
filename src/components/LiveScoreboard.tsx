"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Tv } from "lucide-react";
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
import type { LeaderboardRow } from "@/types/tournament";

interface LiveScoreboardProps {
  snapshot: TournamentSnapshot;
  tvMode?: boolean;
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
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
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
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Conectando
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      Sin conexión
    </span>
  );
}

function renderAverageCell(row: LeaderboardRow, tvMode: boolean) {
  const result = row.result;
  if (!result || result.completed_count === 0) {
    return <span className="text-slate-300">—</span>;
  }

  if (result.completed_count >= 5) {
    if (result.average_cs !== null && result.average_cs >= 0) {
      return (
        <span className="font-bold text-slate-900">
          {formatCentiseconds(result.average_cs)}
        </span>
      );
    }
    const dnfText =
      result.average_cs !== null ? formatCentiseconds(result.average_cs) : "DNF";
    return <span className="font-semibold text-rose-600">{dnfText}</span>;
  }

  if (result.completed_count === 4) {
    const bpaText = row.bpaCs !== null ? formatCentiseconds(row.bpaCs) : "DNF";
    const wpaText = row.wpaCs !== null ? formatCentiseconds(row.wpaCs) : "DNF";

    return (
      <div className="flex flex-col items-end">
        <span className="text-slate-400">—</span>
        <span
          className={`mt-0.5 font-normal text-slate-500 ${
            tvMode ? "text-xs" : "text-[11px]"
          }`}
        >
          BPA {bpaText} · WPA {wpaText}
        </span>
      </div>
    );
  }

  return <span className="text-slate-300">—</span>;
}

function renderBestCell(row: LeaderboardRow) {
  const result = row.result;
  if (!result || result.completed_count === 0) {
    return <span className="text-slate-300">—</span>;
  }

  if (result.best_cs !== null && result.best_cs >= 0) {
    return (
      <span className="font-medium text-slate-700">
        {formatCentiseconds(result.best_cs)}
      </span>
    );
  }

  const fallback =
    result.best_cs !== null ? formatCentiseconds(result.best_cs) : "DNF";
  return <span className="font-medium text-rose-600">{fallback}</span>;
}

export function LiveScoreboard({ snapshot, tvMode = false }: LiveScoreboardProps) {
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

  const leaderboard = useMemo(
    () => buildLeaderboard(competitors, results),
    [competitors, results]
  );

  if (!snapshot.configured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <h1 className="text-xl font-bold text-slate-900">
            Supabase no está configurado
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Agrega las variables{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            y{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </code>{" "}
            en tu archivo <code className="font-mono text-xs">.env.local</code> para
            habilitar el marcador en vivo.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              <Settings className="h-4 w-4" />
              Ir a administración
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!snapshot.tournament) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-12">
        <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <h1 className="text-xl font-bold text-slate-900">
            Aún no hay ningún torneo creado
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Configura el torneo, crea las rondas e inscribe a los competidores desde
            el panel de administración para mostrar los resultados en vivo.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Settings className="h-4 w-4" />
              Configurar torneo en /admin
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const tvToggleHref = activeRound
    ? `${tvMode ? "/" : "/tv"}?round=${encodeURIComponent(activeRound.id)}`
    : tvMode
      ? "/"
      : "/tv";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        className={`mx-auto px-4 sm:px-6 ${
          tvMode ? "max-w-[1600px] py-6 space-y-6" : "max-w-6xl py-6 sm:py-8 space-y-5"
        }`}
      >
        <header className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1
                  className={`font-bold tracking-tight text-slate-900 ${
                    tvMode ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
                  }`}
                >
                  {snapshot.tournament.name}
                </h1>
                <ConnectionBadge status={connectionStatus} />
              </div>
              <p
                className={`mt-1 text-slate-500 ${
                  tvMode ? "text-base" : "text-sm"
                }`}
              >
                {formatEventDate(snapshot.tournament.event_date)}
                {activeRound
                  ? ` · ${activeRound.event_name} — ${activeRound.name}`
                  : " · Sin rondas activas"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={tvToggleHref}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                {tvMode ? (
                  <>
                    <ArrowLeft className="h-4 w-4 text-slate-500" />
                    Vista normal
                  </>
                ) : (
                  <>
                    <Tv className="h-4 w-4 text-blue-600" />
                    Modo TV
                  </>
                )}
              </Link>

              <Link
                href="/admin"
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                  tvMode
                    ? "text-xs text-slate-400 hover:text-slate-600"
                    : "border border-slate-200 bg-slate-50 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                Admin
              </Link>
            </div>
          </div>
        </header>

        <RoundSelector
          rounds={rounds}
          activeRound={activeRound}
          onSelectRound={setActiveRoundId}
          tvMode={tvMode}
        />

        <PodiumCards rows={leaderboard} tvMode={tvMode} />

        <section
          aria-label="Tabla oficial de resultados"
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
        >
          {competitors.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No hay competidores registrados en este torneo todavía.
              </p>
              <Link
                href="/admin"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Agregar competidores en /admin
              </Link>
            </div>
          ) : !activeRound ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No hay rondas creadas todavía para este torneo.
              </p>
              <Link
                href="/admin"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Crear una ronda en /admin
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr
                      className={`border-b border-slate-200 bg-slate-50/80 font-semibold uppercase tracking-wider text-slate-500 ${
                        tvMode ? "text-xs" : "text-[11px]"
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
                  <tbody
                    className={`divide-y divide-slate-100 ${
                      tvMode ? "text-base" : "text-sm"
                    }`}
                  >
                    {leaderboard.map((row) => {
                      const solves = normalizeSolves(row.result?.solves ?? []);
                      const isFlashing =
                        row.competitor.id === lastUpdatedCompetitorId;

                      return (
                        <tr
                          key={row.competitor.id}
                          className={`transition-colors hover:bg-slate-50/80 ${
                            isFlashing ? "animate-row-flash" : ""
                          }`}
                        >
                          <td className="px-3 py-3 text-center font-mono tabular-nums font-semibold sm:px-4">
                            {row.rank === 1 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">
                                1
                              </span>
                            ) : row.rank === 2 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                                2
                              </span>
                            ) : row.rank === 3 ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                                3
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                {row.rank ?? "—"}
                              </span>
                            )}
                          </td>

                          <td className="px-3 py-3 sm:px-4">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium text-slate-900">
                                {row.competitor.full_name}
                              </span>
                              <span className="font-mono text-xs text-slate-400 tabular-nums">
                                #{row.competitor.bib_number}
                              </span>
                            </div>
                            {row.competitor.wca_id && (
                              <span className="block text-xs text-slate-400">
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
                                  <span className="text-slate-300">—</span>
                                ) : isDropped ? (
                                  <span className="text-slate-400">({formatted})</span>
                                ) : isDnfOrDns ? (
                                  <span className="text-rose-600">{formatted}</span>
                                ) : (
                                  <span className="text-slate-700">{formatted}</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums sm:px-4">
                            {renderAverageCell(row, tvMode)}
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">
                <span>
                  Reglas WCA (Ao5): los tiempos entre paréntesis corresponden al mejor
                  y peor intento descartados.
                </span>
                <span className="font-mono tabular-nums">
                  {competitors.length}{" "}
                  {competitors.length === 1 ? "competidor" : "competidores"}
                </span>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
