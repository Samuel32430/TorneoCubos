"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Lock } from "lucide-react";
import { getSupabaseBrowserClient, hasSupabaseEnv } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const envConfigured = hasSupabaseEnv();

  const [checkingSession, setCheckingSession] = useState(envConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!envConfigured) return;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        router.replace("/admin");
      } else {
        setCheckingSession(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/admin");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [envConfigured, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setErrorMessage(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      const friendlyMessage = error.message
        .toLowerCase()
        .includes("invalid login credentials")
        ? "Correo o contraseña incorrectos."
        : error.message;
      setErrorMessage(friendlyMessage);
      setSubmitting(false);
      return;
    }

    router.replace("/admin");
  }

  if (!envConfigured) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F1F5F9]">
        <div className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">
                Configuración requerida
              </h1>
              <p className="mt-2 text-sm text-[#64748B]">
                Para habilitar el panel de jueces, configura las variables en tu archivo{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                  .env.local
                </code>
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#CBD5E1]">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al marcador
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-[#F1F5F9]">
        <p className="text-sm font-medium text-[#64748B]">Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#F1F5F9]">
      <div className="w-full max-w-md rounded-2xl border border-[#CBD5E1] bg-white p-6 sm:p-8 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F172A] text-[#FACC15] shadow-xs">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">
              Panel de Jueces
            </h1>
            <p className="text-xs text-[#64748B]">
              Ingresa con tu correo y contraseña para acceder al panel de jueces.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]"
            >
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juez@torneo.com"
              className="mt-1.5 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#F59E0B] focus:outline-none focus:ring-1 focus:ring-[#F59E0B]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[#64748B]"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 block w-full rounded-xl border border-[#CBD5E1] bg-white px-3.5 py-2 text-sm text-[#0F172A] placeholder:text-slate-400 focus:border-[#F59E0B] focus:outline-none focus:ring-1 focus:ring-[#F59E0B]"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#EF4444]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1E293B] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-sm"
          >
            {submitting ? "Iniciando sesión..." : "Ingresar al panel"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#CBD5E1] text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0F172A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al marcador en vivo
          </Link>
        </div>
      </div>
    </main>
  );
}
