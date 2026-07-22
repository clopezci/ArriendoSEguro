# ArriendoSeguro — Plan de pruebas extremo a extremo (E2E)

Guía de pruebas para validar **usabilidad, accesos, menús, funciones, flujo bento y recorrido completo**
en **PC y celular**. Marca cada casilla `[x]` a medida que pruebas y anota lo que falle usando la
plantilla del final.

- **Producción:** https://arriendoseguro.app
- **Cómo reportar un fallo:** pantalla + paso exacto + qué esperabas + qué pasó + captura + (si hay error)
  DevTools → Console/Network. Ver [plantilla](#plantilla-de-reporte-de-bug).

---

## 0. Preparación

- [ ] **Dispositivos:** 1 PC (Chrome + otro navegador) y 1 celular (iPhone/Safari y Android/Chrome si puedes).
- [ ] **Cuentas de prueba:** al menos 2 correos distintos (uno = *dueño*, otro = *inquilino*). Ten a mano un 3º para *codeudor*.
- [ ] **Sesión limpia:** prueba una vuelta en **ventana de incógnito** (sin extensiones) y otra normal.
- [ ] **Datos de prueba a mano:** nombres completos, cédulas, dirección del inmueble, canon, ingresos, una **foto de documento de propiedad** (recibo de servicios/predial) legible < 5 MB.
- [ ] **Variables activas en Vercel** (para probar todo): `AI_API_KEY` (IA), `BREB_LLAVE` + `NEXT_PUBLIC_BREB_ENABLED` (pago), `TELEGRAM_*` (alertas). Anota cuáles NO están para saber qué se salta.

### Criterio de aprobación por caso
- ✅ **Pasa:** hace lo esperado, sin errores en consola, y se ve bien en móvil y PC.
- ⚠️ **Observación:** funciona pero confunde / se ve mal / texto raro.
- ❌ **Falla:** no hace lo esperado, se rompe, o bloquea el avance.

---

## A. Público / Marketing (sin iniciar sesión)

**Landing `/`**
- [ ] Carga rápido; hero visible; **precio promocional** muestra el valor tachado (mayor) y el de introducción.
- [ ] Textos sin "lorem", sin placeholders, sin "próximamente" de cosas que ya existen.
- [ ] Botones CTA (crear/empezar) llevan al flujo correcto.
- [ ] **Footer:** enlaces legales abren; sello **"Un producto de Lotic"** visible y enlaza a lotic-soluciones.vercel.app.
- [ ] Banner de promo interna se puede **cerrar (✕)** y NO reaparece en login ni en pago.

**Otras páginas públicas**
- [ ] `/entiendelo-facil` — carga; la **encuesta** (selects) funciona; el campo de correo valida; enviar responde OK.
- [ ] `/calculadoras` — cargan y calculan.
- [ ] `/plantillas`, `/blog`, `/estado` — cargan; enlaces internos funcionan.
- [ ] Legales: `/legal/terminos`, `/legal/privacidad`, `/legal/cookies`, `/legal/firma-electronica` — abren y citan leyes reales.
- [ ] **Cookies:** el banner permite rechazar; la preferencia se recuerda.

---

## B. Autenticación y accesos

- [ ] `/ingresar` — **email + contraseña** funciona.
- [ ] **Continuar con Google** entra bien en **PC** y mantiene la sesión (no rebota al home).
- [ ] Google entra bien en **celular**.
- [ ] Tras entrar, vuelve a **donde ibas** (si estabas creando un contrato, lo retoma logueado).
- [ ] `/registro` — crear cuenta nueva funciona.
- [ ] **Cerrar sesión** desde el menú de usuario cierra y redirige a `/ingresar`.
- [ ] `/admin` con una cuenta **NO admin** → muestra solo **"Acceso restringido"** (sin ver el panel).
- [ ] `/admin` con tu cuenta admin → entra y ve las secciones.
- [ ] Rutas privadas sin sesión → redirigen a login (no muestran datos).

---

## C. Menús y navegación (PC y celular)

- [ ] **Menú de usuario** aparece en **TODAS** las páginas estando logueado (crear, gestionar, etc.).
- [ ] En **celular**, el menú de usuario se abre **por encima** del contenido (no detrás/oculto).
- [ ] El menú tiene: ir al panel, mis contratos/arriendos, cerrar sesión.
- [ ] Navegación entre secciones no pierde datos ni rompe el "atrás" del navegador.
- [ ] Los botones **"Atrás" y "Continuar"** están en el orden correcto y hacen lo que dicen.

---

## D. Flujo bento `/nuevo` — "una pregunta a la vez"

- [ ] Filtro inicial de **tipo de trámite** funciona y lleva al camino correcto.
- [ ] Avanza **una pregunta a la vez**; el **progreso** (2 tramos) se actualiza.
- [ ] **Validación:** con un campo vacío o inválido **NO deja avanzar** y muestra el mensaje claro.
- [ ] **Nombre y apellido**, formato de cédula, etc. se validan (no acepta basura).
- [ ] **Ingreso mensual** (inquilino y codeudor) acepta **separador de miles** (puntos) y se ve formateado.
- [ ] **Duración "Otro"** deja escribir el número (ej. empezar en "6") sin bloquearse.
- [ ] **Modo IA "Analizar y llenar"**: pegas un texto, analiza y **llena los campos** (incluida la cláusula si la mencionas).
- [ ] **Voz** (si aplica): dictar llena el campo; en móvil pide permiso de micrófono y funciona.
- [ ] Cierra y vuelve a abrir `/nuevo`: **retoma el borrador** donde ibas (no lo pierde).
- [ ] Al terminar, **"Guardar mi contrato"** avanza (en **iPhone** también); si algo falta, muestra el error visible.

---

## E. Preview del contrato — secciones bento

Ruta: `/dashboard/contracts/[id]/preview`. Verifica que cada sección (Revisar · Documentos · Guardar · Firma · PDF · Posventa) se abre **de a una**.

- [ ] **Revisar:** se ve la vista previa del contrato; si faltan datos, el aviso "Completa esto…" indica qué falta.
- [ ] **Semáforo Ley 820** (termómetro de cumplimiento) aparece y refleja el estado (verde/ámbar/rojo).
- [ ] **Aviso de ingresos** del inquilino/codeudor vs canon aparece cuando corresponde.
- [ ] "Mis Arriendos → Continuar" lleva de verdad al **resumen** del borrador (no rebota).
- [ ] **"Mis Contratos"** muestra el **mismo número** en celular y en PC (misma cuenta).

---

## F. Documentos + validación por IA

- [ ] **Dueño:** subir **documento de propiedad** (foto). Tras subir, el mensaje NO dice "No file chosen".
- [ ] La **validación IA** responde: **verde** (coincide) / **rojo** (no coincide) / o mensaje claro si no es concluyente.
- [ ] Con un documento **que NO coincide** con el nombre/dirección → sale la **alerta roja** y la casilla para "avanzar bajo mi responsabilidad".
- [ ] Si la IA no está disponible, el mensaje lo dice y **NO bloquea** (juramento respalda).
- [ ] **Apoderado:** aparece dónde subir el **poder**; se valida contra el **poderdante**.
- [ ] PDF de documento: si no se puede leer, avisa (no se cuelga).

---

## G. Cláusulas especiales «Otra» + abogado

- [ ] Se explica claro que **cada cláusula «Otra» cuesta $50.000**.
- [ ] El **contador** (− N +) calcula el total: **$50.000 × N**.
- [ ] Mensaje claro: las cláusulas se **revisan por un abogado** y NO aparecen como definitivas hasta confirmarse.
- [ ] La cláusula **entra al carrito/resumen de pago** con su valor.
- [ ] Al **pagar**, se dispara el **correo al abogado** (tu correo configurado).
- [ ] El abogado responde por el **link** → la cláusula final se **incorpora** al contrato.
- [ ] Te llega el correo **"tu cláusula ya está lista"** (o "no procede" si la declina).
- [ ] Si **quitas** la cláusula antes de pagar, NO se envía al abogado y se muestra el aviso.

---

## H. Constancia de alertas y responsabilidad

- [ ] **Dueño:** en el paso de **Firma** aparece el bloque 🛡️ con los puntos de atención (sin documento, no coincide, apoderado sin poder, ingreso < canon), en tono suave.
- [ ] **Inquilino:** en su **link de firma**, antes de las declaraciones, ve **su** bloque (solo lo dirigido a él / ambas partes; no datos internos del dueño).
- [ ] Queda **archivado como anexo** en el expediente.

---

## I. Guardar versión + Firma electrónica

- [ ] **Guardar** deja registrada la versión (sin necesidad de pagar).
- [ ] **Firma del dueño:** solicita/valida **OTP al correo**; acepta declaraciones; firma.
- [ ] **Firma de la contraparte** (`/firma/[token]`): OTP → declaraciones → firma; ve el **hash** y el PDF.
- [ ] Firmas **multi-parte** (dueño + inquilino + codeudor): cada quien firma; el estado avanza.
- [ ] **Fechas** de firma/evidencia se muestran en hora **Colombia (GMT-5)** (no en UTC crudo).
- [ ] Se genera la **evidencia de firma** (anexo).

---

## J. Notaría / autenticación digital (opcional)

- [ ] La sección explica la opción y **NO dice "próximamente"** (ya está la firma digital del Estado).
- [ ] Descarga del paquete/ZIP para notaría funciona.
- [ ] Enlace a **Agencia Nacional Digital** abre; instrucciones paso a paso claras.
- [ ] Subir el **PDF autenticado** queda archivado en el expediente.

---

## K. Pago (Bre-B y cláusulas)

- [ ] Página de pago **limpia**: solo pagar (sin botones de referidos/aliados que distraigan).
- [ ] Texto "incluye…" lista **todo** lo del contrato (no solo la firma).
- [ ] **Bre-B:** botón lleva a la página interna con **QR real** (si lo configuraste) + **llave** + monto exacto.
- [ ] Pago **sin cláusula** → confirmas ("Confirmar pago recibido" como comercio/admin) → **activa el plan**.
- [ ] Pago **con cláusula** → al confirmar, activa plan **y** notifica al abogado.
- [ ] El monto del carrito **coincide** (incluye las cláusulas × valor).
- [ ] En caso de error de pago, mensaje claro (no pantalla en blanco).

---

## L. Posventa / Administra tu arriendo

- [ ] **Inventario:** modo guiado vs bloque; fotos con **preview instantáneo**; acta al inicio; un botón finaliza + genera acta + correo.
- [ ] **Acta de entrega** se genera y archiva.
- [ ] **Pagos:** registrar/confirmar pago avisa a ambas partes; **SMS el día del vencimiento**; copia al dueño en mora.
- [ ] **Mantenimiento:** inquilino reporta → dueño acepta/rechaza → 2º rechazo = disputa (aliado jurídico).
- [ ] **Reputación:** calificar; puntaje pondera lo **reciente**; calificación baja (≤2★) dispara **derecho de réplica** (correo + celular).
- [ ] **Renovación:** recordatorios y flujo de renovar.
- [ ] **Novedades/bitácora** registra eventos.
- [ ] Tarjetas de aliados (cobranza, jurídica, seguro, financiación) aparecen en el contexto correcto y son **cerrables** (no en login/pago).

---

## M. Invitación de la contraparte

- [ ] El dueño invita al **inquilino/codeudor**; llega el enlace.
- [ ] `/invitacion/[token]`: OTP → **llenar datos** (PartyDataFields) → **subir soportes**.
- [ ] Validación de soportes del inquilino/codeudor funciona (IA/estado).
- [ ] El dueño ve reflejados los datos e ingresos declarados.
- [ ] Token vencido/ inválido → mensaje claro (no rompe).

---

## N. Panel de administración (`/admin`, solo tu correo)

- [ ] **Accesos Plus (testers):** ver usuarios con permiso y **revocar**.
- [ ] **Precio Plan Plus:** editar y que se refleje en landing/planes.
- [ ] **Alertas de error:** guardar umbral; **Probar Telegram** llega al chat.
- [ ] **Config legal:** precio cláusula, correos del abogado.
- [ ] **Referidos:** descuento y estado.
- [ ] **Señales antifraude reputación:** se listan.
- [ ] **Publicar incidente** → aparece en `/estado`.

---

## O. Accesibilidad

- [ ] Botón **"Escuchar"** (read-aloud) lee los textos clave (declaraciones de firma, etc.).
- [ ] Navegación por **teclado** (Tab) recorre botones/campos; foco visible (anillo violeta).
- [ ] Formularios: cada campo tiene **etiqueta** asociada (lector de pantalla lo anuncia).
- [ ] Contraste de texto legible; nada ilegible en modo claro.

---

## P. Responsive — Móvil vs PC

Repite los flujos clave en **celular** y **PC**:
- [ ] Nada se sale de la pantalla ni exige scroll horizontal.
- [ ] Botones y campos son **tocables** (tamaño suficiente) en móvil.
- [ ] Menús/paneles/carritos se abren **por encima** del contenido.
- [ ] Subida de fotos funciona desde la **cámara** del celular.
- [ ] Tablas/PDF se ven o se pueden desplazar sin romper el layout.

---

## Q. Manejo de errores y observabilidad

- [ ] Ante un fallo, se muestra un **mensaje claro** (no pantalla en blanco ni error crudo).
- [ ] Errores reales llegan al módulo interno y (si aplica) a **Telegram/correo**; el **ruido de terceros** (anuncios/Facebook) NO satura.
- [ ] Cerrar sesión / expirar token → mensaje entendible, no bucle.

---

## R. Recorrido E2E completo (guion de principio a fin)

Haz **una vuelta completa** con 2 cuentas (dueño + inquilino):

1. [ ] (Incógnito) Entra a `/`, revisa precio y CTAs → empieza un contrato en `/nuevo`.
2. [ ] Completa el flujo bento (datos dueño, inmueble, inquilino, canon, duración, **1 cláusula «Otra»**).
3. [ ] Regístrate/inicia sesión con **Google** a mitad de camino → confirma que retoma el borrador.
4. [ ] En Preview: sube **documento de propiedad** → verifica **validación IA**.
5. [ ] Revisa el **semáforo Ley 820** y el **aviso de ingresos**.
6. [ ] Lee el bloque de **Constancia de alertas** (dueño).
7. [ ] **Guarda la versión** y **paga con Bre-B** (con la cláusula) → confirma pago.
8. [ ] Verifica que sale el **correo al abogado**; responde el link → cláusula final incorporada.
9. [ ] **Invita al inquilino** → con la 2ª cuenta llena datos y sube soportes.
10. [ ] **Firma** dueño e inquilino (OTP) → se genera **PDF + evidencia**.
11. [ ] Entra a **Administra tu arriendo**: inventario, registra un pago, reporta un mantenimiento, califica.
12. [ ] Revisa el **expediente**: contrato, anexos (constancia, evidencia de firma, inventario, etc.).
13. [ ] Repite los pasos 1–4 en **celular** para confirmar paridad.

> Objetivo: que el recorrido completo se pueda hacer **sin cabos sueltos**, con la interfaz simple y clara.

---

## Matriz de dispositivos / navegadores

| Flujo clave            | Chrome PC | Otro nav. PC | iPhone Safari | Android Chrome |
|------------------------|:---------:|:------------:|:-------------:|:--------------:|
| Login (email + Google) |    ☐      |      ☐       |      ☐        |       ☐        |
| Crear contrato `/nuevo`|    ☐      |      ☐       |      ☐        |       ☐        |
| Subir doc + IA         |    ☐      |      ☐       |      ☐        |       ☐        |
| Firma (OTP)            |    ☐      |      ☐       |      ☐        |       ☐        |
| Pago Bre-B             |    ☐      |      ☐       |      ☐        |       ☐        |
| Menú de usuario        |    ☐      |      ☐       |      ☐        |       ☐        |

---

## Plantilla de reporte de bug

```
Título:            (resumen corto)
Severidad:         Bloqueante / Alta / Media / Baja
Dispositivo:       PC Chrome / iPhone Safari / Android Chrome …
Pantalla / ruta:   (ej. /dashboard/contracts/…/preview → sección Firma)
Pasos:             1) …  2) …  3) …
Esperado:          (qué debía pasar)
Resultado:         (qué pasó)
Captura:           (adjunta)
Consola/Network:   (si hay error: mensaje exacto / campo providerDetail, etc.)
```

---

_Última actualización: mantener al día cuando se agreguen módulos._
