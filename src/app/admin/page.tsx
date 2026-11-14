"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Edit,
  ExternalLink,
  LogOut,
  Play,
  Plus,
  Trash2,
  Trophy,
  UserCheck,
  X,
} from "lucide-react";
import { CompetitorManager } from "@/components/CompetitorManager";
import { ConfirmModal, type ModalAction } from "@/components/ConfirmModal";
import { RoundManager } from "@/components/RoundManager";
import { SolveInputGrid } from "@/components/SolveInputGrid";
import { generate10Scrambles } from "@/lib/scrambles";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type {
  Competitor,
  Round,
  RoundResultRow,
  Tournament,
  TournamentStatus,
} from "@/types/tournament";

function buildSlug(name: string, date: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const prefix = base || "torneo";
  return `${prefix}-${date}-${Date.now().toString().slice(-4)}`;
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function notifySyncTabs(type: string, data?: unknown) {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
  try {
    const bc = new BroadcastChannel("torneo_cubo_sync");
    bc.postMessage({ type, data });
    bc.close();
  } catch {}
}

export default function AdminPage() {
  const router = useRouter();
  const envConfigured = hasSupabaseEnv();

  const [authReady, setAuthReady] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lista de todos los torneos disponibles
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [results, setResults] = useState<RoundResultRow[]>([]);

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectedCompetitorId, setSelectedCompetitorId] = useState<string | null>(null);

  // Modales de Torneo
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTournamentName, setNewTournamentName] = useState("");
  const [newTournamentDate, setNewTournamentDate] = useState(getTodayDateString);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editTournamentName, setEditTournamentName] = useState("");
  const [editTournamentDate, setEditTournamentDate] = useState("");
  const [editTournamentStatus, setEditTournamentStatus] = useState<TournamentStatus>("active");
  const [editingTournament, setEditingTournament] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [showDeleteTournamentModal, setShowDeleteTournamentModal] = useState(false);
  const [deletingTournament, setDeletingTournament] = useState(false);

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

  const loadTournamentData = useCallback(async (targetTournament: Tournament) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setTournament(targetTournament);
    setLoadingTournament(true);
    setLoadError(null);

    const [roundsRes, competitorsRes] = await Promise.all([
      supabase
        .from("rounds")
        .select("*")
        .eq("tournament_id", targetTournament.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("competitors")
        .select("*")
        .eq("tournament_id", targetTournament.id)
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

  const loadTournaments = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setLoadError(null);
    setLoadingTournament(true);

    const { data: tournamentsData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false });

    if (tournamentError) {
      setLoadError(`No se pudieron cargar los torneos: ${tournamentError.message}`);
      setLoadingTournament(false);
      return;
    }

    const list = (tournamentsData as Tournament[] | null) ?? [];
    setAllTournaments(list);

    if (list.length === 0) {
      setTournament(null);
      setRounds([]);
      setCompetitors([]);
      setResults([]);
      setSelectedRoundId(null);
      setSelectedCompetitorId(null);
      setLoadingTournament(false);
      return;
    }

    // Seleccionar el torneo activo o el primero en la lista
    const active = list.find((t) => t.status === "active") ?? list[0];
    await loadTournamentData(active);
  }, [loadTournamentData]);

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
      void loadTournaments();
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
  }, [envConfigured, loadTournaments, router]);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Crear nuevo torneo
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

    // Generar scrambles WCA para la ronda inicial
    const initialScrambles = generate10Scrambles("333");

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
        scrambles: initialScrambles,
      })
      .select("*")
      .single();

    setCreatingTournament(false);

    if (roundError) {
      setCreateError(`Torneo creado, pero falló la ronda inicial: ${roundError.message}`);
    }

    const typedTournament = createdTournament as Tournament;
    const typedRound = (createdRound as Round | null) ?? null;

    setAllTournaments((prev) => [typedTournament, ...prev]);
    setTournament(typedTournament);
    setRounds(typedRound ? [typedRound] : []);
    setSelectedRoundId(typedRound?.id ?? null);
    setCompetitors([]);
    setResults([]);
    setSelectedCompetitorId(null);
    setShowCreateModal(false);
    setNewTournamentName("");
  }

  // Abrir modal de edición
  function handleOpenEditModal() {
    if (!tournament) return;
    setEditTournamentName(tournament.name);
    setEditTournamentDate(tournament.event_date);
    setEditTournamentStatus(tournament.status);
    setEditError(null);
    setShowEditModal(true);
  }

  // Guardar edición del torneo
  async function handleSaveTournamentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tournament) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const trimmedName = editTournamentName.trim();
    if (!trimmedName) {
      setEditError("El nombre no puede estar vacío.");
      return;
    }

    setEditingTournament(true);
    setEditError(null);

    const { data, error } = await supabase
      .from("tournaments")
      .update({
        name: trimmedName,
        event_date: editTournamentDate,
        status: editTournamentStatus,
      })
      .eq("id", tournament.id)
      .select("*")
      .single();

    setEditingTournament(false);

    if (error || !data) {
      setEditError(`Error al actualizar: ${error?.message ?? "Error desconocido"}`);
      return;
    }

    const updated = data as Tournament;
    setTournament(updated);
    setAllTournaments((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    notifySyncTabs("TOURNAMENT_UPDATED", updated);
    setShowEditModal(false);
  }

  // Cambio rápido del estado del torneo (Borrador <-> Activo <-> Finalizado)
  async function handleQuickStatusChange(nextStatus: TournamentStatus) {
    if (!tournament) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("tournaments")
      .update({ status: nextStatus })
      .eq("id", tournament.id)
      .select("*")
      .single();

    if (error || !data) {
      setLoadError(`No se pudo actualizar el estado del torneo: ${error?.message ?? "Error desconocido"}`);
      return;
    }

    const updated = data as Tournament;
    setTournament(updated);
    setAllTournaments((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
    notifySyncTabs("TOURNAMENT_UPDATED", updated);
  }

  // Eliminar torneo actual
  async function handleConfirmDeleteTournament() {
    if (!tournament) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setDeletingTournament(true);
    const { error } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournament.id);

    setDeletingTournament(false);
    setShowDeleteTournamentModal(false);

    if (error) {
      setLoadError(`No se pudo eliminar el torneo: ${error.message}`);
      return;
    }

    const remaining = allTournaments.filter((t) => t.id !== tournament.id);
    setAllTournaments(remaining);

    if (remaining.length > 0) {
      void loadTournamentData(remaining[0]);
    } else {
      setTournament(null);
      setRounds([]);
      setCompetitors([]);
      setResults([]);
    }
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
    notifySyncTabs("ROUND_CREATED", round);
  }

  function handleRoundUpdated(updated: Round) {
    setRounds((prev) =>
      prev.map((round) => (round.id === updated.id ? updated : round))
    );
    notifySyncTabs("ROUND_UPDATED", updated);
  }

  function handleRoundDeleted(roundId: string) {
    setRounds((prev) => {
      const next = prev.filter((r) => r.id !== roundId);
      if (selectedRoundId === roundId) {
        const nextSelected = next[0]?.id ?? null;
        setSelectedRoundId(nextSelected);
        if (nextSelected) {
          void loadRoundResults(nextSelected);
        } else {
          setResults([]);
        }
      }
      return next;
    });
    notifySyncTabs("ROUND_DELETED", roundId);
  }

  function handleCompetitorAdded(competitor: Competitor) {
    setCompetitors((prev) =>
      [...prev, competitor].sort((a, b) => a.bib_number - b.bib_number)
    );
    setSelectedCompetitorId((prevId) => prevId ?? competitor.id);
    notifySyncTabs("COMPETITOR_ADDED", competitor);
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
    notifySyncTabs("COMPETITOR_DELETED", competitorId);
  }

  function handleRoundResultDeleted(competitorId: string) {
    setResults((prev) => prev.filter((row) => row.competitor_id !== competitorId));
    notifySyncTabs("RESULT_DELETED", competitorId);
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
    notifySyncTabs("RESULT_SAVED", savedRow);
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

  const deleteTournamentActions: ModalAction[] = [
    {
      label: "Cancelar",
      variant: "secondary",
      onClick: () => setShowDeleteTournamentModal(false),
      disabled: deletingTournament,
    },
    {
      label: "Eliminar torneo completo",
      variant: "danger",
      onClick: handleConfirmDeleteTournament,
      disabled: deletingTournament,
    },
  ];

  if (!authReady || loadingTournament) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F1F5F9] px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[#CBD5E1] bg-white p-6 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0F172A] border-t-transparent" />
          <p className="text-sm font-semibold text-[#0F172A]">Cargando panel de jueces...</p>
        </div>
      </main>
    );
  }

  // Si no hay ningún torneo creado en la base de datos
  if (!tournament) {
    return (
      <main className="min-h-screen bg-[#F1F5F9] px-4 py-10">
        <div className="mx-auto max-w-lg">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="text-sm font-semibold text-[#64748B] hover:text-[#0F172A]"
            >
              ← Marcador en vivo
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#0F172A] hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>

          <div className="rounded-2xl border border-[#CBD5E1] bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-0.5 overflow-hidden">
                <Image
                  src="/conquis-logo.png"
                  alt="Club Conquistadores"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#0F172A]">
                  Crear torneo inicial
                </h1>
                <p className="text-xs text-[#64748B]">
                  Se generará automáticamente la primera ronda con 10 mezclas WCA.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateTournament} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="tournament-name"
                  className="block text-xs font-semibold text-[#64748B]"
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
                  className="mt-1.5 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="tournament-date"
                  className="block text-xs font-semibold text-[#64748B]"
                >
                  Fecha del evento
                </label>
                <input
                  id="tournament-date"
                  type="date"
                  required
                  value={newTournamentDate}
                  onChange={(e) => setNewTournamentDate(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                />
              </div>

              {createError && (
                <p role="alert" className="text-xs font-semibold text-[#EF4444]">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingTournament}
                className="w-full rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 shadow-xs"
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
    <div className="min-h-screen bg-[#F1F5F9]">
      <header className="border-b border-[#CBD5E1] bg-white shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Selector y Gestión de Torneos */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-0.5 overflow-hidden">
                <Image
                  src="/conquis-logo.png"
                  alt="Club Conquistadores"
                  width={32}
                  height={32}
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="relative">
                <select
                  value={tournament.id}
                  onChange={(e) => {
                    const picked = allTournaments.find((t) => t.id === e.target.value);
                    if (picked) void loadTournamentData(picked);
                  }}
                  className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] py-1.5 pl-3 pr-8 text-sm font-bold text-[#0F172A] hover:bg-white focus:border-[#0F172A] focus:outline-none"
                >
                  {allTournaments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.event_date})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botones de acción del torneo */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleOpenEditModal}
                title="Editar datos del torneo"
                className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              >
                <Edit className="h-3.5 w-3.5" />
                Editar
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewTournamentName("");
                  setNewTournamentDate(getTodayDateString());
                  setCreateError(null);
                  setShowCreateModal(true);
                }}
                title="Crear un nuevo torneo"
                className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                <Plus className="h-3.5 w-3.5 text-[#F59E0B]" />
                Nuevo Torneo
              </button>

              {allTournaments.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteTournamentModal(true)}
                  title="Eliminar este torneo"
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#EF4444] hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Estado del torneo y acción rápida */}
            <div className="flex items-center gap-2 pl-1 sm:border-l sm:border-[#CBD5E1] sm:pl-3">
              {tournament.status === "draft" && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-[#B45309]">
                    <Clock className="h-3 w-3" />
                    Borrador (Próximamente)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange("active")}
                    title="Iniciar el torneo y pasar al marcador en vivo para el público"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-colors"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    Iniciar Torneo
                  </button>
                </>
              )}

              {tournament.status === "active" && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    En Vivo
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange("finished")}
                    title="Marcar el torneo como finalizado"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:bg-slate-100 transition-colors"
                  >
                    Finalizar
                  </button>
                </>
              )}

              {tournament.status === "finished" && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-[#64748B]">
                    🏁 Finalizado
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange("active")}
                    title="Reactivar el torneo en vivo"
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    Reactivar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Navegación y Sesión */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
            >
              <ExternalLink className="h-4 w-4 text-[#F59E0B]" />
              Marcador en vivo
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-sm font-semibold text-[#64748B] transition-colors hover:bg-red-50 hover:border-red-200 hover:text-[#EF4444]"
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
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-[#EF4444]"
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
          onRoundDeleted={handleRoundDeleted}
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
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
                <p className="text-sm font-semibold text-[#0F172A]">
                  No hay ninguna ronda seleccionada.
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Crea o selecciona una ronda arriba para comenzar a capturar tiempos.
                </p>
              </div>
            ) : !selectedCompetitor ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
                <UserCheck className="mx-auto h-8 w-8 text-[#64748B]" />
                <p className="mt-2 text-sm font-semibold text-[#0F172A]">
                  Selecciona un competidor para capturar sus 5 intentos
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
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

      {/* Modal: Crear Nuevo Torneo */}
      {showCreateModal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowCreateModal(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-[#0F172A]">Crear nuevo torneo</h3>
            <p className="mt-1 text-xs text-[#64748B]">
              Se creará el torneo y se incluirá automáticamente la primera ronda con mezclas oficiales.
            </p>

            <form onSubmit={handleCreateTournament} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Nombre del torneo</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTournamentName}
                  onChange={(e) => setNewTournamentName(e.target.value)}
                  placeholder="Ej. Torneo Invierno 2026"
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Fecha del evento</label>
                <input
                  type="date"
                  required
                  value={newTournamentDate}
                  onChange={(e) => setNewTournamentDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                />
              </div>

              {createError && (
                <p className="text-xs font-semibold text-[#EF4444]">{createError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingTournament}
                  className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {creatingTournament ? "Creando..." : "Crear torneo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Torneo Actual */}
      {showEditModal && tournament && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setShowEditModal(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-[#64748B] hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-[#0F172A]">Editar torneo</h3>
            <p className="mt-1 text-xs text-[#64748B]">
              Actualiza el nombre, la fecha o el estado de este torneo.
            </p>

            <form onSubmit={handleSaveTournamentEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Nombre del torneo</label>
                <input
                  type="text"
                  required
                  value={editTournamentName}
                  onChange={(e) => setEditTournamentName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Fecha del evento</label>
                <input
                  type="date"
                  required
                  value={editTournamentDate}
                  onChange={(e) => setEditTournamentDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#64748B]">Estado del torneo</label>
                <select
                  value={editTournamentStatus}
                  onChange={(e) => setEditTournamentStatus(e.target.value as TournamentStatus)}
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
                >
                  <option value="active">Activo (En curso)</option>
                  <option value="finished">Finalizado</option>
                  <option value="draft">Borrador</option>
                </select>
              </div>

              {editError && (
                <p className="text-xs font-semibold text-[#EF4444]">{editError}</p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editingTournament}
                  className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {editingTournament ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación de Torneo */}
      <ConfirmModal
        isOpen={showDeleteTournamentModal}
        title="Eliminar torneo completo"
        description={
          tournament ? (
            <p>
              ¿Estás seguro de que deseas eliminar permanentemente el torneo{" "}
              <strong className="text-[#0F172A]">{tournament.name}</strong>? Se borrarán todas sus rondas, competidores y tiempos registrados.
            </p>
          ) : null
        }
        icon="danger"
        actions={deleteTournamentActions}
        onClose={() => setShowDeleteTournamentModal(false)}
      />
    </div>
  );
}
