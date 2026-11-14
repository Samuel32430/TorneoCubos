"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { normalizeSolves } from "@/lib/wca";
import type { Competitor, Round, RoundResultRow } from "@/types/tournament";

export type ConnectionStatus = "connecting" | "live" | "offline";

export interface UseLiveRoundResultsParams {
  tournamentId: string | null;
  initialRound: Round | null;
  initialRounds: Round[];
  initialCompetitors: Competitor[];
  initialResults: RoundResultRow[];
}

export interface UseLiveRoundResultsReturn {
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
  initialRound,
  initialRounds,
  initialCompetitors,
  initialResults,
}: UseLiveRoundResultsParams): UseLiveRoundResultsReturn {
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
          table: "competitors",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload: RealtimePostgresChangesPayload<Competitor>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            setCompetitors((prev) => removeById(prev, payload.old.id));
            return;
          }
          const updated = payload.new as Competitor;
          setCompetitors((prev) => sortCompetitors(upsertById(prev, updated)));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rounds",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload: RealtimePostgresChangesPayload<Round>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            setRounds((prev) => removeById(prev, payload.old.id));
            return;
          }
          const updated = payload.new as Round;
          setRounds((prev) => sortRounds(upsertById(prev, updated)));
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

  useEffect(() => {
    function handleVisibilityOrOnline() {
      if (document.visibilityState === "visible" && resolvedRoundId) {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return;

        void supabase
          .from("round_results")
          .select("*")
          .eq("round_id", resolvedRoundId)
          .then(({ data, error }) => {
            if (!error && data) {
              setResults((data as RoundResultRow[]).map(normalizeResultRow));
            }
          });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityOrOnline);
    window.addEventListener("online", handleVisibilityOrOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);
      window.removeEventListener("online", handleVisibilityOrOnline);
    };
  }, [resolvedRoundId]);

  return {
    rounds,
    activeRound,
    setActiveRoundId: selectRound,
    competitors,
    results,
    connectionStatus,
    lastUpdatedCompetitorId,
  };
}
