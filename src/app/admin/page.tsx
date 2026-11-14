"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ExternalLink,
  LogOut,
  Trophy,
  UserCheck,
} from "lucide-react";
import { CompetitorManager } from "@/components/CompetitorManager";
import { RoundManager } from "@/components/RoundManager";
import { SolveInputGrid } from "@/components/SolveInputGrid";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type {
  Competitor,
  Round,
  RoundResultRow,
  Tournament,
} from "@/types/tournament";

function buildSlug(name: string, date: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = base || "torneo";
  return `${prefix}-${date}`;
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminPage() {
  const router = useRouter();
  const envConfigured = hasSupabaseEnv();

  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [results, setResults] = useState<RoundResultRow[]>([]);

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentDate, setNewTournamentDate] = useState(getTodayDateString);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const roundFetchSeq = useRef(0);

  const loadRoundResults = useCallback(async (roundId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const seq = ++roundFetchSeq.current;
    const { data, error } = await supabase
      .from("round_results")
      .select("*")
      .eq("round_id", roundId);

    if (seq !== roundFetchSeq.current) return;

    if (error) {
      setLoadError(`Error al cargar resultados: ${error.message}`);
      return;
    }

    setResults((data as RoundResultRow[] | null) ?? []);
  }, []);

  const loadLatestTournament = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoadError(null);
    setLoadingTournament(true);

    const { data: tournamentsData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (tournamentError) {
      setLoadError(`No se pudo cargar el torneo: ${tournamentError.message}`);
      setLoadingTournament(false);
      return;
    }

    const latestTournament = (tournamentsData?.[0] as Tournament | undefined) ?? null;
    setTournament(latestTournament);

    if (!latestTournament) {
      setRounds([]);
      setCompetitors([]);
      setResults([]);
      setSelectedRoundId(null);
      setSelectedCompetitorId(null);
      setLoadingTournament(false);
      return;
    }

    const [roundsRes, competitorsRes] = await Promise.all([
      supabase
        .from("rounds")
        .select("*")
        .eq("tournament_id", latestTournament.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("competitors")
        .select("*")
        .eq("tournament_id", latestTournament.id)
        .order("bib_number", { ascending: true }),
    ]);

    if (roundsRes.error || competitorsRes.error) {
      setLoadError(
        roundsRes.error?.message ??
          competitorsRes.error?.message ??
          "Error al cargar datos del torneo."
      );
      setLoadingTournament(false);
      return;
    }

    const loadedRounds = (roundsRes.data as Round[] | null) ?? [];
    const loadedCompetitors = (competitorsRes.data as Competitor[] | null) ?? [];

    setRounds(loadedRounds);
    setCompetitors(loadedCompetitors);

    const defaultRound =
      loadedRounds.find((r) => r.status === "active") ?? loadedRounds[0] ?? null;
    setSelectedRoundId(defaultRound?.id ?? null);
    setSelectedCompetitorId(loadedCompetitors[0]?.id ?? null);

    if (defaultRound) {
      await loadRoundResults(defaultRound.id);
    } else {
      setResults([]);
    }

    setLoadingTournament(false);
  }, [loadRoundResults]);

  useEffect(() => {
    if (!envConfigured) {
      router.replace("/login");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/login");
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace("/login");
        return;
      }

      setUserEmail(data.session.user.email ?? null);
      setAuthReady(true);
      void loadLatestTournament();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [envConfigured, loadLatestTournament, router]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleCreateTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const trimmedName = newTournamentName.trim();
    if (!trimmedName) {
      setCreateError("Ingresa un nombre para el torneo.");
      return;
    }

    setCreateError(null);
    setCreatingTournament(true);

    const { data: createdTournament, error: tournamentError } = await supabase
      .from("tournaments")
      .insert({
        name: trimmedName,
        slug: buildSlug(trimmedName, newTournamentDate),
        event_date: newTournamentDate,
        status: "active",
      })
      .select("*")
      .single();

    if (tournamentError || !createdTournament) {
      setCreatingTournament(false);
      setCreateError(
        `No se pudo crear el torneo: ${tournamentError?.message ?? "Error desconocido"}`
      );
      return;
    }

    const { data: createdRound, error: roundError } = await supabase
      .from("rounds")
      .insert({
        tournament_id: (createdTournament as Tournament).id,
        event_code: "333",
        event_name: "3x3x3 Cube",
        round_number: 1,
        name: "Ronda 1",
        status: "active",
        sort_order: 1,
      })
      .select("*")
      .single();

    setCreatingTournament(false);

    if (roundError) {
      setCreateError(`Torneo creado, pero falló la ronda inicial: ${roundError.message}`);
    }

    const typedTournament = createdTournament as Tournament;
    const typedRound = (createdRound as Round | null) ?? null;

    setTournament(typedTournament);
    setRounds(typedRound ? [typedRound] : []);
    setSelectedRoundId(typedRound?.id ?? null);
    setCompetitors([]);
    setResults([]);
    setSelectedCompetitorId(null);
  }

  function handleSelectRound(roundId: string) {
    if (roundId === selectedRoundId) return;
    setSelectedRoundId(roundId);
    setResults([]);
    void loadRoundResults(roundId);
  }

  function handleRoundCreated(round: Round) {
    setRounds((prev) =>
      [...prev, round].sort((a, b) => a.sort_order - b.sort_order)
    );
    setSelectedRoundId(round.id);
    setResults([]);
  }

  function handleRoundUpdated(updated: Round) {
    setRounds((prev) =>
      prev.map((round) => (round.id === updated.id ? updated : round))
    );
  }

  function handleCompetitorAdded(competitor: Competitor) {
    setCompetitors((prev) =>
      [...prev, competitor].sort((a, b) => a.bib_number - b.bib_number)
    );
    setSelectedCompetitorId((prevId) => prevId ?? competitor.id);
  }

  function handleCompetitorDeleted(competitorId: string) {
    setCompetitors((prev) => {
      const next = prev.filter((item) => item.id !== competitorId);
      setSelectedCompetitorId((currentSelected) => {
        if (currentSelected !== competitorId) return currentSelected;
        return next[0]?.id ?? null;
      });
      return next;
    });
    setResults((prev) => prev.filter((row) => row.competitor_id !== competitorId));
  }

  function handleRoundResultDeleted(competitorId: string) {
    setResults((prev) => prev.filter((row) => row.competitor_id !== competitorId));
  }

  const handleResultSaved = useCallback((savedRow: RoundResultRow) => {
    setResults((prev) => {
      const exists = prev.some(
        (row) =>
          row.id === savedRow.id || row.competitor_id === savedRow.competitor_id
      );
      if (exists) {
        return prev.map((row) =>
          row.id === savedRow.id || row.competitor_id === savedRow.competitor_id
            ? savedRow
            : row
        );
      }
      return [...prev, savedRow];
    });
  }, []);

  const activeRound = useMemo(
    () => rounds.find((r) => r.id === selectedRoundId) ?? null,
    [rounds, selectedRoundId]
  );

  const selectedCompetitor = useMemo(
    () => competitors.find((c) => c.id === selectedCompetitorId) ?? null,
    [competitors, selectedCompetitorId]
  );

  const selectedResult = useMemo(() => {
    if (!selectedCompetitor) return null;
    return (
      results.find((row) => row.competitor_id === selectedCompetitor.id) ?? null
    );
  }, [results, selectedCompetitor]);

  if (!authReady || loadingTournament) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Cargando panel de jueces...</p>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-lg">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              ← Marcador en vivo
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Crear torneo inicial
                </h1>
                <p className="text-sm text-slate-500">
                  Se creará automáticamente la primera ronda de 3x3x3 Cube.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateTournament} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="tournament-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Nombre del torneo
                </label>
                <input
                  id="tournament-name"
                  type="text"
                  required
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  placeholder="Ej. Torneo Cubo Primavera 2026"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label
                  htmlFor="tournament-date"
                  className="block text-sm font-medium text-slate-700"
                >
                  Fecha
                </label>
                <input
                  id="tournament-date"
                  type="date"
                  required
                  value={newTournamentDate}
                  onChange={(e) => setNewTournamentDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {createError && (
                <p role="alert" className="text-sm text-red-600">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingTournament}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {creatingTournament ? "Creando torneo..." : "Crear torneo y empezar"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
                {tournament.name}
              </h1>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                Panel de Jueces
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {tournament.event_date}
              </span>
              {userEmail && <span>Sesión: {userEmail}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" />
              Marcador en vivo (/)
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-700"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6">
        {loadError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {loadError}
          </div>
        )}

        <RoundManager
          tournamentId={tournament.id}
          rounds={rounds}
          selectedRoundId={selectedRoundId}
          onSelectRound={handleSelectRound}
          onRoundCreated={handleRoundCreated}
          onRoundUpdated={handleRoundUpdated}
        />

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[400px_1fr]">
          <CompetitorManager
            tournamentId={tournament.id}
            activeRound={activeRound}
            competitors={competitors}
            results={results}
            selectedCompetitorId={selectedCompetitorId}
            onSelectCompetitor={(competitor) =>
              setSelectedCompetitorId(competitor.id)
            }
            onCompetitorAdded={handleCompetitorAdded}
            onCompetitorDeleted={handleCompetitorDeleted}
            onRoundResultDeleted={handleRoundResultDeleted}
          />

          <div>
            {!activeRound ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No hay ninguna ronda seleccionada.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Crea o selecciona una ronda arriba para comenzar a capturar tiempos.
                </p>
              </div>
            ) : !selectedCompetitor ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <UserCheck className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700">
                  Selecciona un competidor para capturar sus 5 intentos
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Registra un competidor en el panel izquierdo o haz clic en alguno de la lista.
                </p>
              </div>
            ) : (
              <SolveInputGrid
                key={`${activeRound.id}:${selectedCompetitor.id}`}
                round={activeRound}
                competitor={selectedCompetitor}
                existingResult={selectedResult}
                onSaved={handleResultSaved}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
