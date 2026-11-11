# Torneo Cubo — Marcador Oficial WCA en Vivo

Aplicación web con **Next.js + Tailwind CSS + Supabase (PostgreSQL + Realtime)** para gestionar torneos de cubo Rubik con cálculo oficial **Ao5** (5 resoluciones, descarte de mejor y peor intento, `+2`, `DNF`, `DNS`) y actualización en vivo para espectadores y proyector.

## Rutas principales

- `/` — Marcador público en vivo (actualización instantánea vía Supabase Realtime).
- `/tv` — Modo proyector / TV de alto contraste.
- `/login` — Inicio de sesión para jueces/organizadores.
- `/admin` — Panel privado para crear torneo/rondas (inicia en `3x3x3 Cube` y permite añadir más categorías), inscribir competidores y capturar las 5 resoluciones manualmente.

## Configuración local

1. Instala dependencias:
   ```bash
   npm install
   ```

2. Crea un proyecto en [Supabase](https://supabase.com), abre **SQL Editor** y ejecuta:
   - `supabase/schema.sql` (obligatorio: crea tablas, políticas RLS y habilita Realtime).
   - `supabase/seed.sql` (opcional: datos de prueba para `3x3x3 Cube`).

3. En **Authentication → Providers / Sign Up** de Supabase:
   - Desactiva *Allow new users to sign up* para que nadie externo cree cuentas.
   - Crea manualmente el usuario de juez/organizador en **Authentication → Users**.

4. Copia `.env.example` a `.env.local` con tus credenciales de **Project Settings → API**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-public-key
   ```

5. Inicia en desarrollo:
   ```bash
   npm run dev
   ```

## Pruebas y compilación

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
```

## Despliegue en Vercel

1. Sube el repositorio a GitHub en la rama `main`.
2. Importa el proyecto en [Vercel](https://vercel.com).
3. Agrega las variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Despliega. Cada `push` a `main` actualizará la app automáticamente.
