import { LeadMarketForm } from "@/components/forms/lead-market-form";
import { PER_CONTRACT_PAYMENT_NOTICE } from "@/lib/product-pricing";
import {
  formatPlanPlusPriceLineCheckoutAndList,
  getPlanPlusPricingForPublicPages,
} from "@/domain/platform-payments/plan-plus-pricing";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { freeTierEnabled } from "@/lib/config";
import Link from "next/link";

export const metadata = {
  title: "¿Primera vez arrendando? Entiéndelo fácil",
  description:
    "Guía clara para formalizar arriendos ya acordados entre arrendador y arrendatario en Colombia.",
};

const problemPoints = [
  "Acuerdos verbales difíciles de probar.",
  "Contratos incompletos o mal diligenciados.",
  "Falta de claridad sobre servicios públicos.",
  "Ausencia de inventario del inmueble.",
  "Pagos sin soporte ordenado.",
  "Dudas al momento de terminar el contrato.",
  "Riesgo de conflictos por falta de evidencia.",
];

const whatYouCanDo = [
  "Crear un proceso de arriendo.",
  "Invitar a la otra parte.",
  "Ingresar datos del arrendador, arrendatario e inmueble.",
  "Validar que el canon esté dentro del límite permitido.",
  "Definir responsabilidades sobre servicios públicos.",
  "Generar contrato automático.",
  "Firmar electrónicamente con trazabilidad.",
  "Crear inventario inicial del inmueble.",
  "Registrar pagos sin recaudo de dinero.",
  "Controlar reajustes.",
  "Cerrar el contrato con acta final.",
  "Evaluar la experiencia de forma estructurada y privada.",
];

const ownerBenefits = [
  "Evitas contratos incompletos.",
  "Dejas claro el canon y la forma de pago.",
  "Defines responsabilidades sobre servicios públicos.",
  "Puedes inventariar el inmueble.",
  "Puedes registrar pagos.",
  "Tienes soportes del proceso.",
  "Puedes cerrar el contrato con acta final.",
  "Puedes evaluar la experiencia de forma estructurada.",
];

const tenantBenefits = [
  "Conoces claramente las condiciones antes de firmar.",
  "Tienes copia del contrato.",
  "Dejas evidencia del estado inicial del inmueble.",
  "Sabes qué pagos te corresponden.",
  "Puedes registrar soportes de pago.",
  "Evitas acuerdos confusos.",
  "También puedes evaluar la experiencia.",
];

const steps = [
  "Crea tu cuenta.",
  "Crea un proceso de arriendo.",
  "Invita a la otra parte.",
  "Completen los datos.",
  "La app valida reglas básicas.",
  "Se genera el contrato.",
  "Ambas partes revisan y firman.",
  "Se crea el inventario.",
  "Se registran pagos.",
  "Se cierra el contrato con soportes.",
];

const conocerMasCards = [
  {
    title: "Lo básico",
    bullets: [
      "Contrato de arrendamiento guiado.",
      "Inventario del inmueble y actas.",
      "Firma digital entre las partes.",
      "Registro informativo de pagos.",
    ],
  },
  {
    title: "Complementario",
    text: "Recordatorios, reportes, trazabilidad y herramientas para que no se pierda nada importante durante el arriendo.",
  },
  {
    title: "Extras con aliados",
    text: "Seguro de arrendamiento, gestión de cobranza, estudios legales y apoyo jurídico especializado, solo si tú decides tomar esos servicios.",
  },
  {
    title: "Lo que viene",
    text: "Módulos adicionales de reputación, recomendaciones, y más adelante marketplace y búsqueda para quienes también quieran publicar.",
  },
] as const;

export default async function EntiendeloFacilPage() {
  const firestore = getAdminFirestore();
  const pricing = await getPlanPlusPricingForPublicPages(firestore);
  const planPlusPriceComparison = formatPlanPlusPriceLineCheckoutAndList(pricing.checkoutCop, pricing.listCompareCop);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-300 bg-white/95 p-6 shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Arrendar directo no tiene que ser informal
          </h1>
          <p className="mt-3 max-w-3xl text-slate-700">
            Si ya encontraste arrendador o arrendatario, Arriendo Seguro te guía paso a paso para
            formalizar el arriendo con contrato, firma electrónica, inventario y soportes.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/registro"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] hover:bg-violet-500"
            >
              Quiero formalizar mi arriendo
            </Link>
            <Link
              href="#encuesta"
              className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] hover:bg-violet-100/30"
            >
              Responder encuesta
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">El problema</h2>
          <p className="mt-3 text-slate-700">
            Muchas personas arriendan directamente porque ya encontraron a alguien interesado,
            porque un conocido les recomendó el inmueble, porque vieron un aviso, porque lo
            publicaron en redes o porque no quieren pagar una gestión inmobiliaria completa. El
            problema no es arrendar directamente. El problema es hacerlo sin contrato claro, sin
            inventario, sin soportes y sin trazabilidad.
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {problemPoints.map((item) => (
              <li key={item} className="rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            <h2 className="text-xl font-semibold">Usar una inmobiliaria</h2>
            <p className="mt-3 text-slate-700">
              Una inmobiliaria puede ayudar con publicación, estudio del arrendatario, contrato,
              administración, cobros, pólizas y acompañamiento. Es una opción útil cuando se busca
              delegar la gestión completa, pero puede tener costos asociados que no todas las
              personas quieren o pueden asumir.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            <h2 className="text-xl font-semibold">Hacerlo informalmente</h2>
            <p className="mt-3 text-slate-700">
              Arrendar directamente puede parecer más económico, pero si no se documenta bien,
              puede generar riesgos para ambas partes. Sin contrato claro, inventario, soportes de
              pago y reglas definidas, cualquier desacuerdo puede ser más difícil de resolver.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Arriendo Seguro es una tercera opción</h2>
          <p className="mt-3 text-slate-700">
            Arriendo Seguro está pensado para personas que ya se encontraron y quieren formalizar
            el arriendo de forma sencilla, económica y ordenada. No reemplaza una inmobiliaria,
            pero ayuda a documentar mejor el acuerdo para reducir riesgos por informalidad.
          </p>
          <p className="mt-4 rounded-lg border border-violet-500 bg-violet-100/20 px-4 py-3 text-violet-700">
            Ni informal, ni complicado: una forma guiada de formalizar tu arriendo.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Qué puedes hacer con Arriendo Seguro</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {whatYouCanDo.map((item) => (
              <li key={item} className="rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            <h2 className="text-xl font-semibold">Si eres propietario o arrendador</h2>
            <ul className="mt-4 space-y-2 text-slate-700">
              {ownerBenefits.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
            <h2 className="text-xl font-semibold">Si eres arrendatario</h2>
            <ul className="mt-4 space-y-2 text-slate-700">
              {tenantBenefits.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Una alternativa de bajo costo para formalizar</h2>
          {freeTierEnabled && (
            <p className="mt-3 rounded-lg border border-emerald-400 bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">
              Generar tu contrato de arrendamiento es <span className="underline">gratis</span>. La firma
              electrónica con validez, el inventario, el registro de pagos y todo el respaldo se activan con
              Plan Plus (pago único por contrato), por una fracción de lo que cuesta tu arriendo.
            </p>
          )}
          <p className="mt-3 text-slate-700">
            Una gestión inmobiliaria completa puede tener costos asociados a un porcentaje del
            canon mensual, dependiendo de la ciudad, empresa y servicios incluidos. Arriendo Seguro
            busca ofrecer una alternativa digital de pago único para personas que ya se encontraron
            y necesitan formalizar el arriendo.
          </p>
          <h3 className="mt-4 text-xl font-semibold">
            Mira los ejemplos a continuación y compara los posibles costos ilustrativos:
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-200/80 text-left">
                  <th className="border border-slate-300 px-3 py-2">Canon mensual</th>
                  <th className="border border-slate-300 px-3 py-2">Costo agencia 8%-10% mensual</th>
                  <th className="border border-slate-300 px-3 py-2">Arriendo Seguro</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">$1.000.000</td>
                  <td className="border border-slate-300 px-3 py-2">$80.000 a $100.000 al mes</td>
                  <td className="border border-slate-300 px-3 py-2">{planPlusPriceComparison}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">$2.000.000</td>
                  <td className="border border-slate-300 px-3 py-2">$160.000 a $200.000 al mes</td>
                  <td className="border border-slate-300 px-3 py-2">{planPlusPriceComparison}</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-3 py-2">$3.000.000</td>
                  <td className="border border-slate-300 px-3 py-2">$240.000 a $300.000 al mes</td>
                  <td className="border border-slate-300 px-3 py-2">{planPlusPriceComparison}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-600">{PER_CONTRACT_PAYMENT_NOTICE}</p>
          <p className="mt-2 text-xs text-slate-600">
            Valores ilustrativos. Las tarifas de agencias, inmobiliarias, pólizas, estudios y
            servicios adicionales pueden variar según ciudad, empresa y condiciones comerciales.
            Arriendo Seguro no reemplaza una inmobiliaria ni una asesoría legal personalizada; es
            una herramienta digital para formalizar y documentar arriendos ya acordados entre
            particulares.
          </p>
        </section>

        <section id="conocer-mas" className="space-y-5 rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Conocer más: visión completa de Arriendo Seguro</h2>
          <p className="max-w-4xl text-slate-700">
            Queremos democratizar el acceso a garantías y cumplimiento legal para protegerte de manera
            fácil y de bajo costo. Empezamos por lo esencial y seguimos creciendo contigo, sin perder
            claridad sobre qué hacemos hoy y qué podemos habilitar mañana.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {conocerMasCards.map((card) => (
              <article
                key={card.title}
                className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.22)]"
              >
                <h3 className="text-lg font-semibold">{card.title}</h3>
                {"bullets" in card ? (
                  <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
                    {card.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-700">{card.text}</p>
                )}
              </article>
            ))}
          </div>
          <article className="rounded-2xl border border-slate-300 bg-white/95 p-5 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
            <h3 className="text-lg font-semibold">Quiénes somos y por qué lo hacemos</h3>
            <p className="mt-3 text-slate-700">
              Nacimos para que arrendar no sea un dolor de cabeza ni un privilegio costoso. Creemos
              que cada familia merece acuerdos claros, respaldo y herramientas simples para vivir con
              tranquilidad y construir confianza entre personas.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-violet-500 bg-violet-100/20 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.2)]">
          <h2 className="text-2xl font-semibold">Qué no hace Arriendo Seguro</h2>
          <p className="mt-3 text-violet-800">
            Para ser claros, Arriendo Seguro no es una inmobiliaria tradicional, no administra tu
            inmueble, no recauda el canon, no garantiza el pago, no reemplaza un abogado, no
            publica listas negras, no permite comentarios ofensivos y no hace búsqueda pública por
            cédula. <br /><br />
            AS es una herramienta digital para ayudar a formalizar y documentar arriendos ya acordados entre personas
            particulares, de modo que cuentes con respaldo escrito y trazable si más adelante necesitas acudir 
            por una vía legal o de conciliación.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Cómo funciona paso a paso</h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((step, i) => (
              <li key={step} className="rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm">
                <span className="font-semibold text-violet-700">{i + 1}.</span> {step}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/65 p-6 shadow-[0_10px_24px_rgba(139,92,246,0.18)]">
          <h2 className="text-2xl font-semibold">Evaluar la experiencia sin crear listas negras</h2>
          <p className="mt-3 text-slate-700">
            La evaluación de Arriendo Seguro será privada, estructurada y basada en formularios
            cerrados. No será una lista negra pública, no permitirá comentarios ofensivos y no será
            consultable libremente por cédula. Su objetivo es ayudar a construir mejores referencias
            arrendaticias respetando la privacidad y el tratamiento adecuado de datos.
          </p>
        </section>

        <section id="encuesta" className="rounded-2xl border border-slate-300 bg-white/75 p-6 shadow-[0_12px_30px_rgba(139,92,246,0.22)]">
          <h2 className="text-2xl font-semibold">Responder encuesta</h2>
          <p className="mt-2 text-slate-700">
            Tus respuestas nos ayudan a priorizar lo que más valor genera en esta etapa.
          </p>
          <LeadMarketForm sourcePage="entiendelo-facil" />
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white/75 p-6 text-center shadow-[0_14px_34px_rgba(139,92,246,0.22)]">
          <h2 className="text-2xl font-bold">¿Ya encontraste arrendador o arrendatario?</h2>
          <p className="mt-2 text-slate-700">
            Formaliza el arriendo con más claridad, soporte y tranquilidad.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/registro"
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] hover:bg-violet-500"
            >
              Quiero formalizar mi arriendo
            </Link>
            <Link
              href="#encuesta"
              className="rounded-lg border border-violet-500 px-5 py-2.5 text-sm font-medium text-violet-700 shadow-[0_0_14px_rgba(139,92,246,0.35)] hover:bg-violet-100/30"
            >
              Responder encuesta
            </Link>
            <Link
              href="/crear-cuenta"
              className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_18px_rgba(56,189,248,0.35)] hover:bg-sky-600"
            >
              Crear cuenta
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
