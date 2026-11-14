"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Search, Trash2, UserPlus } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCentiseconds } from "@/lib/wca";
import type { Competitor, Round, RoundResultRow } from "@/types/tournament";

interface CompetitorManagerProps {
  tournamentId: string;
  activeRound: Round | null;
  competitors: Competitor[];
  results: RoundResultRow[];
  selectedCompetitorId: string | null;
  onSelectCompetitor: (competitor: Competitor) => void;
  onCompetitorAdded: (competitor: Competitor) => void;
  onCompetitorDeleted: (competitorId: string) => void;
}

export function CompetitorManager({
  tournamentId,
  activeRound,
  competitors,
  results,
  selectedCompetitorId,
  onSelectCompetitor,
  onCompetitorAdded,
  onCompetitorDeleted,
}: CompetitorManagerProps) {
  const [fullName, setFullName] = useState("");
  const [wcaId, setWcaId] = useState("");
  const [customBib, setCustomBib] = useState("");
  const [bibEdited, setBibEdited] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const suggestedBib = useMemo(
    () => competitors.reduce((max, item) => Math.max(max, item.bib_number), 0) + 1,
    [competitors]
  );

  const bibValue = bibEdited ? customBib : String(suggestedBib);

  const resultByCompetitorId = useMemo(() => {
    const map = new Map<string, RoundResultRow>();
    for (const row of results) {
      map.set(row.competitor_id, row);
    }
    return map;
  }, [results]);

  const filteredCompetitors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return competitors;

    return competitors.filter((competitor) => {
      const bibMatch = String(competitor.bib_number).includes(query);
      const nameMatch = competitor.full_name.toLowerCase().includes(query);
      const wcaMatch = competitor.wca_id?.toLowerCase().includes(query) ?? false;
      return bibMatch || nameMatch || wcaMatch;
    });
  }, [competitors, searchQuery]);

  async function handleAddCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const trimmedName = fullName.trim();
    const parsedBib = Number.parseInt(bibValue, 10);
    const normalizedWcaId = wcaId.trim().toUpperCase();

    if (!trimmedName) {
      setErrorMessage("Ingresa el nombre del competidor.");
      return;
    }

    if (!Number.isInteger(parsedBib) || parsedBib <= 0) {
      setErrorMessage("El número de dorsal (#bib) debe ser un entero positivo.");
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    const { data, error } = await supabase
      .from("competitors")
      .insert({
        tournament_id: tournamentId,
        full_name: trimmedName,
        bib_number: parsedBib,
        wca_id: normalizedWcaId || null,
      })
      .select("*")
      .single();

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setErrorMessage(`El #${parsedBib} ya está asignado a otro competidor.`);
      } else {
        setErrorMessage(`Error al registrar competidor: ${error.message}`);
      }
      return;
    }

    setFullName("");
    setWcaId("");
    setCustomBib("");
    setBibEdited(false);
    onCompetitorAdded(data as Competitor);
  }

  async function handleDeleteCompetitor(competitor: Competitor) {
    const confirmed = window.confirm(
      `¿Eliminar a ${competitor.full_name} (#${competitor.bib_number})? Se eliminarán también sus tiempos registrados.`
    );
    if (!confirmed) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setErrorMessage(null);
    setDeletingId(competitor.id);

    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", competitor.id);

    setDeletingId(null);

    if (error) {
      setErrorMessage(`No se pudo eliminar: ${error.message}`);
      return;
    }

    onCompetitorDeleted(competitor.id);
  }

  function renderProgressBadge(competitorId: string) {
    if (!activeRound) {
      return (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          Sin ronda
        </span>
      );
    }

    const result = resultByCompetitorId.get(competitorId);
    const count = result?.completed_count ?? 0;

    if (count === 0) {
      return (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
          0/5
        </span>
      );
    }

    if (count < 5) {
      return (
        <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-medium text-blue-700">
          {count}/5
        </span>
      );
    }

    const avgText = formatCentiseconds(result?.average_cs ?? null);
    const isDnf = result?.average_cs === -1 || result?.average_cs === null;

    return (
      <span
        className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
          isDnf
            ? "bg-red-50 text-red-700"
            : "bg-emerald-50 text-emerald-700"
        }`}
      >
        Ao5 {avgText}
      </span>
    );
  }

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Competidores ({competitors.length})
          </h2>
        </div>

        <form onSubmit={handleAddCompetitor} className="mt-3 space-y-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_1fr]">
            <div>
              <label
                htmlFor="competitor-bib"
                className="block text-xs font-medium text-slate-600"
              >
                #Bib
              </label>
              <input
                id="competitor-bib"
                type="number"
                min={1}
                required
                value={bibValue}
                onChange={(e) => {
                  setCustomBib(e.target.value);
                  setBibEdited(true);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="competitor-name"
                className="block text-xs font-medium text-slate-600"
              >
                Nombre completo
              </label>
              <input
                id="competitor-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Ana Sofía Gómez"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="competitor-wca"
                className="block text-xs font-medium text-slate-600"
              >
                Club
              </label>
              <input
                id="competitor-wca"
                type="text"
                value={wcaId}
                onChange={(e) => setWcaId(e.target.value)}
                placeholder="Orion"
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              {submitting ? "Agregando..." : "Registrar"}
            </button>
          </div>

          {errorMessage && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {errorMessage}
            </p>
          )}
        </form>
      </div>

      <div className="border-b border-slate-200 px-4 py-2.5 bg-slate-50/70">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por #bib, nombre o Club..."
            className="block w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
        {filteredCompetitors.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            {competitors.length === 0
              ? "Aún no hay competidores registrados."
              : "No hay coincidencias con la búsqueda."}
          </div>
        ) : (
          filteredCompetitors.map((competitor) => {
            const isSelected = competitor.id === selectedCompetitorId;
            const isDeleting = deletingId === competitor.id;

            return (
              <div
                key={competitor.id}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                  isSelected ? "bg-slate-900/5" : "hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectCompetitor(competitor)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`inline-flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-xs font-semibold ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      #{competitor.bib_number}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {competitor.full_name}
                      </p>
                      {competitor.wca_id && (
                        <p className="font-mono text-xs text-slate-500">
                          {competitor.wca_id}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {renderProgressBadge(competitor.id)}
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {isSelected ? "En mesa" : "Capturar"}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteCompetitor(competitor)}
                  title="Eliminar competidor"
                  aria-label={`Eliminar a ${competitor.full_name}`}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
