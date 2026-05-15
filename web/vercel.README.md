# Configuración Vercel (`web/`)

**Producción:** [https://arriendoseguro.vercel.app/](https://arriendoseguro.vercel.app/)

Este directorio es la raíz del proyecto en Vercel (**Root Directory = `web`**).

- `vercel.json` aquí: solo `framework: nextjs`. **No** añadir `installCommand` / `buildCommand` con `--prefix web`.
- El `vercel.json` en la raíz del repositorio es para proyectos legacy sin Root Directory; ver `web/docs/checklist-firebase-vercel-operacion.md` §0.
