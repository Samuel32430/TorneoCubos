"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CheckCircle2, Eraser, Save } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  calculateAo5,
  formatCentiseconds,
  formatSolveSlot,
  normalizeSolves,
  parseTimeInput,
} from "@/lib/wca";
import {
  emptySolves,
  type Competitor,
  type Round,
  type RoundResultRow,
  type SolvePenalty,
  type SolveSlot,
} from "@/types/tournament";

interface SolveInputGridProps {
  round: Round;
  competitor: Competitor;
  existingResult: RoundResultRow | null;
  onSaved: (savedRow: RoundResultRow) => void;
}

function slotToRawText(slot: SolveSlot): string {
  if (slot.rawCs !== null) {
    return formatCentiseconds(slot.rawCs);
  }
  return "";
}

function buildInitialTexts(slots: SolveSlot[]): string[] {
  return slots.map(slotToRawText);
}

export function SolveInputGrid({
  round,
  competitor,
  existingResult,
  onSaved,
}: SolveInputGridProps) {
  const initialSlots = normalizeSolves(existingResult?.solves ?? emptySolves());

  const [slots, setSlots] = useState<SolveSlot[]>(initialSlots);
  const [rawTexts, setRawTexts] = useState<string[]>(() =>
    buildInitialTexts(initialSlots)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [trackedKey, setTrackedKey] = useState(
    `${round.id}:${competitor.id}:${existingResult?.updated_at ?? "new"}`
  );

  const currentKey = `${round.id}:${competitor.id}:${existingResult?.updated_at ?? "new"}`;
  if (currentKey !== trackedKey) {
    const nextSlots = normalizeSolves(existingResult?.solves ?? emptySolves());
    setTrackedKey(currentKey);
    if (`${round.id}:${competitor.id}` !== trackedKey.split(":").slice(0, 2).join(":") || !isDirty) {
      setSlots(nextSlots);
      setRawTexts(buildInitialTexts(nextSlots));
      setIsDirty(false);
      setErrorMessage(null);
      if (`${round.id}:${competitor.id}` !== trackedKey.split(":").slice(0, 2).join(":")) {
        setSaveFeedback(null);
      }
    }
  }

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  const parseErrors = useMemo(() => {
    return rawTexts.map((text) => {
      const trimmed = text.trim();
      if (!trimmed) return false;
      return parseTimeInput(trimmed) === null;
    });
  }, [rawTexts]);

  const summary = useMemo(() => calculateAo5(slots), [slots]);

  function handleTextChange(index: number, value: string) {
    setSaveFeedback(null);
    setErrorMessage(null);
    setIsDirty(true);

    setRawTexts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    const trimmed = value.trim();
    const parsed = parseTimeInput(value);

    setSlots((prev) => {
      const next = [...prev];
      const current = next[index];

      if (trimmed === "") {
        next[index] = { rawCs: null, penalty: "NONE" };
        return next;
      }

      if (!parsed) {
        next[index] = {
          rawCs: null,
          penalty: current.penalty === "+2" ? "+2" : "NONE",
        };
        return next;
      }

      if (parsed.penalty === "DNF" || parsed.penalty === "DNS") {
        next[index] = { rawCs: null, penalty: parsed.penalty };
        return next;
      }

      if (parsed.penalty === "+2") {
        next[index] = { rawCs: parsed.rawCs, penalty: "+2" };
        return next;
      }

      next[index] = {
        rawCs: parsed.rawCs,
        penalty: current.penalty === "+2" ? "+2" : "NONE",
      };
      return next;
    });
  }

  function handleTogglePenalty(
    index: number,
    targetPenalty: Exclude<SolvePenalty, "NONE">
  ) {
    setSaveFeedback(null);
    setErrorMessage(null);
    setIsDirty(true);

    const currentSlot = slots[index];
    const nextPenalty: SolvePenalty =
      currentSlot.penalty === targetPenalty ? "NONE" : targetPenalty;

    if (
      nextPenalty === "NONE" &&
      currentSlot.rawCs === null &&
      (currentSlot.penalty === "DNF" || currentSlot.penalty === "DNS")
    ) {
      setRawTexts((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
    } else if (
      targetPenalty === "+2" &&
      nextPenalty === "NONE" &&
      rawTexts[index].trim().endsWith("+")
    ) {
      setRawTexts((prev) => {
        const next = [...prev];
        next[index] = next[index].trim().slice(0, -1).trim();
        return next;
      });
    }

    setSlots((prev) => {
      const next = [...prev];
      const item = next[index];

      if (targetPenalty === "+2" && item.rawCs === null) {
        return prev;
      }

      next[index] = {
        rawCs: item.rawCs,
        penalty: nextPenalty,
      };
      return next;
    });
  }

  function handleClearSlot(index: number) {
    setSaveFeedback(null);
    setErrorMessage(null);
    setIsDirty(true);

    setRawTexts((prev) => {
      const next = [...prev];
      next[index] = "";
      return next;
    });

    setSlots((prev) => {
      const next = [...prev];
      next[index] = { rawCs: null, penalty: "NONE" };
      return next;
    });

    inputRefs.current[index]?.focus();
  }

  const saveResults = useCallback(async () => {
    const firstInvalidIndex = parseErrors.findIndex(Boolean);
    if (firstInvalidIndex !== -1) {
      setErrorMessage(
        `El intento ${firstInvalidIndex + 1} tiene un formato inválido. Usa formatos como 12.45, 1245, 1:05.32, dnf o dns.`
      );
      inputRefs.current[firstInvalidIndex]?.focus();
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setErrorMessage(null);
    setSaveFeedback(null);
    setSaving(true);

    const computed = calculateAo5(slots);

    const { data, error } = await supabase
      .from("round_results")
      .upsert(
        {
          round_id: round.id,
          competitor_id: competitor.id,
          solves: slots,
          best_cs: computed.bestCs,
          average_cs: computed.averageCs,
          completed_count: computed.completedCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "round_id,competitor_id" }
      )
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      setErrorMessage(`Error al guardar resultados: ${error.message}`);
      return;
    }

    setIsDirty(false);
    setSaveFeedback("Guardado en vivo");
    onSaved(data as RoundResultRow);
  }, [competitor.id, onSaved, parseErrors, round.id, slots]);

  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!saving) {
          void saveResults();
        }
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [saveResults, saving]);

  function handleInputKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (index < 4) {
      const nextInput = inputRefs.current[index + 1];
      nextInput?.focus();
      nextInput?.select();
    } else {
      saveButtonRef.current?.focus();
      void saveResults();
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveResults();
  }

  function renderSlotPreview(index: number) {
    if (parseErrors[index]) {
      return (
        <span className="font-mono text-sm font-medium text-red-600">
          Inválido
        </span>
      );
    }

    const slot = slots[index];
    if (slot.penalty === "DNF" || slot.penalty === "DNS") {
      return (
        <span className="font-mono text-sm font-semibold text-red-600">
          {slot.penalty}
        </span>
      );
    }

    if (slot.rawCs === null) {
      return <span className="font-mono text-sm text-slate-400">—</span>;
    }

    if (slot.penalty === "+2") {
      return (
        <span className="font-mono text-sm font-semibold text-amber-700">
          {formatCentiseconds(slot.rawCs + 200, "+2")}
        </span>
      );
    }

    return (
      <span className="font-mono text-sm font-semibold text-slate-900">
        {formatCentiseconds(slot.rawCs)}
      </span>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
              #{competitor.bib_number}
            </span>
            <h2 className="text-lg font-semibold text-slate-900">
              {competitor.full_name}
            </h2>
            {competitor.wca_id && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                {competitor.wca_id}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {round.event_name} — {round.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveFeedback && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saveFeedback}
            </span>
          )}
          {isDirty && !saveFeedback && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Cambios sin guardar
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
        <div className="space-y-2.5">
          {slots.map((slot, index) => {
            const hasError = parseErrors[index];
            const placeholder =
              slot.penalty === "DNF"
                ? "DNF"
                : slot.penalty === "DNS"
                  ? "DNS"
                  : "12.45, 1245 o 1:05.32";

            return (
              <div
                key={index}
                className={`flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${
                  hasError
                    ? "border-red-300 bg-red-50/40"
                    : "border-slate-200 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-1 items-center gap-3">
                  <label
                    htmlFor={`solve-input-${index}`}
                    className="w-20 shrink-0 text-sm font-medium text-slate-700"
                  >
                    Intento {index + 1}
                  </label>

                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    id={`solve-input-${index}`}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={rawTexts[index]}
                    onChange={(e) => handleTextChange(index, e.target.value)}
                    onKeyDown={(e) => handleInputKeyDown(e, index)}
                    placeholder={placeholder}
                    className="w-full max-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-base text-slate-900 placeholder:font-sans placeholder:text-xs placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />

                  <div className="min-w-[84px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-center">
                    {renderSlotPreview(index)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={slot.rawCs === null}
                    onClick={() => handleTogglePenalty(index, "+2")}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      slot.penalty === "+2"
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    +2
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePenalty(index, "DNF")}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      slot.penalty === "DNF"
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    DNF
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePenalty(index, "DNS")}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      slot.penalty === "DNS"
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    DNS
                  </button>

                  <button
                    type="button"
                    onClick={() => handleClearSlot(index)}
                    title={`Limpiar intento ${index + 1}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                    Limpiar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resumen en vivo ({summary.completedCount}/5)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {slots.map((slot, index) => {
                const isDropped =
                  summary.droppedMinIndex === index ||
                  summary.droppedMaxIndex === index;
                return (
                  <span
                    key={index}
                    className={`rounded-md border px-2 py-0.5 font-mono text-xs ${
                      isDropped
                        ? "border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-300 bg-white font-semibold text-slate-900"
                    }`}
                  >
                    {formatSolveSlot(slot, isDropped)}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-500">Mejor (Best)</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-slate-900">
                {formatCentiseconds(summary.bestCs)}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs text-slate-500">Ao5</p>
              <p className="mt-0.5 font-mono text-lg font-bold text-slate-900">
                {formatCentiseconds(summary.averageCs)}
              </p>
            </div>

            {summary.completedCount === 4 && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
                  <p className="text-xs text-blue-700">BPA</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-blue-900">
                    {formatCentiseconds(summary.bpaCs)}
                  </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <p className="text-xs text-amber-700">WPA</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-amber-900">
                    {formatCentiseconds(summary.wpaCs)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Pulsa <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">Enter</kbd> para pasar al siguiente intento o{" "}
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">Ctrl+S</kbd> para guardar.
          </p>

          <button
            ref={saveButtonRef}
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar resultados"}
          </button>
        </div>
      </form>
    </section>
  );
}
