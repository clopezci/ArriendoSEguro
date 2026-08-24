# Iniciar sesión con Facebook — paso a paso

El código ya está listo (mismo patrón server-side que Google: el navegador solo
navega a Facebook y el backend crea la sesión). Solo faltan **dos cosas manuales**:
crear la app en Meta y poner dos variables en Vercel.

Costo: **gratis** (Facebook Login no tiene costo).

Dato del proyecto: dominio de producción **https://arriendoseguro.app**
(usa el tuyo si es distinto).

---

## Paso 1 — Crear la app en Meta for Developers
1. Entra a **https://developers.facebook.com/** e inicia sesión con tu Facebook.
2. Si es tu primera vez: **Comenzar** / **Get Started** y acepta las condiciones
   de desarrollador (verificación por correo o teléfono).
3. Arriba a la derecha: **Mis apps** → **Crear app**.
4. Caso de uso: elige **Autenticar y solicitar datos de usuarios con Facebook
   Login** (o "Consumer"/"Consumidor" según la versión) → **Siguiente**.
5. Ponle nombre (p. ej. *ArriendoSeguro*) y un correo de contacto → **Crear app**
   (te pedirá tu contraseña de Facebook).

## Paso 2 — (Interfaz NUEVA por “Casos de uso”)
La interfaz actual de Meta ya NO tiene “Agregar productos → Facebook Login”. Se
configura dentro del **caso de uso** que ya creaste (*"Autenticar y solicitar
datos a usuarios con el inicio de sesión con Facebook"*).

1. Menú izquierdo → **Casos de uso**.
2. En la tarjeta *"Autenticar y solicitar datos…"* → **Personalizar** / **Editar**.
3. Aparece un submenú con **Permisos** y **Configuración**:
   - **Permisos**: ten **`public_profile`** y agrega **`email`** (*Agregar*). Con
     acceso estándar basta; no requiere App Review.

## Paso 3 — Configurar el Redirect URI válido (clave)
1. Dentro del caso de uso (Paso 2), entra a **Configuración** (Settings).
2. En **URI de redireccionamiento de OAuth válidos** / *Valid OAuth Redirect
   URIs*, pega **exactamente**:
   ```
   https://arriendoseguro.app/api/auth/facebook/callback
   ```
   Si vas a probar en preview de Vercel, agrega también esa URL de preview con el
   mismo path `/api/auth/facebook/callback`.
3. Deja activados **“Login de OAuth de cliente”** y **“Login de OAuth web”**.
4. **Guardar cambios**.

> Nota: en versiones más viejas esto estaba en “Facebook Login → Configuración”.
> Si ves esa opción en el menú, sirve igual; es el mismo campo.

## Paso 4 — Copiar App ID y App Secret
1. Menú izquierdo: **Configuración → Básica** (Settings → Basic).
2. Copia el **Identificador de la app (App ID)** y el **Clave secreta (App
   Secret)** (haz clic en **Mostrar**; te pedirá la contraseña).

## Paso 5 — Poner las variables en Vercel
1. Entra a **https://vercel.com** → tu proyecto → **Settings → Environment
   Variables**.
2. Agrega estas dos (entorno **Production**, y **Preview** si vas a probar en
   ramas):
   - `FACEBOOK_OAUTH_CLIENT_ID` = el **App ID** del Paso 4
   - `FACEBOOK_OAUTH_CLIENT_SECRET` = el **App Secret** del Paso 4
3. **Save** y **redeploy** (Deployments → ⋯ → Redeploy, o un push).

## Paso 6 — Poner la app en modo “En vivo” (Live)
Mientras la app esté **“Sin publicar”**, solo pueden entrar las cuentas que
agregues en **Roles de la app → Roles / Usuarios de prueba**. Para el público:
1. Menú izquierdo → **Publicar** (o el interruptor Desarrollo→En vivo) y sigue los
   pasos.
2. Meta pedirá una **Política de privacidad**: usa
   `https://arriendoseguro.app/legal/privacidad`.
3. El permiso **`email`** y **`public_profile`** son de acceso estándar: NO
   requieren App Review para funcionar. (Si Meta lo pide para “advanced access”,
   con el acceso estándar basta para el correo del propio usuario.)

---

## Cómo probar
1. Ve a **https://arriendoseguro.app/ingresar**.
2. Verás el botón azul **“Continuar con Facebook”**.
3. Al tocarlo: te lleva a Facebook, aceptas, y vuelves ya logueado a la app.

## Si algo falla (diagnóstico)
El sistema vuelve a `/ingresar` con un parámetro `?facebookError=<motivo>` en la
URL. Motivos típicos:
- `not_configured` → faltan las variables en Vercel (o no redeployaste).
- `token_exchange_...` → el **App Secret** o el **App ID** no coinciden, o el
  **Redirect URI** de Meta no es EXACTO (`/api/auth/facebook/callback`).
- `no_email` → esa cuenta de Facebook no compartió correo. El usuario puede
  entrar con Google o con correo/contraseña.
- `state_mismatch` → cookie perdida (reintenta; suele ser por volver atrás).

## Notas
- Es el **mismo mecanismo** que Google: si un usuario ya tenía cuenta con ese
  correo (por Google o por email/clave), Facebook **se enlaza al mismo usuario**
  (no crea duplicado).
- No hace falta tocar Firebase para esto (no usamos el proveedor de Firebase, sino
  OAuth propio). Solo Meta + Vercel.
