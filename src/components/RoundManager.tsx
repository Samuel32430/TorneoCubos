"use client";

import { useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Edit2,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ConfirmModal, type ModalAction } from "@/components/ConfirmModal";
import { generate10Scrambles } from "@/lib/scrambles";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  WCA_EVENTS,
  type Round,
  type RoundStatus,
  type ScrambleItem,
} from "@/types/tournament";

interface RoundManagerProps {
  tournamentId: string;
  rounds: Round[];
  selectedRoundId: string | null;
  onSelectRound: (roundId: string) => void;
  onRoundCreated: (round: Round) => void;
  onRoundUpdated: (round: Round) => void;
  onRoundDeleted?: (roundId: string) => void;
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
  onRoundDeleted,
}: RoundManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventCode, setEventCode] = useState<string>("333");
  const [roundName, setRoundName] = useState("Ronda 1");
  const [nameEdited, setNameEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Edición de nombre de ronda
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [savingRename, setSavingRename] = useState(false);

  // Eliminación de ronda
  const [roundToDelete, setRoundToDelete] = useState<Round | null>(null);
  const [deletingRound, setDeletingRound] = useState(false);

  // Visor de scrambles para jueces
  const [showScramblesPanel, setShowScramblesPanel] = useState(false);
  const [copiedScrambles, setCopiedScrambles] = useState(false);
  const [generatingScrambles, setGeneratingScrambles] = useState(false);

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

    // Generar automáticamente 10 scrambles oficiales WCA (5 Grupo A, 5 Grupo B)
    const generatedScrambles = generate10Scrambles(selectedEvent.code);

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
        scrambles: generatedScrambles,
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

  function startEditingName(round: Round) {
    setEditingRoundId(round.id);
    setEditedName(round.name);
  }

  async function handleSaveRename(round: Round) {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === round.name) {
      setEditingRoundId(null);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSavingRename(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("rounds")
      .update({ name: trimmed })
      .eq("id", round.id)
      .select("*")
      .single();

    setSavingRename(false);
    setEditingRoundId(null);

    if (error) {
      setErrorMessage(`No se pudo renombrar la ronda: ${error.message}`);
      return;
    }

    onRoundUpdated(data as Round);
  }

  async function handleConfirmDeleteRound() {
    if (!roundToDelete) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setDeletingRound(true);
    setErrorMessage(null);

    const { error } = await supabase
      .from("rounds")
      .delete()
      .eq("id", roundToDelete.id);

    setDeletingRound(false);
    const deletedId = roundToDelete.id;
    setRoundToDelete(null);

    if (error) {
      setErrorMessage(`No se pudo eliminar la ronda: ${error.message}`);
      return;
    }

    if (onRoundDeleted) {
      onRoundDeleted(deletedId);
    }
  }

  function handleCopyAllScrambles() {
    if (!selectedRound || !selectedRound.scrambles || selectedRound.scrambles.length === 0) return;

    const list = selectedRound.scrambles as ScrambleItem[];
    const textLines: string[] = [
      `=== ${selectedRound.event_name} — ${selectedRound.name} ===`,
      "",
      "-- GRUPO A --",
      ...list.filter((s) => s.group === "A").map((s) => `${s.attempt}. ${s.sequence}`),
      "",
      "-- GRUPO B --",
      ...list.filter((s) => s.group === "B").map((s) => `${s.attempt}. ${s.sequence}`),
    ];

    void navigator.clipboard.writeText(textLines.join("\n"));
    setCopiedScrambles(true);
    setTimeout(() => setCopiedScrambles(false), 2500);
  }

  async function handleGenerateScramblesForCurrentRound() {
    if (!selectedRound) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setGeneratingScrambles(true);
    setErrorMessage(null);

    const generated = generate10Scrambles(selectedRound.event_code);

    const { data, error } = await supabase
      .from("rounds")
      .update({ scrambles: generated })
      .eq("id", selectedRound.id)
      .select("*")
      .single();

    setGeneratingScrambles(false);

    if (error) {
      setErrorMessage(
        `Error al guardar mezclas: ${error.message}. Asegúrate de ejecutar en el SQL Editor de Supabase: alter table public.rounds add column if not exists scrambles jsonb default '[]'::jsonb;`
      );
      return;
    }

    onRoundUpdated(data as Round);
    setShowScramblesPanel(true);
  }

  const deleteRoundActions: ModalAction[] = [
    {
      label: "Cancelar",
      variant: "secondary",
      onClick: () => setRoundToDelete(null),
      disabled: deletingRound,
    },
    {
      label: "Eliminar ronda y tiempos",
      variant: "danger",
      onClick: handleConfirmDeleteRound,
      disabled: deletingRound,
    },
  ];

  const roundScrambles = (selectedRound?.scrambles as ScrambleItem[] | undefined) ?? [];

  return (
    <>
      <section className="rounded-2xl border border-[#CBD5E1] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] mr-1">
              Rondas
            </span>
            {rounds.length === 0 ? (
              <span className="text-sm text-[#64748B]">
                No hay rondas creadas todavía.
              </span>
            ) : (
              rounds.map((round) => {
                const isSelected = round.id === selectedRoundId;
                const statusMeta =
                  STATUS_OPTIONS.find((s) => s.value === round.status) ??
                  STATUS_OPTIONS[0];

                if (editingRoundId === round.id) {
                  return (
                    <div
                      key={round.id}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#0F172A] bg-white px-2 py-1 shadow-xs"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleSaveRename(round);
                          if (e.key === "Escape") setEditingRoundId(null);
                        }}
                        className="w-28 rounded px-1 text-sm font-semibold text-[#0F172A] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveRename(round)}
                        disabled={savingRename}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        title="Guardar nombre"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRoundId(null)}
                        className="rounded p-1 text-[#64748B] hover:bg-slate-100"
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={round.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelectRound(round.id)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-semibold transition-colors ${
                        isSelected
                          ? "border-[#0F172A] bg-[#0F172A] text-white shadow-xs"
                          : "border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] hover:bg-white hover:border-[#0F172A]/40"
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
                  </div>
                );
              })
            )}

            {!showCreateForm && (
              <button
                type="button"
                onClick={handleOpenForm}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[#CBD5E1] bg-white px-3 py-1.5 text-sm font-semibold text-[#0F172A] transition-colors hover:border-[#0F172A] hover:bg-[#F8FAFC]"
              >
                <Plus className="h-4 w-4" />
                Agregar categoría / ronda
              </button>
            )}
          </div>

          {selectedRound && (
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Acciones de la ronda seleccionada */}
              <button
                type="button"
                onClick={() => startEditingName(selectedRound)}
                title="Renombrar ronda seleccionada"
                className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Renombrar
              </button>

              {rounds.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRoundToDelete(selectedRound)}
                  title="Eliminar ronda seleccionada"
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#EF4444] hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar ronda
                </button>
              )}

              {roundScrambles.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowScramblesPanel(!showScramblesPanel)}
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    showScramblesPanel
                      ? "border-[#F59E0B] bg-amber-50 text-[#B45309]"
                      : "border-[#CBD5E1] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {showScramblesPanel ? "Ocultar mezclas" : "Ver mezclas (10)"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={generatingScrambles}
                  onClick={handleGenerateScramblesForCurrentRound}
                  title="Generar 10 mezclas oficiales WCA para esta ronda"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-[#B45309] hover:bg-amber-100 transition-colors shadow-2xs disabled:opacity-60"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#F59E0B]" />
                  {generatingScrambles ? "Generando mezclas..." : "Generar mezclas (10)"}
                </button>
              )}

              <div className="flex items-center gap-1.5 pl-2 border-l border-[#CBD5E1]">
                <span className="text-xs font-semibold text-[#64748B]">Estado:</span>
                <div
                  className="inline-flex rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
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
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-60 ${
                          isCurrent
                            ? "bg-white text-[#0F172A] shadow-xs"
                            : "text-[#64748B] hover:text-[#0F172A]"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${option.dotClass}`} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Panel colapsable de Scrambles para Jueces */}
        {showScramblesPanel && selectedRound && roundScrambles.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#F59E0B]" />
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Mezclas Oficiales WCA — {selectedRound.event_name} ({selectedRound.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCopyAllScrambles}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-300 px-3 py-1 text-xs font-bold text-[#0F172A] hover:bg-amber-100 transition-colors shadow-xs"
              >
                {copiedScrambles ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ¡Copiadas al portapapeles!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar 10 mezclas
                  </>
                )}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#B45309]">
                  Grupo A (Intentos 1 - 5)
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs text-[#0F172A]">
                  {roundScrambles
                    .filter((s) => s.group === "A")
                    .map((scramble) => (
                      <div
                        key={scramble.id}
                        className="rounded-lg bg-white p-2 border border-amber-200/60 shadow-2xs"
                      >
                        <span className="font-bold text-[#EA580C] mr-2">
                          #{scramble.attempt}:
                        </span>
                        <span>{scramble.sequence}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Grupo B (Intentos 1 - 5)
                </p>
                <div className="mt-2 space-y-1.5 font-mono text-xs text-[#0F172A]">
                  {roundScrambles
                    .filter((s) => s.group === "B")
                    .map((scramble) => (
                      <div
                        key={scramble.id}
                        className="rounded-lg bg-white p-2 border border-amber-200/60 shadow-2xs"
                      >
                        <span className="font-bold text-[#64748B] mr-2">
                          #{scramble.attempt}:
                        </span>
                        <span>{scramble.sequence}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showCreateForm && (
          <form
            onSubmit={handleCreateRound}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-4"
          >
            <div className="min-w-[190px] flex-1 sm:flex-initial">
              <label
                htmlFor="round-event-select"
                className="block text-xs font-semibold text-[#64748B]"
              >
                Categoría WCA
              </label>
              <select
                id="round-event-select"
                autoFocus
                value={eventCode}
                onChange={(e) => handleEventChange(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
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
                className="block text-xs font-semibold text-[#64748B]"
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
                placeholder="Ej. Ronda 1, Semifinal, Final"
                className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating}
                className="rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 shadow-xs"
              >
                {creating ? "Creando con mezclas WCA..." : "Crear ronda"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="inline-flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-100 hover:text-[#0F172A]"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            </div>
          </form>
        )}

        {errorMessage && (
          <p role="alert" className="mt-3 text-sm font-semibold text-[#EF4444]">
            {errorMessage}
          </p>
        )}
      </section>

      {/* Modal estético de confirmación para eliminar ronda */}
      <ConfirmModal
        isOpen={roundToDelete !== null}
        title="Eliminar ronda"
        description={
          roundToDelete ? (
            <p>
              ¿Seguro que deseas eliminar la ronda{" "}
              <strong className="text-[#0F172A]">
                {roundToDelete.event_name} — {roundToDelete.name}
              </strong>
              ? Se eliminarán permanentemente todos los tiempos y promedios capturados en ella.
            </p>
          ) : null
        }
        icon="danger"
        actions={deleteRoundActions}
        onClose={() => setRoundToDelete(null)}
      />
    </>
  );
}
