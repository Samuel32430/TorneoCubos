"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Search, Trash2, UserPlus, AlertCircle } from "lucide-react";
import { ConfirmModal, type ModalAction } from "@/components/ConfirmModal";
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
  onRoundResultDeleted?: (competitorId: string) => void;
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
  onRoundResultDeleted,
}: CompetitorManagerProps) {
  const [fullName, setFullName] = useState("");
  const [club, setClub] = useState("");
  const [customBib, setCustomBib] = useState("");
  const [bibEdited, setBibEdited] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado para el modal de confirmación estético con blur
  const [targetForDeletion, setTargetForDeletion] = useState<Competitor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      const clubMatch = competitor.club?.toLowerCase().includes(query) ?? false;
      return bibMatch || nameMatch || clubMatch;
    });
  }, [competitors, searchQuery]);

  async function handleAddCompetitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const trimmedName = fullName.trim();
    const parsedBib = Number.parseInt(bibValue, 10);
    const normalizedClub = club.trim();

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
        club: normalizedClub || null,
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
    setClub("");
    setCustomBib("");
    setBibEdited(false);
    onCompetitorAdded(data as Competitor);
  }

  // Quitar solo de la ronda actual (aislado, no afecta otras rondas)
  async function handleRemoveFromActiveRound(competitor: Competitor) {
    if (!activeRound) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setErrorMessage(null);
    setIsDeleting(true);

    const { error } = await supabase
      .from("round_results")
      .delete()
      .match({ round_id: activeRound.id, competitor_id: competitor.id });

    setIsDeleting(false);
    setTargetForDeletion(null);

    if (error) {
      setErrorMessage(`No se pudo quitar de la ronda: ${error.message}`);
      return;
    }

    if (onRoundResultDeleted) {
      onRoundResultDeleted(competitor.id);
    }
  }

  // Eliminar definitivamente del torneo completo
  async function handleDeleteFromTournament(competitor: Competitor) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setErrorMessage(null);
    setIsDeleting(true);

    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", competitor.id);

    setIsDeleting(false);
    setTargetForDeletion(null);

    if (error) {
      setErrorMessage(`No se pudo eliminar del torneo: ${error.message}`);
      return;
    }

    onCompetitorDeleted(competitor.id);
  }

  function renderProgressBadge(competitorId: string) {
    if (!activeRound) {
      return (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-[#64748B]">
          Sin ronda
        </span>
      );
    }

    const result = resultByCompetitorId.get(competitorId);
    const count = result?.completed_count ?? 0;

    if (count === 0) {
      return (
        <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 font-mono text-xs text-[#64748B]">
          0/5
        </span>
      );
    }

    if (count < 5) {
      return (
        <span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-xs font-semibold text-[#F59E0B]">
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
            ? "bg-red-50 text-[#EF4444]"
            : "bg-emerald-50 text-[#10B981]"
        }`}
      >
        Ao5 {avgText}
      </span>
    );
  }

  // Configuración de las acciones del modal según el contexto
  const modalActions: ModalAction[] = useMemo(() => {
    if (!targetForDeletion) return [];

    if (activeRound) {
      return [
        {
          label: "Cancelar",
          variant: "secondary",
          onClick: () => setTargetForDeletion(null),
          disabled: isDeleting,
        },
        {
          label: `Quitar de ${activeRound.name}`,
          variant: "primary",
          onClick: () => handleRemoveFromActiveRound(targetForDeletion),
          disabled: isDeleting,
        },
        {
          label: "Eliminar de todo el torneo",
          variant: "danger",
          onClick: () => handleDeleteFromTournament(targetForDeletion),
          disabled: isDeleting,
        },
      ];
    }

    return [
      {
        label: "Cancelar",
        variant: "secondary",
        onClick: () => setTargetForDeletion(null),
        disabled: isDeleting,
      },
      {
        label: "Eliminar del torneo",
        variant: "danger",
        onClick: () => handleDeleteFromTournament(targetForDeletion),
        disabled: isDeleting,
      },
    ];
  }, [targetForDeletion, activeRound, isDeleting]);

  return (
    <>
      <section className="flex flex-col rounded-2xl border border-[#CBD5E1] bg-white shadow-sm">
        <div className="border-b border-[#CBD5E1] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A]">
              Competidores ({competitors.length})
            </h2>
          </div>

          <form onSubmit={handleAddCompetitor} className="mt-3 space-y-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_1fr]">
              <div>
                <label
                  htmlFor="competitor-bib"
                  className="block text-xs font-semibold text-[#64748B]"
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
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 font-mono text-sm text-[#0F172A] focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="competitor-name"
                  className="block text-xs font-semibold text-[#64748B]"
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
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-sm text-[#0F172A] placeholder:text-[#64748B]/60 focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor="competitor-club"
                  className="block text-xs font-semibold text-[#64748B]"
                >
                  Club
                </label>
                <input
                  id="competitor-club"
                  type="text"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  placeholder="Ej. Orion Speedcubing"
                  className="mt-1 block w-full rounded-xl border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-sm text-[#0F172A] placeholder:text-[#64748B]/60 focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {submitting ? "Agregando..." : "Registrar"}
              </button>
            </div>

            {errorMessage && (
              <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-[#EF4444]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </form>
        </div>

        <div className="border-b border-[#CBD5E1] px-4 py-2.5 bg-[#F8FAFC]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por #bib, nombre o club..."
              className="block w-full rounded-xl border border-[#CBD5E1] bg-white py-1.5 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#64748B]/60 focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto divide-y divide-[#CBD5E1]/60">
          {filteredCompetitors.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#64748B]">
              {competitors.length === 0
                ? "Aún no hay competidores registrados."
                : "No hay coincidencias con la búsqueda."}
            </div>
          ) : (
            filteredCompetitors.map((competitor) => {
              const isSelected = competitor.id === selectedCompetitorId;

              return (
                <div
                  key={competitor.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 transition-colors ${
                    isSelected ? "bg-amber-500/10 border-l-4 border-l-[#F59E0B]" : "hover:bg-[#F8FAFC]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCompetitor(competitor)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-2 py-1 text-left focus:outline-none focus:ring-2 focus:ring-[#0F172A]/20"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`inline-flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg px-1.5 font-mono text-xs font-bold ${
                          isSelected
                            ? "bg-[#0F172A] text-white"
                            : "bg-[#F1F5F9] text-[#0F172A]"
                        }`}
                      >
                        #{competitor.bib_number}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0F172A]">
                          {competitor.full_name}
                        </p>
                        {competitor.club && (
                          <p className="text-xs text-[#64748B] font-medium">
                            {competitor.club}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {renderProgressBadge(competitor.id)}
                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          isSelected
                            ? "bg-[#0F172A] text-white"
                            : "border border-[#CBD5E1] bg-white text-[#64748B]"
                        }`}
                      >
                        {isSelected ? "En mesa" : "Capturar"}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetForDeletion(competitor)}
                    title="Opciones de eliminación"
                    aria-label={`Eliminar a ${competitor.full_name}`}
                    className="shrink-0 rounded-xl p-2 text-[#64748B] transition-colors hover:bg-red-50 hover:text-[#EF4444] focus:outline-none"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Modal estético con backdrop-blur-sm */}
      <ConfirmModal
        isOpen={targetForDeletion !== null}
        title={activeRound ? "Gestionar competidor en ronda" : "Eliminar competidor"}
        description={
          targetForDeletion ? (
            <div className="space-y-2">
              <p>
                Selecciona la acción para{" "}
                <strong className="text-[#0F172A]">
                  {targetForDeletion.full_name} (#{targetForDeletion.bib_number})
                </strong>
                :
              </p>
              {activeRound ? (
                <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-3 text-xs text-[#64748B] space-y-1.5">
                  <p>
                    • <strong className="text-[#0F172A]">Quitar de {activeRound.name}:</strong> Borra sus tiempos únicamente en esta ronda. Sus resultados en otras rondas (ej. 3x3) se mantendrán a salvo.
                  </p>
                  <p>
                    • <strong className="text-[#EF4444]">Eliminar del torneo:</strong> Borra al competidor de la base de datos y todos sus tiempos en todas las rondas.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#64748B]">
                  Esta acción eliminará al competidor y todos sus registros del torneo de forma permanente.
                </p>
              )}
            </div>
          ) : null
        }
        icon="warning"
        actions={modalActions}
        onClose={() => setTargetForDeletion(null)}
      />
    </>
  );
}
