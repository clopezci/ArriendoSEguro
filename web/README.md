# ArriendoSeguro (web)

MVP en **Next.js 15 (App Router) + TypeScript + Tailwind**. Objetivo: formalizar arriendos de vivienda **ya acordados** entre particulares en Colombia, con trazabilidad, validaciones de negocio y preparación de Firabase/Vercel.

## Desarrollo

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Pruebas (reglas de negocio legales reutilizables)

```bash
npm test
```

## Vercel

- **Root directory:** `web` (el código vive en esta subcarpeta; el repositorio puede incluir documentos u otros en la raíz).
- Añade `FIREBASE_SERVICE_ACCOUNT_KEY` y `NEXT_PUBLIC_APP_URL` en *Environment Variables*.

## Firebase (Firestore, colección `lead_forms`)

1. Crea o usa el proyecto (por ejemplo [Firebase Console](https://console.firebase.google.com/) — proyecto `arriendoseguro-c5602` si usas el mismo).
2. Genera una clave de **cuenta de servicio** (JSON) y pégala en `FIREBASE_SERVICE_ACCOUNT_KEY` como un solo string JSON.
3. Crea reglas mínimas para `lead_forms` (producción: restringe por clave o Cloud Functions; el MVP con Admin SDK en servidor no depende de reglas de cliente).

Sin credenciales, `POST /api/leads` responde `stored: false` y no persiste, útil en local.

## Cumplimiento y alcance

Las funciones de `src/lib/domain/rent-law.ts` son criterio de producto/ingeniería; el texto legal, contratos y textos hacia usuarios requieren revisión por abogado. El MVP no constituye asesoría jurídica.
