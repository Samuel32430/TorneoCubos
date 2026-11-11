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
      <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
        <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">
                Configuración de Supabase requerida
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Para habilitar el inicio de sesión de jueces, crea el archivo{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                  .env.local
                </code>{" "}
                en la raíz del proyecto con las variables:
              </p>
              <pre className="mt-3 rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100 overflow-x-auto">
                {`NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
              </pre>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al marcador en vivo
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <p className="text-sm text-slate-500">Verificando sesión...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-slate-50">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Acceso de Jueces
            </h1>
            <p className="text-sm text-slate-500">
              Panel privado de captura y administración
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Iniciando sesión..." : "Ingresar al panel"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al marcador en vivo
          </Link>
        </div>
      </div>
    </main>
  );
}
