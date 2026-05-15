# Checklist operación: Firebase, Vercel y plantilla 2026.2

Guía en español para lo implementado en código y lo que debes configurar **fuera** del repositorio (consola Firebase, Vercel, DNS, certificados).

**Archivo de instrucciones (este documento):** `web/docs/checklist-firebase-vercel-operacion.md` — ábrelo desde la carpeta `web` del repo en tu editor o en GitHub.

---

## 1. Plantilla `AS-LEASE-2026.2` (Bloque 11)

1. **Validación legal:** no pongas `true` en producción hasta que el abogado confirme el texto de `web/src/domain/contracts/v2026-2/`.
2. En **Vercel** (o `.env.local`): añade  
   `NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED=true`
3. **Redeploy** del proyecto `web/` para que el valor se inyecte en el bundle del cliente (los borradores nuevos tomarán `AS-LEASE-2026.2` vía `getDefaultLeaseContractVersion()`).
4. **Comprobar:** crea un expediente nuevo, abre vista previa y verifica que el HTML corresponde a la plantilla 2026.2 (cláusulas especiales / notaría si aplica).
5. Expedientes **ya guardados** en Firestore siguen usando el `contractVersion` persistido en `contract_versions.contractPayload`; no se reescriben solos.

Si el flag está en `false` y alguien envía `contractVersion: AS-LEASE-2026.2` al API de preview, el servidor responde **422** con mensaje claro.

---

## 2. Subcolección `contracts/{contractId}/novedades` (Bloque 10)

- **Escrituras y lecturas actuales:** las rutas `POST /api/contracts/novedades`, `GET .../list` y `GET .../attachment` usan **Firebase Admin** en el servidor (`runtime: "nodejs"`). No dependen de reglas de seguridad del cliente para escribir.
- **Si más adelante** permites lectura/escritura desde el **SDK web** (Firestore cliente), debes abrir reglas con cuidado, por ejemplo:
  - Solo usuarios autenticados.
  - Que el correo del `request.auth.token.email` coincida con arrendador, arrendatario o codeudor del `contract_versions` actual del contrato (la lógica debe replicar `resolveEmailRoleInContract` en reglas o usar **Custom Claims**).

Ejemplo **orientativo** (debes ajustarlo a tu modelo de datos y probarlo en el simulador de reglas de Firebase):

```text
match /contracts/{contractId}/novedades/{novedadId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```

Recomendación del producto: **mantener `write: if false`** y seguir usando solo APIs con Admin SDK hasta que haya un caso de uso claro para el cliente directo.

---

## 3. Firebase Storage y soportes del codeudor (Bloque 12)

1. **Consola Firebase** → tu proyecto → **Storage** → *Get started* → crea el bucket por defecto si no existe.
2. Anota el **nombre del bucket** (ej. `tu-proyecto.appspot.com`).
3. En **Vercel** / `.env.local**:  
   `FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com`  
   (y las variables de credenciales Admin que ya uses para Firestore).
4. Endpoints de soportes del codeudor (Bloque 12, ya en código):  
   `POST /api/codebtor-supports/upload-url`, `POST .../confirm`, `GET .../list`, `GET .../download-url`, `POST .../delete`; UI en `/dashboard/contracts/[id]/soportes-codeudor`; ZIP de evidencia incluye la carpeta `soportes-codeudor/`.
5. **Pendiente fuera de código:** reglas `storage.rules` de producción alineadas al plan (sin lectura pública; escritura acotada si subes desde cliente).

**`storage.rules` (orientación):** el plan pide que solo el arrendador suba, que las partes puedan leer y que no haya lectura pública. Las firmas v4 generadas por Admin cumplen acceso temporal; las reglas del bucket deben denegar `read` público y acotar `write` si algún día subes desde el cliente con token de Storage.

---

## 4. Qué es `npm run build`, HTTPS saliente y el error de fuentes (paso a paso)

### 4.1. Qué estás haciendo cuando corres `npm run build`

1. Abre **PowerShell** o **Terminal** en tu PC.
2. Ve a la carpeta del proyecto web (la que contiene `package.json` de Next):  
   `cd` hasta `...\ArriendoSeguro\web`
3. Ejecuta: `npm run build`
4. **Qué hace ese comando:** Next.js genera la **versión de producción** del sitio (optimizada). Es el mismo tipo de comprobación que debe pasar en Vercel antes de publicar. Si aquí falla, conviene corregirlo antes de desplegar.

### 4.2. Qué es “HTTPS saliente” (en palabras sencillas)

- **HTTPS** es la conexión cifrada entre tu computador e **internet** (por ejemplo a Google o a Vercel).
- **Saliente** significa: **tu PC inicia** la conexión hacia afuera (descargar fuentes, paquetes, etc.).
- Durante el build, Next puede **descargar fuentes** (en este proyecto: **Geist** y **Geist Mono** desde los servidores de Google Fonts). Eso usa HTTPS saliente.
- Si tu red (oficina, antivirus, proxy) **no confía** en el certificado de esa conexión, Windows muestra errores como:  
  `unable to verify the first certificate` o `UNABLE_TO_VERIFY_LEAF_SIGNATURE`  
  **No significa que tu código esté malo**; suele ser **red o certificados del entorno**.

### 4.3. Qué hacer si el build falla por certificados / fuentes

Hazlo en este orden:

1. **Prueba en otra red** (por ejemplo datos móviles del celular como hotspot, o tu casa). Si ahí `npm run build` **sí funciona**, el bloqueo es de la red corporativa o del proxy de la oficina.
2. **Si solo falla en la oficina:** pide a quien administra la red (TI) que permitan salida HTTPS hacia los dominios que usa el build (p. ej. `fonts.googleapis.com` / `fonts.gstatic.com`) o que instalen el **certificado raíz** del proxy corporativo en tu Windows para que las conexiones salientes se validen bien.
3. **Variable `NODE_EXTRA_CA_CERTS` (solo si TI te da un archivo `.pem` del proxy):**  
   - TI te entrega un archivo de certificado en formato PEM (un solo archivo de texto con bloques `-----BEGIN CERTIFICATE-----`).  
   - En PowerShell, **solo para esa ventana**, antes del build:  
     `$env:NODE_EXTRA_CA_CERTS="C:\ruta\que\te\den\corp-root.pem"`  
     luego: `npm run build`  
   - No uses esto a ciegas sin el certificado correcto; mal usado no arregla nada o puede ocultar problemas de seguridad.
4. **Alternativa de desarrollo (si no puedes arreglar la red todavía):** pedir en el proyecto que las fuentes pasen a **locales** (`next/font/local`) en `web/src/app/layout.tsx` para no depender de descargar Geist en cada build. Eso es un **cambio de código** aparte; útil si TI tarda en habilitar salidas.

### 4.4. Después de un arreglo de red o de fuentes

1. Borra la caché de build: en la carpeta `web`, elimina la carpeta `.next` si existe (puedes hacerlo desde el explorador de archivos o con `Remove-Item -Recurse -Force .next` en PowerShell estando dentro de `web`).
2. Vuelve a ejecutar: `npm run build`
3. Si termina sin errores, listo para seguir el checklist de calidad (deploy en Vercel, pruebas, etc.).

---

## 5. PWA

1. Archivos añadidos: `public/manifest.webmanifest`, `public/sw.js`, componente `PwaRegister` en el layout raíz.
2. Tras deploy, en Chrome: **Instalar app** / Lighthouse PWA.
3. Sustituye cuando puedas los íconos del manifest por PNG **192 / 512 maskable** morados AS (hoy se reutiliza `arriendoseguro-social-profile.png`).

---

## 6. Variables de entorno (resumen)

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_LEASE_TEMPLATE_2026_2_ENABLED` | `true` para activar plantilla 2026.2 en nuevos borradores y preview. |
| `FIREBASE_STORAGE_BUCKET` | Bucket para PDFs/anexos/novedades/codeudor (Admin SDK). |
| `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` | Enlaces en correos y PWA. |

---

## 7. Lo que sigue en producto (no automatizado aquí)

- Confirmaciones del **abogado** (roadmap Fase 2).
- **Wompi** webhook en producción, mensajes de bloqueo sin plan.
- **Fase 3** reputación, **Fase 4** marketplace.
- **Rate-limit** explícito en APIs públicas.
- Revisión legal externa del aviso **AVISO-PRIV-2026.2** y del flujo **eliminar cuenta** (ya hay base en código y en `/legal/aviso-privacidad` + `/dashboard/cuenta/eliminar`).
