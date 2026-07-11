# QA — Rediseño "Un paso a la vez" (rama `rediseno-frontend-v2`)

**Dónde probar:** el preview de Vercel de la rama `rediseno-frontend-v2` (Deployments → rama), ruta **`/nuevo`**. NO afecta producción (`main`).

**Notas de entorno:**
- **Modo voz**: dictado por voz requiere **Chrome o Edge** + permiso de **micrófono**. La lectura (voz que habla) funciona en casi todos.
- **Asistente IA**: solo se activa si está configurada `AI_API_KEY` en Vercel; si no, debe mostrar un aviso amable y NO romper nada.
- Para probar envío de enlaces (F3.1) hay que **iniciar sesión**.

Marca cada caso: ✅ pasa / ❌ falla (con captura y pasos).

---

## 1. Home (`/nuevo`)
- [ ] Al recargar, el **saludo** y la **frase** cambian; las **frases rotan** solas.
- [ ] Las **tarjetas cambian de color** en cada recarga.
- [ ] "Crear un contrato" entra al flujo; "Gestionar mis contratos" va a `/nuevo/contratos`.
- [ ] El logo/inicio vuelve a `/`.

## 2. Validación por paso (lo más importante — NO debe dejar avanzar con datos malos)
- [ ] **Nombre**: vacío → error; con números ("Juan123") → error; válido → avanza.
- [ ] **Documento**: sin número → error; letras en CC → error; CC muy corto → error; **NIT** con dígito de verificación incorrecto → error; válido → avanza.
- [ ] **Contacto**: teléfono con menos de 10 dígitos → error; correo inválido → error; válidos → avanza.
- [ ] **Inmueble**: dirección vacía → error; ciudad con números → error.
- [ ] **Canon**: 0 o texto → error; número positivo → avanza.
- [ ] **Inquilino**: nombre inválido → error.
- [ ] **Codeudor**: sin elegir → error; "Sí" sin nombre → error; "No" → avanza.
- [ ] **Documentos**: sin elegir método → error.
- [ ] **No se puede finalizar un contrato en blanco** ni saltar pasos.
- [ ] El error se muestra debajo del campo y desaparece al corregir.

## 3. Progreso y escena "camino a casa"
- [ ] La **barra de progreso** avanza; al terminar lo básico llega a ~50%; al final 100%.
- [ ] El **personaje** avanza hacia la casa en cada paso y **entra** al 100% (se enciende la ventana).
- [ ] El personaje **cambia** entre escenas (persona, pareja, familia, mascota, silla de ruedas, bastón) y **todos miran hacia la casa** (ninguno de espaldas).
- [ ] Los **mensajes** de la escena cambian con el avance.

## 4. Documentos del inquilino (F3.1)
- [ ] "Los subo yo" → permite continuar.
- [ ] **WhatsApp**: con celular válido, "Enviar por WhatsApp" **abre WhatsApp** con un mensaje que incluye un **enlace** `…/invitacion/…`.
- [ ] **Correo**: con correo válido, "Enviar por correo" confirma envío (revisar bandeja del inquilino).
- [ ] **Sin sesión iniciada** → pide iniciar sesión (no genera enlace).
- [ ] El enlace abre `/invitacion/{token}` y deja al inquilino completar sus datos.

## 5. Persistencia y continuidad
- [ ] Al terminar, "Continuar en el asistente" abre el flujo actual con los datos **ya pre-llenados** (dueño, inmueble, inquilino, codeudor).
- [ ] Los datos ingresados por la vista nueva son los mismos que ve el asistente actual.

## 6. Gestionar mis contratos (`/nuevo/contratos`)
- [ ] Lista los contratos con **dirección**, dueño/inquilino, fecha y **estado** ("En progreso" / "Listo para generar").
- [ ] "Continuar" y "Vista previa" abren el expediente correcto.
- [ ] Sin contratos → **estado vacío** con botón para crear el primero.

## 7. Modo voz / accesibilidad (Chrome/Edge + micrófono)
- [ ] Aparece el botón **"Modo voz"**; al activarlo, **lee** la pregunta en voz alta.
- [ ] Responder por voz **llena el campo**; decir **"continuar"** avanza, **"atrás"** retrocede, **"repetir"** repite.
- [ ] En opciones (tipo de documento, codeudor, método de documentos) se **selecciona por voz**.
- [ ] Si el dato es inválido, **lo dice por voz y NO avanza**.
- [ ] Con lector de pantalla: se **anuncia** la pregunta y los errores (región aria-live).
- [ ] Navegación por **teclado** (Tab/Enter) funciona en todo el flujo.

## 8. Asistente IA (solo si `AI_API_KEY` está configurada)
- [ ] "Pre-llenar con IA": al describir el caso, **pre-llena** los campos; el usuario **revisa** y la **validación sigue activa**.
- [ ] "¿Dudas de este paso? Pregúntame": responde en lenguaje simple (y lo lee en voz si el modo voz está activo).
- [ ] **Sin** API key: muestra aviso de "no configurado" y el flujo sigue usable.

## 9. Responsive / móvil
- [ ] En móvil, las tarjetas y el flujo se ven bien (una columna), sin desbordes horizontales.
- [ ] Botones y campos son cómodos al tacto.

## 10. Regresión (producción intacta)
- [ ] `main`/producción (arriendoseguro.app) sigue igual (esto es solo una rama).
- [ ] El asistente actual sigue funcionando con contratos creados por la vista nueva.

---

**Cómo reportar:** por cada ❌, indicar ruta, navegador/dispositivo, pasos para reproducir, lo esperado vs lo obtenido, y captura. Priorizar los hallazgos de la **sección 2 (validación)** y **4 (documentos)**.
