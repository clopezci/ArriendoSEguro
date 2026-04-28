# ArriendoSeguro (web)

Proyecto web en **Next.js 15 (App Router) + TypeScript + Tailwind**. Objetivo: formalizar arriendos de vivienda **ya acordados** entre personas en Colombia, con trazabilidad, validaciones de negocio y preparación de Firebase/Vercel (fase inicial).

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
- Añade `FIREBASE_SERVICE_ACCOUNT_KEY`, `NEXT_PUBLIC_APP_URL` y las variables `NEXT_PUBLIC_FIREBASE_*` (misma app web que en local) en *Environment Variables*.

## Autenticación (Firebase, cliente)

1. En Firebase Console, activa el proveedor **Correo/contraseña** (Authentication).
2. En *Configuración del proyecto* → *Tus apps* → app Web, copia los campos y define en `web/.env.local` (y en Vercel) las seis variables `NEXT_PUBLIC_FIREBASE_*` de `.env.example`.
3. Tras el login, el usuario accede a `/panel` (expediente, inventario y pagos en el orden de producto). Sin estas variables, verás un aviso y no se podrá iniciar sesión en el cliente.

## Firebase (Firestore, colección `lead_forms`)

1. Crea o usa el proyecto (por ejemplo [Firebase Console](https://console.firebase.google.com/) — proyecto `arriendoseguro-c5602` si usas el mismo).
2. Genera una clave de **cuenta de servicio** (JSON) y pégala en `FIREBASE_SERVICE_ACCOUNT_KEY` como un solo string JSON.
3. Crea reglas mínimas para `lead_forms` (producción: restringe por clave o Cloud Functions; el uso del Admin SDK en servidor no depende de reglas de cliente para ese guardado).

Sin credenciales, `POST /api/leads` responde `stored: false` y no persiste, útil en local.

## Cumplimiento y alcance

Las funciones de `src/lib/domain/rent-law.ts` son criterio de producto/ingeniería; el texto legal, contratos y textos hacia usuarios requieren revisión profesional cuando corresponda. Esta herramienta no constituye asesoría jurídica.
