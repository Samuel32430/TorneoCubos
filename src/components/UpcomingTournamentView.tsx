"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react";
import type { ConnectionStatus } from "@/hooks/useLiveRoundResults";
import type { Competitor, Round, Tournament } from "@/types/tournament";

interface UpcomingTournamentViewProps {
  tournament: Tournament;
  rounds: Round[];
  competitors: Competitor[];
  connectionStatus: ConnectionStatus;
  isDark: boolean;
  toggleTheme: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isStarted: boolean;
}

function calculateTimeLeft(eventDateStr: string): TimeLeft {
  if (!eventDateStr) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: false };
  }

  // Se asume inicio a las 09:00 AM hora local de la fecha del torneo
  const parts = eventDateStr.split("-").map(Number);
  const year = parts[0] || new Date().getFullYear();
  const month = parts[1] || 1;
  const day = parts[2] || 1;

  const targetDate = new Date(year, month - 1, day, 9, 0, 0);
  const diffMs = targetDate.getTime() - Date.now();

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isStarted: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isStarted: false };
}

function formatFullEventDate(dateValue: string): string {
  try {
    const parts = dateValue.split("-").map(Number);
    const year = parts[0] || new Date().getFullYear();
    const month = parts[1] || 1;
    const day = parts[2] || 1;
    const date = new Date(year, month - 1, day);

    const formatted = new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return dateValue;
  }
}

function ConnectionBadge({
  status,
  isDark,
}: {
  status: ConnectionStatus;
  isDark: boolean;
}) {
  if (status === "live") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
          isDark
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        En espera activa
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
          isDark
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-amber-200 bg-amber-50 text-[#B45309]"
        }`}
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
        Conectando
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isDark
          ? "border-slate-700 bg-slate-800/80 text-slate-400"
          : "border-[#CBD5E1] bg-slate-100 text-[#64748B]"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-slate-400" />
      Sin conexión
    </span>
  );
}

export function UpcomingTournamentView({
  tournament,
  rounds,
  competitors,
  connectionStatus,
  isDark,
  toggleTheme,
}: UpcomingTournamentViewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(tournament.event_date)
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(tournament.event_date));
    }, 1000);

    return () => clearInterval(timer);
  }, [tournament.event_date]);

  const filteredCompetitors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return competitors;

    return competitors.filter((c) => {
      const nameMatch = c.full_name.toLowerCase().includes(q);
      const clubMatch = c.club ? c.club.toLowerCase().includes(q) : false;
      return nameMatch || clubMatch;
    });
  }, [competitors, searchQuery]);

  return (
    <main
      className={`min-h-screen transition-colors duration-150 ${
        isDark ? "bg-[#090D16] text-[#F8FAFC]" : "bg-[#F1F5F9] text-[#0F172A]"
      }`}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-6">
        {/* Cabecera oficial */}
        <header
          className={`rounded-2xl border px-5 py-4 shadow-sm transition-colors ${
            isDark
              ? "border-[#1E293B] bg-[#111827]"
              : "border-[#CBD5E1] bg-white"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] p-1.5 shadow-xs ring-1 ring-white/10 overflow-hidden">
                <Image
                  src="/conquis-logo.png"
                  alt="Club Conquistadores"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className={`text-lg font-bold tracking-tight sm:text-xl ${
                      isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"
                    }`}
                  >
                    {tournament.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-[#F59E0B]">
                    <Clock className="h-3 w-3" />
                    Próximamente
                  </span>
                </div>
                <p
                  className={`mt-0.5 text-xs sm:text-sm ${
                    isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                  }`}
                >
                  {formatFullEventDate(tournament.event_date)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5">
              <ConnectionBadge status={connectionStatus} isDark={isDark} />

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
                }
                title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isDark
                    ? "border-[#1E293B] bg-[#090D16] text-[#94A3B8] hover:border-slate-700 hover:text-[#F8FAFC]"
                    : "border-[#CBD5E1] bg-[#F8FAFC] text-[#64748B] hover:border-[#0F172A] hover:text-[#0F172A]"
                }`}
              >
                {isDark ? (
                  <>
                    <Sun className="h-3.5 w-3.5 text-[#FACC15]" />
                    <span>Modo claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-3.5 w-3.5 text-[#0F172A]" />
                    <span>Modo oscuro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Hero Card: Cuenta Regresiva Principal */}
        <section
          aria-labelledby="countdown-heading"
          className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 shadow-lg transition-colors ${
            isDark
              ? "border-[#1E293B] bg-[#111827]"
              : "border-[#CBD5E1] bg-white"
          }`}
        >
          {/* Acento decorativo sutil */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />

          <div className="relative text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-[#F59E0B]">
              <Calendar className="h-3.5 w-3.5" />
              Fecha y Hora Oficial
            </div>

            <h2
              id="countdown-heading"
              className={`mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl ${
                isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"
              }`}
            >
              El torneo comenzará pronto
            </h2>

            <p
              className={`mx-auto mt-1.5 max-w-lg text-sm sm:text-base ${
                isDark ? "text-[#94A3B8]" : "text-[#64748B]"
              }`}
            >
              📅 {formatFullEventDate(tournament.event_date)} · 09:00 AM (Aprox)
            </p>

            {/* Contador de 4 Bloques (Días, Horas, Minutos, Segundos) */}
            <div className="mx-auto mt-6 grid max-w-xl grid-cols-4 gap-2 sm:gap-4">
              {/* DÍAS */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 sm:p-4 shadow-sm transition-colors ${
                  isDark
                    ? "border-[#1E293B] bg-[#090D16]/90"
                    : "border-[#CBD5E1] bg-[#F8FAFC]"
                }`}
              >
                <span className="font-mono text-2xl sm:text-4xl font-extrabold text-[#F59E0B]">
                  {isMounted ? timeLeft.days : "0"}
                </span>
                <span
                  className={`mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                    isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                  }`}
                >
                  Días
                </span>
              </div>

              {/* HORAS */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 sm:p-4 shadow-sm transition-colors ${
                  isDark
                    ? "border-[#1E293B] bg-[#090D16]/90"
                    : "border-[#CBD5E1] bg-[#F8FAFC]"
                }`}
              >
                <span className="font-mono text-2xl sm:text-4xl font-extrabold text-[#F59E0B]">
                  {isMounted ? String(timeLeft.hours).padStart(2, "0") : "00"}
                </span>
                <span
                  className={`mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                    isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                  }`}
                >
                  Horas
                </span>
              </div>

              {/* MINUTOS */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 sm:p-4 shadow-sm transition-colors ${
                  isDark
                    ? "border-[#1E293B] bg-[#090D16]/90"
                    : "border-[#CBD5E1] bg-[#F8FAFC]"
                }`}
              >
                <span className="font-mono text-2xl sm:text-4xl font-extrabold text-[#F59E0B]">
                  {isMounted ? String(timeLeft.minutes).padStart(2, "0") : "00"}
                </span>
                <span
                  className={`mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                    isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                  }`}
                >
                  Minutos
                </span>
              </div>

              {/* SEGUNDOS */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 sm:p-4 shadow-sm transition-colors ${
                  isDark
                    ? "border-[#1E293B] bg-[#090D16]/90"
                    : "border-[#CBD5E1] bg-[#F8FAFC]"
                }`}
              >
                <span className="font-mono text-2xl sm:text-4xl font-extrabold text-[#F59E0B]">
                  {isMounted ? String(timeLeft.seconds).padStart(2, "0") : "00"}
                </span>
                <span
                  className={`mt-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                    isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                  }`}
                >
                  Segundos
                </span>
              </div>
            </div>

            {/* Mensaje de estado en vivo */}
            <div
              className={`mx-auto mt-6 max-w-lg rounded-xl border p-3.5 text-xs sm:text-sm ${
                isDark
                  ? "border-[#1E293B] bg-[#090D16]/60 text-[#94A3B8]"
                  : "border-slate-200 bg-slate-50 text-[#64748B]"
              }`}
            >
              {isMounted && timeLeft.isStarted ? (
                <p className="font-semibold text-emerald-500">
                  ⚡ ¡El torneo está por comenzar en breves momentos! Los jueces están preparando la primera ronda.
                </p>
              ) : (
                <p>
                  El marcador en vivo se activará <strong className={isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"}>automáticamente aquí</strong> en cuanto comience la competencia oficial.
                </p>
              )}
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-emerald-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sincronizado en tiempo real · No necesitas recargar esta página</span>
              </div>
            </div>
          </div>
        </section>

        {/* Categorías programadas */}
        {rounds.length > 0 && (
          <section
            aria-labelledby="categories-heading"
            className={`rounded-2xl border p-5 shadow-sm transition-colors ${
              isDark
                ? "border-[#1E293B] bg-[#111827]"
                : "border-[#CBD5E1] bg-white"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#F59E0B]" />
              <h3
                id="categories-heading"
                className={`text-sm font-bold ${
                  isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"
                }`}
              >
                Categorías y Rondas Programadas ({rounds.length})
              </h3>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {rounds.map((round) => (
                <div
                  key={round.id}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                    isDark
                      ? "border-[#1E293B] bg-[#090D16] text-[#F8FAFC]"
                      : "border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A]"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
                  <span>{round.event_name}</span>
                  <span
                    className={`font-normal ${
                      isDark ? "text-slate-400" : "text-[#64748B]"
                    }`}
                  >
                    · {round.name}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Participantes Inscritos */}
        <section
          aria-labelledby="participants-heading"
          className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-colors ${
            isDark
              ? "border-[#1E293B] bg-[#111827]"
              : "border-[#CBD5E1] bg-white"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-[#F59E0B]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    id="participants-heading"
                    className={`text-base font-bold ${
                      isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"
                    }`}
                  >
                    Participantes Inscritos
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isDark
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {competitors.length} confirmados
                  </span>
                </div>
                <p
                  className={`text-xs ${
                    isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                  }`}
                >
                  Verifica tu nombre en la lista de participantes.
                </p>
              </div>
            </div>

            {/* Buscador de participantes */}
            {competitors.length > 0 && (
              <div className="relative w-full sm:w-64">
                <Search
                  className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${
                    isDark ? "text-slate-500" : "text-[#64748B]"
                  }`}
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mi nombre o club..."
                  className={`w-full rounded-xl border py-1.5 pl-9 pr-3 text-xs sm:text-sm focus:outline-none focus:ring-1 ${
                    isDark
                      ? "border-[#1E293B] bg-[#090D16] text-[#F8FAFC] placeholder:text-[#94A3B8] focus:border-[#F59E0B] focus:ring-[#F59E0B]"
                      : "border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#64748B]/60 focus:border-[#0F172A] focus:ring-[#0F172A]"
                  }`}
                />
              </div>
            )}
          </div>

          {/* Grilla de competidores */}
          <div className="mt-4">
            {competitors.length === 0 ? (
              <div
                className={`rounded-xl border border-dashed p-6 text-center text-xs sm:text-sm ${
                  isDark
                    ? "border-slate-800 text-[#94A3B8]"
                    : "border-slate-300 text-[#64748B]"
                }`}
              >
                Aún no hay competidores registrados en el sistema. Los organizadores añadirán los inscritos en breve.
              </div>
            ) : filteredCompetitors.length === 0 ? (
              <div
                className={`rounded-xl border border-dashed p-6 text-center text-xs sm:text-sm ${
                  isDark
                    ? "border-slate-800 text-[#94A3B8]"
                    : "border-slate-300 text-[#64748B]"
                }`}
              >
                No se encontró ningún participante que coincida con &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCompetitors.map((competitor) => (
                  <div
                    key={competitor.id}
                    className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 shadow-2xs transition-colors ${
                      isDark
                        ? "border-[#1E293B] bg-[#090D16] hover:border-slate-700"
                        : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-slate-300"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p
                        className={`truncate text-sm font-semibold ${
                          isDark ? "text-[#F8FAFC]" : "text-[#0F172A]"
                        }`}
                      >
                        {competitor.full_name}
                      </p>
                      {competitor.club && (
                        <p
                          className={`truncate text-xs ${
                            isDark ? "text-[#94A3B8]" : "text-[#64748B]"
                          }`}
                        >
                          {competitor.club}
                        </p>
                      )}
                    </div>
                    <span
                      title="Participación confirmada"
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isDark
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Inscrito
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Footer con acceso discreto para jueces */}
        <footer className="pt-2 pb-6 text-center">
          <Link
            href="/login"
            className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
              isDark
                ? "text-slate-500 hover:text-slate-300"
                : "text-slate-400 hover:text-[#0F172A]"
            }`}
          >
            ¿Eres juez u organizador? Iniciar sesión en el panel
          </Link>
        </footer>
      </div>
    </main>
  );
}
