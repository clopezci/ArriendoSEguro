"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

/** Lista COMPLETA de lo que hace ArriendoSeguro, por secciones. Se muestra y se
 * puede ESCUCHAR (lectura por voz). Pensado para todo público, incluidos usuarios
 * mayores. Mantener actualizada al agregar funciones. */
const SECTIONS: { title: string; guide: string; items: string[] }[] = [
  {
    title: "Crear tu contrato",
    guide: "Toca «Crear mi contrato» y responde una pregunta a la vez. Si quieres, cuéntale tu caso por voz y la IA llena los datos por ti. Al final invitas al inquilino (y codeudor si aplica) por WhatsApp o correo para que completen lo suyo.",
    items: [
      "Crear un contrato de arrendamiento de vivienda urbana con validez legal (Ley 820 de 2003), paso a paso, una pregunta a la vez.",
      "Pre-llenar el contrato con inteligencia artificial: cuéntale tu caso (incluso por voz) y llena los datos por ti.",
      "Validación automática de los datos: nombre y apellido, documento colombiano, correo y teléfono.",
      "Elegir tipo de inmueble y cantidad de habitaciones y baños.",
      "Calcular el tope legal del canon (1% del valor comercial) y avisarte si se pasa.",
      "Garantía de servicios públicos según la Ley 820 (artículo 15).",
      "Elegir quién ingresa los datos del inquilino y del codeudor: los ingresas tú o le envías un enlace a la persona.",
      "Invitar al inquilino o codeudor por correo o WhatsApp; ellos completan sus datos, suben documentos, aceptan el juramento y la autorización de datos con validación por código.",
      "Agregar cláusulas especiales, incluida una cláusula personalizada revisada por un abogado, y cláusula que prohíbe el uso ilícito del inmueble.",
      "Actuar como dueño o como apoderado (con poder y declaración de facultad).",
    ],
  },
  {
    title: "Validación y documentos",
    guide: "Eliges qué documentos le pides a cada parte; ellos los suben desde su propio enlace, sin instalar nada. La inteligencia artificial revisa que coincidan con los datos y te avisa en rojo si algo no cuadra (sin bloquearte).",
    items: [
      "Validación de documentos con inteligencia artificial (servicios públicos, soporte de propiedad, cédula) con alerta si no coinciden.",
      "Subir el documento que soporta la propiedad del inmueble, con juramento de facultad y responsabilidad.",
      "Subir soportes de ingresos del inquilino y del codeudor (carta laboral, colillas, extractos).",
      "Definir qué documentos exiges a cada parte, como casillas nombradas.",
      "Consultar, con enlaces directos y autorización de la persona, el historial crediticio en DataCrédito (personal) y las deudas con el Estado, para evaluar mejor al inquilino o codeudor.",
    ],
  },
  {
    title: "Firma y generación",
    guide: "Cada persona firma su parte con evidencia (fecha, hora y desde dónde). El dueño firma en su sesión; al inquilino y codeudor les llega un enlace con código. Puedes ver el contrato en pantalla gratis y descargarlo en PDF cuando esté pagado.",
    items: [
      "Firma electrónica simple con validez y evidencia (Ley 527 de 1999).",
      "Opción de notaría digital del Estado (Agencia Nacional Digital).",
      "Captura de evidencia de TODAS las aceptaciones y juramentos durante el contrato —autorización de datos, juramentos de las partes, aceptación del acta de entrega, réplicas y más—, con fecha y hora (GMT-5), quién aceptó y desde dónde, guardada en el expediente.",
      "Vista previa del contrato, generación y descarga del contrato en PDF.",
      "Iniciar el contrato definitivo: lo deja en firme y bloqueado.",
    ],
  },
  {
    title: "Entrega e inventario",
    guide: "Recorres el inmueble por zonas tomando fotos y notas por voz. Al terminar, con un botón se genera el acta de entrega (fecha y quién recibe) y se envía por correo a las partes para su aceptación.",
    items: [
      "Inventario guiado del inmueble por zonas, con fotos y notas por voz.",
      "Acta de entrega con fecha, quién recibe y observaciones (obligatoria).",
      "Descargar el acta y el contrato en PDF desde el celular.",
      "Envío automático del acta por correo a las partes para su aceptación.",
    ],
  },
  {
    title: "Durante el arriendo",
    guide: "El inquilino registra cada pago con su comprobante (o por un enlace/QR) y ambos reciben recordatorios. Si hay un daño, el inquilino lo reporta y el dueño acepta o rechaza desde su panel; las novedades quedan en la bitácora.",
    items: [
      "Calendario de pagos ordenado por vencimiento.",
      "Recordatorios de pago por correo y WhatsApp, y registro de pagos con soporte.",
      "Enlace o QR para que el inquilino suba el comprobante de pago.",
      "Reportar daños y reparaciones: el inquilino reporta y el dueño acepta o rechaza. Si hay una disputa, puedes acceder por un enlace a abogados aliados independientes, que te dicen cuánto podría costar antes de que decidas.",
      "Bitácora de novedades: convivencia, acuerdos e incumplimientos.",
      "Alertas de responsabilidad para dueño e inquilino, guardadas en el expediente.",
      "Vista 'como inquilino' para quienes también arriendan: ver sus contratos y reportar daños.",
    ],
  },
  {
    title: "Cierre y reputación",
    guide: "Al terminar el arriendo, renuevas (prórroga y reajuste por IPC) o lo cierras (paz y salvo, acta final). Luego cada parte califica la experiencia —con derecho de réplica— y puedes compartir tu certificado de confianza con enlace o QR.",
    items: [
      "Renovar el contrato (otrosí de prórroga y reajuste por IPC).",
      "Calificar la experiencia y construir reputación, con derecho de réplica.",
      "Certificado de confianza y paquete de evidencia del expediente.",
    ],
  },
  {
    title: "Herramientas y ayuda",
    guide: "Cuando lo necesites: pregúntale a la consulta legal con IA (te responde citando la norma), usa las calculadoras (IPC, tope de canon, mora, preaviso) o descarga plantillas gratis. Todo sin crear el contrato completo.",
    items: [
      "Consulta legal con inteligencia artificial que responde citando la norma.",
      "Calculadoras: IPC, tope del canon, intereses de mora y preaviso.",
      "Plantillas gratis (preaviso, paz y salvo, acta, autorización de datos).",
      "Blog con guías de arriendo y las leyes citadas.",
      "Pagos en línea con Wompi.",
    ],
  },
  {
    title: "Próximamente: aliados independientes",
    guide: "Estamos sumando aliados (seguros, jurídica, cobranza, estudio de crédito, asistencia al hogar). Son opcionales, con costo aparte y solo si tú decides tomarlos; nunca obligatorios.",
    items: [
      "Estamos sumando aliados independientes para cubrir todas tus necesidades si decides tomarlos, por un costo adicional y siempre a tu elección.",
      "Aseguradora: respaldo del arriendo y del inmueble.",
      "Jurídica: asesoría y acompañamiento legal en disputas.",
      "Cobranza: gestión profesional cuando hay mora.",
      "Estudio de crédito: verificación a fondo del inquilino o codeudor.",
      "Asistencia al hogar: plomería, electricidad, cerrajería y emergencias domésticas.",
    ],
  },
];

export default function FuncionalidadesPage() {
  const [speaking, setSpeaking] = useState(false);
  const [openGuide, setOpenGuide] = useState<Record<string, boolean>>({});
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const fullText = useMemo(
    () =>
      "Esto es todo lo que puedes hacer en ArriendoSeguro. " +
      SECTIONS.map((s) => `${s.title}. ${s.items.join(" ")}`).join(" "),
    [],
  );

  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  function toggleSpeak() {
    if (!canSpeak) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(fullText);
    u.lang = "es-CO";
    u.rate = 0.98;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  return (
    <div className="relative min-h-screen bg-[#F5F3EF] text-[#17151F]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-[#5646E5] hover:underline">← Inicio</Link>
          <Link href="/nuevo" className="rounded-full bg-[#FF6B4A] px-4 py-2 text-sm font-bold text-white">Crear mi contrato →</Link>
        </div>

        <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl">Todo lo que puedes hacer</h1>
        <p className="mt-3 text-lg text-slate-500">ArriendoSeguro te acompaña de principio a fin: crear, firmar, entregar, cobrar y administrar tu arriendo — simple y seguro.</p>

        {canSpeak && (
          <button
            type="button"
            onClick={toggleSpeak}
            className={`mt-5 inline-flex items-center gap-2 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg transition active:scale-95 ${speaking ? "bg-rose-500 shadow-rose-500/30" : "bg-[#5646E5] shadow-violet-500/30"}`}
          >
            {speaking ? "⏹️ Detener" : "🔊 Escuchar todo"}
          </button>
        )}

        <div className="mt-8 space-y-6">
          {SECTIONS.map((s) => (
            <section key={s.title} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-extrabold text-[#5646E5]">{s.title}</h2>
                {/* Ícono de info: al pasar el cursor muestra el tooltip; al tocarlo abre la mini-guía. */}
                <button
                  type="button"
                  onClick={() => setOpenGuide((o) => ({ ...o, [s.title]: !o[s.title] }))}
                  title="Ábrelo para ver cómo funciona y cómo usarlo"
                  aria-expanded={Boolean(openGuide[s.title])}
                  aria-label={`Cómo funciona: ${s.title}`}
                  className="flex flex-none items-center gap-1.5 rounded-full border border-[#5646E5]/40 bg-[#ECE9FB]/60 px-3 py-1.5 text-xs font-bold text-[#5646E5] transition hover:bg-[#ECE9FB] active:scale-95"
                >
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-[#5646E5] text-[10px] font-black text-white">i</span>
                  {openGuide[s.title] ? "Cerrar" : "¿Cómo funciona?"}
                </button>
              </div>
              {/* Mini-guía de cómo funciona / cómo usar esta parte. */}
              {openGuide[s.title] && (
                <div className="mt-3 rounded-2xl border border-[#5646E5]/30 bg-[#F5F3FF] p-3 text-[14px] leading-relaxed text-slate-700">
                  <span className="font-bold text-[#5646E5]">Cómo funciona: </span>{s.guide}
                </div>
              )}
              <ul className="mt-3 space-y-2">
                {s.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-700">
                    <span className="mt-1 flex-none text-[#12B886]">✓</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/nuevo" className="rounded-2xl bg-[#FF6B4A] px-7 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30">Empezar ahora →</Link>
          {canSpeak && (
            <button type="button" onClick={toggleSpeak} className="rounded-2xl border-2 border-[#5646E5] px-7 py-4 text-base font-bold text-[#5646E5]">
              {speaking ? "⏹️ Detener" : "🔊 Escuchar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
