"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { normalizeSolves } from "@/lib/wca";
import type { Competitor, Round, RoundResultRow, Tournament } from "@/types/tournament";

export type ConnectionStatus = "connecting" | "live" | "offline";

export interface UseLiveRoundResultsParams {
  tournamentId: string | null;
  initialTournament?: Tournament | null;
  initialRound: Round | null;
  initialRounds: Round[];
  initialCompetitors: Competitor[];
  initialResults: RoundResultRow[];
}

export interface UseLiveRoundResultsReturn {
  tournament: Tournament | null;
  rounds: Round[];
  activeRound: Round | null;
  setActiveRoundId: (roundId: string) => void;
  competitors: Competitor[];
  results: RoundResultRow[];
  connectionStatus: ConnectionStatus;
  lastUpdatedCompetitorId: string | null;
}

function sortRounds(list: Round[]): Round[] {
  return [...list].sort(
    (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
  );
}

function sortCompetitors(list: Competitor[]): Competitor[] {
  return [...list].sort((a, b) => a.bib_number - b.bib_number);
}

function normalizeResultRow(row: RoundResultRow): RoundResultRow {
  return {
    ...row,
    solves: normalizeSolves(row.solves),
  };
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string | undefined): T[] {
  if (!id) return list;
  return list.filter((item) => item.id !== id);
}

export function useLiveRoundResults({
  tournamentId,
  initialTournament,
  initialRound,
  initialRounds,
  initialCompetitors,
  initialResults,
}: UseLiveRoundResultsParams): UseLiveRoundResultsReturn {
  const [tournament, setTournament] = useState<Tournament | null>(() => initialTournament ?? null);
  const [rounds, setRounds] = useState<Round[]>(() => sortRounds(initialRounds));
  const [activeRoundId, setActiveRoundId] = useState<string | null>(
    () => initialRound?.id ?? initialRounds[0]?.id ?? null
  );
  const [competitors, setCompetitors] = useState<Competitor[]>(() =>
    sortCompetitors(initialCompetitors)
  );
  const [results, setResults] = useState<RoundResultRow[]>(() =>
    initialResults.map(normalizeResultRow)
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() =>
    hasSupabaseEnv() && tournamentId ? "connecting" : "offline"
  );
  const [lastUpdatedCompetitorId, setLastUpdatedCompetitorId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (initialTournament) {
      setTournament(initialTournament);
    }
  }, [initialTournament]);

  useEffect(() => {
    if (initialCompetitors && initialCompetitors.length > 0) {
      setCompetitors(sortCompetitors(initialCompetitors));
    }
  }, [initialCompetitors]);

  const loadedRoundIdRef = useRef<string | null>(initialRound?.id ?? null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRound = useMemo(
    () =>
      rounds.find((r) => r.id === activeRoundId) ??
      rounds.find((r) => r.status === "active") ??
      rounds[0] ??
      null,
    [rounds, activeRoundId]
  );

  const resolvedRoundId = activeRound?.id ?? null;

  const triggerRowFlash = useCallback((competitorId: string) => {
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setLastUpdatedCompetitorId(competitorId);
    flashTimerRef.current = setTimeout(() => {
      setLastUpdatedCompetitorId(null);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const selectRound = useCallback(
    (nextRoundId: string) => {
      if (nextRoundId === resolvedRoundId) return;
      setActiveRoundId(nextRoundId);
      setResults([]);
      if (hasSupabaseEnv() && tournamentId) {
        setConnectionStatus("connecting");
      }
    },
    [resolvedRoundId, tournamentId]
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !tournamentId) return;

    let cancelled = false;

    if (resolvedRoundId && loadedRoundIdRef.current !== resolvedRoundId) {
      void supabase
        .from("round_results")
        .select("*")
        .eq("round_id", resolvedRoundId)
        .then(({ data, error }) => {
          if (cancelled || error || !data) return;
          loadedRoundIdRef.current = resolvedRoundId;
          setResults((data as RoundResultRow[]).map(normalizeResultRow));
        });
    }

    const channel = supabase.channel(
      `live-tournament-${tournamentId}-${resolvedRoundId ?? "none"}`
    );

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournaments",
        },
        (payload: RealtimePostgresChangesPayload<Tournament>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            if (payload.old?.id === tournamentId) setTournament(null);
            return;
          }
          const updated = payload.new as Tournament;
          if (updated && updated.id === tournamentId) {
            setTournament(updated);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competitors",
        },
        (payload: RealtimePostgresChangesPayload<Competitor>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            setCompetitors((prev) => removeById(prev, payload.old.id));
            return;
          }
          const updated = payload.new as Competitor;
          if (updated && updated.tournament_id === tournamentId) {
            setCompetitors((prev) => sortCompetitors(upsertById(prev, updated)));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rounds",
        },
        (payload: RealtimePostgresChangesPayload<Round>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            setRounds((prev) => removeById(prev, payload.old.id));
            return;
          }
          const updated = payload.new as Round;
          if (updated && updated.tournament_id === tournamentId) {
            setRounds((prev) => sortRounds(upsertById(prev, updated)));
          }
        }
      );

    if (resolvedRoundId) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "round_results",
          filter: `round_id=eq.${resolvedRoundId}`,
        },
        (payload: RealtimePostgresChangesPayload<RoundResultRow>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            setResults((prev) => removeById(prev, payload.old.id));
            return;
          }
          const updated = normalizeResultRow(payload.new as RoundResultRow);
          if (updated.round_id !== resolvedRoundId) return;
          setResults((prev) => upsertById(prev, updated));
          triggerRowFlash(updated.competitor_id);
        }
      );
    }

    channel.subscribe((status) => {
      if (cancelled) return;
      if (status === "SUBSCRIBED") {
        setConnectionStatus("live");
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setConnectionStatus("offline");
      }
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [tournamentId, resolvedRoundId, triggerRowFlash]);

  // Sincronización completa como respaldo activo ante cualquier desconexión
  const syncAll = useCallback(async () => {
    if (!tournamentId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    try {
      const [tRes, cRes, rRes] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
        supabase
          .from("competitors")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("bib_number", { ascending: true }),
        supabase
          .from("rounds")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (!tRes.error && tRes.data) {
        setTournament(tRes.data as Tournament);
      }
      if (!cRes.error && cRes.data) {
        setCompetitors(sortCompetitors((cRes.data as Competitor[]) ?? []));
      }
      if (!rRes.error && rRes.data) {
        setRounds(sortRounds((rRes.data as Round[]) ?? []));
      }

      if (resolvedRoundId) {
        const resultsRes = await supabase
          .from("round_results")
          .select("*")
          .eq("round_id", resolvedRoundId);
        if (!resultsRes.error && resultsRes.data) {
          setResults((resultsRes.data as RoundResultRow[]).map(normalizeResultRow));
        }
      }
    } catch {
      // Ignorar errores transitorios de red en el sondeo en segundo plano
    }
  }, [tournamentId, resolvedRoundId]);

  // Sondeo continuo (cada 2.5s) y sincronización al enfocar o volver a estar online
  useEffect(() => {
    const interval = setInterval(() => {
      void syncAll();
    }, 2500);

    function handleVisibilityOrOnline() {
      if (document.visibilityState === "visible") {
        void syncAll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    window.addEventListener("online", handleVisibilityOrOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      window.removeEventListener("online", handleVisibilityOrOnline);
    };
  }, [syncAll]);

  // Sincronización instantánea entre pestañas abiertas en el mismo navegador (BroadcastChannel)
  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const bc = new BroadcastChannel("torneo_cubo_sync");
    bc.onmessage = (event) => {
      if (event.data?.tournament && event.data.tournament.id === tournamentId) {
        setTournament(event.data.tournament as Tournament);
      }
      void syncAll();
    };

    return () => {
      bc.close();
    };
  }, [tournamentId, syncAll]);

  return {
    tournament,
    rounds,
    activeRound,
    setActiveRoundId: selectRound,
    competitors,
    results,
    connectionStatus,
    lastUpdatedCompetitorId,
  };
}
