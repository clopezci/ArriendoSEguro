# Activar “Visitas (GA4)” en el reporte de Telegram

El reporte de Telegram ya trae el embudo (encuestas → contratos → firmas → compras)
con datos de nuestra base. Para que además muestre las **visitas** (cuánta gente
entra a la app), hay que conectar la **GA4 Data API**. Aquí están los 3 pasos.

## ¿Tiene costo?
**No.** Google Analytics 4 es gratis y la GA4 Data API también (cuotas amplias).
El reporte hace 1 consulta al día: nunca se acerca a ningún límite. No se crea ni
se paga nada nuevo — reutilizamos la cuenta de servicio de Firebase que ya existe.

Datos del proyecto (para referencia):
- Proyecto Firebase/GCP: `arriendoseguro-c5602`
- Email de la cuenta de servicio: tiene la forma
  `firebase-adminsdk-XXXXX@arriendoseguro-c5602.iam.gserviceaccount.com`
  (el valor exacto lo copias en el Paso 2).

---

## Paso 1 — Copiar el “ID de propiedad” de GA4 (número)
Ojo: NO es el `G-XXXXXXX` (ese es el ID de *medición*). Es un número tipo `123456789`.

1. Entra a **https://analytics.google.com**.
2. Abajo a la izquierda, clic en el engranaje **Administrar** (Admin).
3. En la columna **Propiedad**, clic en **Configuración de la propiedad**
   (Property settings).
4. Arriba a la derecha verás **ID DE LA PROPIEDAD** con un número. **Cópialo.**

## Paso 2 — Dar acceso de “Lector” a la cuenta de servicio en GA4
Primero consigue el email exacto de la cuenta de servicio:
1. Ve a **https://console.firebase.google.com** → proyecto **arriendoseguro-c5602**.
2. Engranaje ⚙️ (arriba izq.) → **Configuración del proyecto** → pestaña
   **Cuentas de servicio**. Ahí aparece el email
   `firebase-adminsdk-…@arriendoseguro-c5602.iam.gserviceaccount.com`. **Cópialo.**

Ahora dale acceso en GA4:
3. Vuelve a **Analytics → Administrar** (engranaje abajo izq.).
4. En la columna **Propiedad**, clic en **Gestión de accesos a la propiedad**
   (Property Access Management).
5. Botón **+** (arriba derecha) → **Agregar usuarios**.
6. Pega el email de la cuenta de servicio.
7. **Desmarca** “Notificar por correo a los usuarios nuevos” (una cuenta de
   servicio no recibe correos).
8. Rol: **Lector** (Viewer). Clic en **Agregar**.

## Paso 3 — Configurar la variable en Vercel y redesplegar
1. Entra a **https://vercel.com** → tu proyecto de ArriendoSeguro.
2. **Settings → Environment Variables**.
3. **Add New**:
   - Name: `GA4_PROPERTY_ID`
   - Value: el número que copiaste en el Paso 1
   - Environments: marca **Production** (y Preview si quieres probar en ramas).
4. **Save**.
5. Redesplega: **Deployments** → en el último, menú **⋯ → Redeploy**
   (o simplemente haz un push).

---

## Cómo comprobar que quedó
En la app, entra a **/admin** (con tu cuenta de admin interno) y usa el botón que
**corre el reporte** (“Auditoría / Enviar reporte”). En el texto que aparece en
pantalla verás el bloque:

```
👣 Visitas (GA4)
Usuarios hoy: … · ayer: … · 7 días: …
Sesiones 7d: … · vistas de página 7d: …
```

Si en cambio ves *“Visitas (GA4): consúltalas en Google Analytics…”*, es que aún
falta alguno de los pasos (el ID, el acceso de Lector, o el redeploy). El resto
del reporte funciona igual; esto solo afecta la línea de visitas.

## Notas
- Puede tardar unos minutos tras dar el acceso en GA4 hasta que la API responda.
- La cuenta de servicio queda con permiso de **solo lectura** en GA4: no puede
  cambiar nada, solo leer métricas para el reporte.
- Todo esto es opcional: si no lo activas, el reporte sigue llegando con el embudo
  y los errores; solo no traerá el número de visitas.
