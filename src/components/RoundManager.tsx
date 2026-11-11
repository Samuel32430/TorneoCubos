"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  WCA_EVENTS,
  type Round,
  type RoundStatus,
} from "@/types/tournament";

interface RoundManagerProps {
  tournamentId: string;
  rounds: Round[];
  selectedRoundId: string | null;
  onSelectRound: (roundId: string) => void;
  onRoundCreated: (round: Round) => void;
  onRoundUpdated: (round: Round) => void;
}

const STATUS_OPTIONS: { value: RoundStatus; label: string; dotClass: string }[] = [
  { value: "upcoming", label: "Próxima", dotClass: "bg-slate-400" },
  { value: "active", label: "Activa", dotClass: "bg-emerald-500" },
  { value: "finished", label: "Finalizada", dotClass: "bg-amber-500" },
];

export function RoundManager({
  tournamentId,
  rounds,
  selectedRoundId,
  onSelectRound,
  onRoundCreated,
  onRoundUpdated,
}: RoundManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventCode, setEventCode] = useState<string>("333");
  const [roundName, setRoundName] = useState("Ronda 1");
  const [nameEdited, setNameEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;

  function suggestRoundName(code: string): string {
    const count = rounds.filter((r) => r.event_code === code).length;
    return `Ronda ${count + 1}`;
  }

  function handleOpenForm() {
    const defaultCode = "333";
    setEventCode(defaultCode);
    setRoundName(suggestRoundName(defaultCode));
    setNameEdited(false);
    setErrorMessage(null);
    setShowCreateForm(true);
  }

  function handleEventChange(nextCode: string) {
    setEventCode(nextCode);
    if (!nameEdited) {
      setRoundName(suggestRoundName(nextCode));
    }
  }

  async function handleStatusChange(nextStatus: RoundStatus) {
    if (!selectedRound || selectedRound.status === nextStatus) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setErrorMessage(null);
    setUpdatingStatus(true);

    const { data, error } = await supabase
      .from("rounds")
      .update({ status: nextStatus })
      .eq("id", selectedRound.id)
      .select("*")
      .single();

    setUpdatingStatus(false);

    if (error) {
      setErrorMessage(`No se pudo actualizar el estado: ${error.message}`);
      return;
    }

    onRoundUpdated(data as Round);
  }

  async function handleCreateRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const selectedEvent =
      WCA_EVENTS.find((item) => item.code === eventCode) ?? WCA_EVENTS[0];
    const trimmedName = roundName.trim() || suggestRoundName(selectedEvent.code);

    const sameEventRounds = rounds.filter(
      (r) => r.event_code === selectedEvent.code
    );
    const nextRoundNumber =
      sameEventRounds.reduce((max, r) => Math.max(max, r.round_number), 0) + 1;
    const nextSortOrder =
      rounds.reduce((max, r) => Math.max(max, r.sort_order), 0) + 1;

    const initialStatus: RoundStatus = rounds.some((r) => r.status === "active")
      ? "upcoming"
      : "active";

    setErrorMessage(null);
    setCreating(true);

    const { data, error } = await supabase
      .from("rounds")
      .insert({
        tournament_id: tournamentId,
        event_code: selectedEvent.code,
        event_name: selectedEvent.name,
        round_number: nextRoundNumber,
        name: trimmedName,
        status: initialStatus,
        sort_order: nextSortOrder,
      })
      .select("*")
      .single();

    setCreating(false);

    if (error) {
      setErrorMessage(`No se pudo crear la ronda: ${error.message}`);
      return;
    }

    onRoundCreated(data as Round);
    setShowCreateForm(false);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">
            Rondas
          </span>
          {rounds.length === 0 ? (
            <span className="text-sm text-slate-500">
              No hay rondas creadas todavía.
            </span>
          ) : (
            rounds.map((round) => {
              const isSelected = round.id === selectedRoundId;
              const statusMeta =
                STATUS_OPTIONS.find((s) => s.value === round.status) ??
                STATUS_OPTIONS[0];

              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => onSelectRound(round.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${statusMeta.dotClass}`}
                    title={statusMeta.label}
                  />
                  <span>
                    {round.event_name} — {round.name}
                  </span>
                </button>
              );
            })
          )}

          {!showCreateForm && (
            <button
              type="button"
              onClick={handleOpenForm}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Agregar categoría / ronda
            </button>
          )}
        </div>

        {selectedRound && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Estado:</span>
            <div
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
              role="group"
              aria-label="Estado de la ronda activa"
            >
              {STATUS_OPTIONS.map((option) => {
                const isCurrent = selectedRound.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(option.value)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                      isCurrent
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${option.dotClass}`} />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateRound}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <div className="min-w-[190px] flex-1 sm:flex-initial">
            <label
              htmlFor="round-event-select"
              className="block text-xs font-medium text-slate-700"
            >
              Categoría WCA
            </label>
            <select
              id="round-event-select"
              autoFocus
              value={eventCode}
              onChange={(e) => handleEventChange(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            >
              {WCA_EVENTS.map((ev) => (
                <option key={ev.code} value={ev.code}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[160px] flex-1 sm:max-w-xs">
            <label
              htmlFor="round-custom-name"
              className="block text-xs font-medium text-slate-700"
            >
              Nombre de ronda
            </label>
            <input
              id="round-custom-name"
              type="text"
              required
              value={roundName}
              onChange={(e) => {
                setRoundName(e.target.value);
                setNameEdited(true);
              }}
              placeholder="Ej. Ronda 1, Final"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {creating ? "Creando..." : "Crear ronda"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </form>
      )}

      {errorMessage && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
