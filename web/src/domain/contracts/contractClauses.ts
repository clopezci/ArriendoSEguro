/**
 * FIRMA ELECTRÓNICA CERTIFICADA POR TERCERO (feature DESACTIVADA).
 *
 * Decisión de producto (2026-07): el contrato usa SOLO la firma electrónica
 * simple de la plataforma (Ley 527 de 1999, plenamente válida) + notaría/
 * notariado digital como opción. La "firma certificada por un tercero" NO es un
 * requisito legal, tiene costo y confunde (dos firmas). Se deja apagada.
 *
 * PARA REACTIVARLA en el futuro (aplicación fácil):
 *   1) Cambia esta constante a `CERTIFIED_SIGNATURE_CLAUSE_TEXT` (abajo) para que
 *      el párrafo vuelva a imprimirse en el contrato.
 *   2) La lógica de desbloqueo (referidos calificados o micropago) ya existe en
 *      `@/domain/referrals/referrals.ts` (QUALIFIED_REFERRALS_*, MICROPAYMENT_*).
 *   3) Alinea el mismo texto en `v2026-2/contractClauses.ts`.
 */
const CERTIFIED_SIGNATURE_CLAUSE_TEXT = `
  <p>
    La plataforma podrá ofrecer, de forma opcional, un nivel adicional de <strong>firma electrónica certificada</strong>
    emitida por un tercero de confianza. Su uso es voluntario y no disminuye la validez de la firma electrónica simple
    aquí pactada; constituye únicamente una capa probatoria reforzada.
  </p>`;
/** Activo en el contrato: vacío = apagado. Poner `CERTIFIED_SIGNATURE_CLAUSE_TEXT` para reactivar. */
const CERTIFIED_SIGNATURE_CLAUSE = "";
void CERTIFIED_SIGNATURE_CLAUSE_TEXT; // conservado para reactivación futura (evita "no usado")

export const CONTRACT_TEMPLATE = `
<article>
  <h1>CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA</h1>
  <p>Entre los suscritos a saber:</p>
  <p>[COMPARECENCIA_ARRENDADOR]</p>
  <p>[COMPARECENCIA_ARRENDATARIO]</p>
  <p>[COMPARECENCIA_CODEUDOR_CONDICIONAL]</p>
  <p>
    hemos celebrado el presente Contrato de Arrendamiento de Vivienda Urbana, que se regirá por las normas civiles y
    comerciales aplicables, especialmente por la Ley 820 de 2003 y por las siguientes cláusulas:
  </p>

  <h2>PRIMERA. OBJETO</h2>
  <p>
    EL ARRENDADOR entrega a título de arrendamiento a EL ARRENDATARIO, y este recibe en tal calidad, el inmueble
    urbano destinado exclusivamente a vivienda, ubicado en <span class="dato">[DIRECCION_INMUEBLE]</span>, ciudad de
    [CIUDAD_INMUEBLE], departamento de [DEPARTAMENTO_INMUEBLE], identificado, si aplica, con matrícula inmobiliaria No.
    [MATRICULA_INMOBILIARIA].
  </p>
  <p>[NOTA_DIRECCION_URBANA_Y_CATASTRO]</p>
  <p>El inmueble objeto del presente contrato corresponde a: [TIPO_INMUEBLE].</p>

  <h2>SEGUNDA. DESTINACIÓN</h2>
  <p>
    EL ARRENDATARIO se obliga a destinar el inmueble exclusivamente para vivienda suya y/o de su grupo familiar
    autorizado, sin que pueda darle destinación comercial, industrial, turística, hotelera, subarrendarlo, cederlo o
    permitir su ocupación por terceros no autorizados, salvo autorización previa, expresa y escrita de EL ARRENDADOR.
  </p>
  <p>
    <b>Prohibición de uso ilícito.</b> EL ARRENDATARIO se obliga a no destinar el inmueble, ni permitir que se destine,
    a ninguna actividad ilícita, delictiva o contraria a la ley, el orden público o las buenas costumbres. En particular,
    queda expresamente prohibido usar el inmueble para: el tráfico, fabricación, almacenamiento o distribución de
    estupefacientes o sustancias controladas; la trata de personas, la explotación sexual, la explotación de personas o el
    trabajo forzado; la explotación sexual comercial de niños, niñas y adolescentes o cualquier forma de abuso o
    pornografía infantil; el lavado de activos, la financiación de actividades ilegales, el contrabando o la tenencia
    ilegal de armas o explosivos; o cualquier otra conducta tipificada como delito en la legislación colombiana. El
    incumplimiento de esta prohibición constituye causal de terminación inmediata del contrato por incumplimiento grave,
    sin perjuicio de las acciones legales, penales y de restitución que correspondan, y de la obligación de EL
    ARRENDATARIO de indemnizar los perjuicios ocasionados. EL ARRENDADOR podrá poner los hechos en conocimiento de las
    autoridades competentes.
  </p>

  <h2>TERCERA. CANON DE ARRENDAMIENTO</h2>
  <p>
    EL ARRENDATARIO pagará a EL ARRENDADOR, por concepto de canon de arrendamiento, la suma mensual de
    <span class="dato">[CANON_MENSUAL_LETRAS] ($[CANON_MENSUAL])</span>, pagadera dentro de los primeros
    <span class="dato">[DIA_PAGO]</span> días de cada mes, mediante [METODO_PAGO], o por el medio que las partes
    acuerden por escrito.
  </p>
  <p>
    Las partes declaran que el canon pactado ha sido revisado frente al valor comercial informado del inmueble y que
    no supera el límite legal aplicable para vivienda urbana.
  </p>

  <h2>CUARTA. DURACIÓN</h2>
  <p>
    El término de duración del presente contrato será de <span class="dato">[DURACION_MESES] meses</span>, contados a
    partir del día <span class="dato">[FECHA_INICIO]</span> y hasta el día <span class="dato">[FECHA_FIN]</span>.
  </p>
  <p>
    <b>Prórroga automática (artículo 6 de la Ley 820 de 2003).</b> El presente contrato se entenderá prorrogado en
    iguales condiciones y por el mismo término inicialmente pactado, siempre que cada una de las partes haya cumplido
    las obligaciones a su cargo y que EL ARRENDATARIO se avenga a los reajustes del canon autorizados por la ley. En
    consecuencia, si al vencimiento del término ninguna de las partes manifiesta lo contrario, el contrato continuará
    prorrogado sin necesidad de suscribir un documento nuevo. La parte que no desee la prórroga deberá dar aviso a la
    otra por escrito, con una antelación no menor a tres (3) meses al vencimiento, e invocando alguna de las causales
    legales cuando la ley lo exija.
  </p>

  <h2>QUINTA. REAJUSTE DEL CANON</h2>
  <p>
    El canon de arrendamiento solo podrá reajustarse cada doce (12) meses de ejecución del contrato bajo un mismo
    precio.
  </p>
  <p>
    <b>Límite legal del reajuste (artículo 20 de la Ley 820 de 2003).</b> Conforme al artículo 20 de la Ley 820 de
    2003: «Cada doce (12) meses de ejecución del contrato bajo un mismo precio, el arrendador podrá incrementar el
    canon hasta en una proporción que no sea superior al ciento por ciento (100%) del incremento que haya tenido el
    índice de precios al consumidor en el año calendario inmediatamente anterior a aquél en que deba efectuarse el
    reajuste del canon».
  </p>
  <p>
    El incremento no podrá superar ese límite. ArriendoSeguro podrá servir como herramienta de cálculo y registro del
    reajuste, sin que ello sustituya la responsabilidad de las partes de verificar la normatividad vigente.
  </p>

  <h2>SEXTA. FORMA DE PAGO Y SOPORTES</h2>
  <p>
    EL ARRENDATARIO deberá pagar el canon en la forma y fecha pactadas.
  </p>
  <p>
    EL ARRENDADOR deberá entregar o permitir constancia del pago recibido. Cuando las partes usen ArriendoSeguro,
    podrán registrar los pagos realizados dentro de la plataforma como soporte documental.
  </p>
  <p>
    Las partes reconocen que ArriendoSeguro no recauda dinero, no administra recursos, no actúa como intermediario
    financiero y no garantiza el pago del canon.
  </p>

  <h2>SÉPTIMA. SERVICIOS PÚBLICOS, ADMINISTRACIÓN Y OTROS GASTOS</h2>
  <p>
    Las partes acuerdan que el pago de los servicios públicos domiciliarios asociados al inmueble será responsabilidad
    de [RESPONSABLE_SERVICIOS_PUBLICOS], conforme a las siguientes condiciones:
  </p>
  <p>[DETALLE_SERVICIOS_PUBLICOS]</p>
  <p>
    En caso de existir cuotas de administración, expensas comunes u otros gastos asociados al inmueble, las partes
    acuerdan lo siguiente:
  </p>
  <p>[DETALLE_ADMINISTRACION_EXPENSAS]</p>
  <p>
    Las partes dejan constancia de que no se exige depósito en dinero efectivo ni caución real prohibida para
    garantizar obligaciones del contrato de vivienda urbana.
  </p>
  [GARANTIA_SERVICIOS_PUBLICOS_CONDICIONAL]

  <h2>OCTAVA. ENTREGA DEL INMUEBLE E INVENTARIO</h2>
  <p>
    EL ARRENDADOR entregará el inmueble en condiciones aptas para el uso convenido. Las partes podrán elaborar un
    inventario inicial del inmueble, incluyendo estado general, elementos entregados, medidores, llaves, fotografías
    y observaciones.
  </p>

  <h2>NOVENA. OBLIGACIONES DEL ARRENDADOR</h2>
  <ol>
    <li>Entregar el inmueble en la fecha acordada y en condiciones aptas para vivienda.</li>
    <li>Permitir el uso y goce pacífico del inmueble durante el término del contrato.</li>
    <li>Entregar copia del contrato a EL ARRENDATARIO.</li>
    <li>Respetar las condiciones pactadas.</li>
    <li>Cumplir las obligaciones legales aplicables.</li>
    <li>Atender las reparaciones que legal o contractualmente le correspondan.</li>
    <li>Respetar la privacidad y derechos de EL ARRENDATARIO.</li>
  </ol>

  <h2>DÉCIMA. OBLIGACIONES DEL ARRENDATARIO</h2>
  <ol>
    <li>Pagar oportunamente el canon de arrendamiento.</li>
    <li>Pagar los servicios públicos, administración u otros gastos que le correspondan según lo pactado.</li>
    <li>Usar el inmueble exclusivamente para vivienda.</li>
    <li>No destinar el inmueble a actividades ilícitas o delictivas (tráfico de drogas, explotación de personas, explotación o abuso infantil, lavado de activos u otras), conforme a la cláusula de destinación.</li>
    <li>Cuidar el inmueble y responder por daños causados por mal uso, culpa o negligencia.</li>
    <li>No subarrendar, ceder ni cambiar la destinación sin autorización.</li>
    <li>Restituir el inmueble al finalizar el contrato en condiciones adecuadas.</li>
    <li>Cumplir las obligaciones legales aplicables.</li>
  </ol>

  <h2>DÉCIMA PRIMERA. PROHIBICIÓN DE DEPÓSITOS EN DINERO</h2>
  <p>
    Las partes reconocen que, tratándose de arrendamiento de vivienda urbana, no se exige ni se pacta depósito en
    dinero efectivo u otra caución real prohibida para garantizar las obligaciones asumidas por EL ARRENDATARIO.
  </p>

  <p>[CLAUSULA_CODEUDOR_CONDICIONAL]</p>

  <h2>DÉCIMA SEGUNDA. FIRMA ELECTRÓNICA</h2>
  <p>
    Las partes acuerdan firmar el presente contrato mediante <strong>firma electrónica</strong> en los términos de la
    Ley 527 de 1999 y el Decreto 2364 de 2012. Reconocen que dicha firma tiene plena validez y fuerza probatoria y que,
    conforme al principio de equivalencia funcional, surte los mismos efectos jurídicos que la firma manuscrita cuando
    permite identificar al firmante e indicar que aprueba el contenido del mensaje de datos.
  </p>
  <p>
    El mecanismo de firma electrónica simple de la plataforma identifica a cada firmante y conserva evidencia del evento
    de firma —incluyendo la aceptación expresa, la fecha y hora, la dirección IP, el agente de usuario y el resumen
    criptográfico (hash) del documento firmado—, garantizando su integridad e inalterabilidad posterior. Cuando se
    utilice un código de verificación de un solo uso (OTP) enviado al firmante, este también queda registrado como
    factor de autenticación.
  </p>
  ${CERTIFIED_SIGNATURE_CLAUSE}
  <p>
    De forma <strong>opcional y alternativa</strong>, las partes podrán además <strong>autenticar</strong> este contrato
    ante notaría pública: descargarán el documento desde la plataforma, surtirán el trámite de autenticación y cargarán
    de nuevo el documento autenticado en el expediente. La autenticación notarial no sustituye la firma electrónica aquí
    pactada, sino que la refuerza para los efectos previstos por la ley. Adicionalmente, las partes cuentan con la opción
    de surtir la firma y autenticación digital de manera totalmente electrónica y gratuita a través de la Agencia Nacional
    Digital del Estado colombiano (Decreto 620 de 2020), conforme a las indicaciones disponibles en la plataforma.
  </p>

  <h2>DÉCIMA TERCERA. TRATAMIENTO DE DATOS PERSONALES</h2>
  <p>
    Las partes autorizan el tratamiento de sus datos personales por parte de la plataforma ArriendoSeguro para las
    finalidades relacionadas con creación, gestión, firma, trazabilidad, conservación documental y soporte del
    contrato.
  </p>

  <h2>DÉCIMA CUARTA. AUTORIZACIÓN VOLUNTARIA DE EVALUACIÓN ESTRUCTURADA Y REPUTACIÓN</h2>
  <p>
    EL ARRENDADOR, EL ARRENDATARIO y, cuando aplique, EL CODEUDOR SOLIDARIO <strong>autorizan de forma expresa, libre,
    previa e informada</strong> que, durante la ejecución del contrato y a su terminación, cada parte pueda calificar a
    la otra mediante una evaluación estructurada de la experiencia (formularios cerrados de calificación por estrellas,
    sin texto libre difamatorio), de manera recíproca.
  </p>
  <p>
    Se deja constancia de que esta evaluación es una <strong>facultad voluntaria y no una obligación contractual</strong>:
    ninguna de las partes está obligada a calificar, y el hecho de calificar o no calificar <strong>no constituye
    incumplimiento</strong> del presente contrato ni causal de terminación. Constituye tratamiento de datos personales
    autorizado conforme a la Ley 1581 de 2012 y al aviso de privacidad (no es lista negra pública ni consulta libre por
    cédula; solo se muestra agregada y con autorización del titular, quien puede conocer, actualizar, rectificar y
    ejercer sus derechos de habeas data). Su desarrollo detallado hace parte de los anexos de autorización de
    tratamiento de datos de este contrato.
  </p>

  <h2>DÉCIMA QUINTA. NOTIFICACIONES</h2>
  <p>
    Para todos los efectos legales y contractuales, las partes recibirán notificaciones judiciales y extrajudiciales en
    las siguientes direcciones:
  </p>
  <p>
    EL ARRENDADOR: Dirección [DIRECCION_NOTIFICACION_ARRENDADOR] - Correo [EMAIL_ARRENDADOR]
  </p>
  <p>
    EL ARRENDATARIO: Dirección [DIRECCION_NOTIFICACION_ARRENDATARIO] - Correo [EMAIL_ARRENDATARIO]
  </p>
  <p>[NOTIFICACION_CODEUDOR_CONDICIONAL]</p>
  <p>
    De conformidad con el artículo 12 de la Ley 820 de 2003, a falta de dirección expresamente señalada por alguna de
    las partes, se entiende que EL ARRENDATARIO y quien actúe como codeudor, si lo hubiere, reciben notificaciones en el
    inmueble arrendado, y EL ARRENDADOR en el lugar donde recibe el pago del canon. Cualquier cambio de dirección deberá
    comunicarse por escrito a la otra parte para que surta efectos.
  </p>

  <h2>DÉCIMA SEXTA. MORA, TERMINACIÓN Y RESTITUCIÓN LEGAL DEL INMUEBLE</h2>
  <p>
    En caso de mora igual o superior a [NUMERO_MESES_MORA] canon(es), EL ARRENDADOR podrá iniciar actuaciones
    legales para terminación y restitución conforme a la ley.
  </p>

  <h2>DÉCIMA SÉPTIMA. TERMINACIÓN</h2>
  <p>El presente contrato podrá darse por terminado por las siguientes causas:</p>
  <p><b>a) Por vencimiento del plazo o por mutuo acuerdo:</b></p>
  <ol>
    <li>Por el vencimiento del plazo pactado o de sus prórrogas, dando el aviso previsto en la cláusula CUARTA.</li>
    <li>Por mutuo acuerdo escrito entre las partes.</li>
  </ol>
  <p>
    <b>b) Por incumplimiento imputable a EL ARRENDATARIO (artículo 22 de la Ley 820 de 2003):</b> EL ARRENDADOR podrá
    dar por terminado unilateralmente el contrato, entre otras, por las siguientes causales:
  </p>
  <ol>
    <li>El no pago del canon dentro del término estipulado.</li>
    <li>El no pago de los servicios públicos, cuando ello dé lugar a la desconexión o pérdida del servicio, o el no pago de las expensas comunes cuando su pago estuviere a cargo de EL ARRENDATARIO.</li>
    <li>El subarriendo total o parcial del inmueble, la cesión del contrato o del goce del inmueble, o el cambio de destinación, sin autorización expresa y escrita de EL ARRENDADOR.</li>
    <li>La incursión reiterada en procederes que afecten la tranquilidad ciudadana de los vecinos, o la destinación del inmueble para actos delictivos o que impliquen contravención.</li>
    <li>La realización de mejoras, cambios o ampliaciones del inmueble sin autorización de EL ARRENDADOR, o la destrucción total o parcial del inmueble o del área arrendada.</li>
    <li>La violación de las normas del reglamento de propiedad horizontal, cuando aplique.</li>
  </ol>
  <p>
    <b>c) Por incumplimiento imputable a EL ARRENDADOR (artículo 24 de la Ley 820 de 2003):</b> EL ARRENDATARIO podrá
    dar por terminado unilateralmente el contrato, entre otras, por las siguientes causales:
  </p>
  <ol>
    <li>La suspensión de la prestación de los servicios públicos al inmueble por acción premeditada de EL ARRENDADOR, o por no pagar los que estuvieren a su cargo.</li>
    <li>La incursión reiterada de EL ARRENDADOR en procederes que afecten gravemente el disfrute cabal del inmueble por EL ARRENDATARIO.</li>
    <li>El desconocimiento por parte de EL ARRENDADOR de los derechos que la ley o el contrato reconocen a EL ARRENDATARIO.</li>
  </ol>
  <p>
    <b>d) Terminación unilateral con preaviso e indemnización (artículos 22 y 24 de la Ley 820 de 2003):</b> cualquiera
    de las partes podrá darla por terminada unilateralmente a la fecha de vencimiento o de sus prórrogas, dando aviso
    escrito a la otra con no menos de tres (3) meses de antelación y, cuando la ley lo exija, pagando la indemnización
    equivalente prevista en la ley.
  </p>

  <h2>DÉCIMA OCTAVA. RESTITUCIÓN DEL INMUEBLE</h2>
  <p>
    Al finalizar el contrato, EL ARRENDATARIO deberá restituir el inmueble en condiciones adecuadas, salvo deterioro
    normal por uso legítimo.
  </p>

  <h2>DÉCIMA NOVENA. ANEXOS</h2>
  <p>
    Hacen parte integral del presente contrato, cuando hayan sido generados o cargados en la plataforma, los anexos de
    inventario, actas, registros de pago, evidencia de firma electrónica, autorizaciones de tratamiento de datos y
    evaluación estructurada.
  </p>

  <h2>VIGÉSIMA. USO DE LA PLATAFORMA ARRIENDOSEGURO</h2>
  <p>
    ArriendoSeguro actúa como herramienta tecnológica de apoyo documental. No actúa como inmobiliaria, aseguradora,
    entidad financiera, abogado ni garante del cumplimiento.
  </p>

  [CLAUSULA_ACUERDOS_ESPECIALES_CONDICIONAL]
  [NOTIFICACIONES_PAGO_CONDICIONAL]
  [OBSERVACIONES_COMPLEMENTARIAS_CONDICIONAL]

  <h2>VIGÉSIMA PRIMERA. ACEPTACIÓN</h2>
  <p>
    Leído el presente contrato por las partes, y aceptado su contenido, se firma electrónicamente en la fecha
    registrada por la plataforma.
  </p>
  <p><strong>EL ARRENDADOR:</strong>
Nombre: [NOMBRE_ARRENDADOR]
Documento: [DOCUMENTO_ARRENDADOR]
</p>
  <p><strong>EL ARRENDATARIO:</strong>
Nombre: [NOMBRE_ARRENDATARIO]
Documento: [DOCUMENTO_ARRENDATARIO]
</p>
  <p>[FIRMA_CODEUDOR_CONDICIONAL]</p>
  <p>
    La <strong>firma electrónica</strong> de cada parte —con su fecha, dirección IP y resumen criptográfico (hash) de
    integridad— consta en el <strong>Anexo de Evidencia de Firma Electrónica</strong>, que hace parte integral de este
    contrato conforme a la Ley 527 de 1999.
  </p>
</article>
`;

export const COMPARECENCIA_CODEUDOR = `
y
[NOMBRE_CODEUDOR], mayor de edad, identificado(a) con [TIPO_DOCUMENTO_CODEUDOR] No. [NUMERO_DOCUMENTO_CODEUDOR],
domiciliado(a) en [CIUDAD_CODEUDOR], con correo electrónico [EMAIL_CODEUDOR], teléfono [TELEFONO_CODEUDOR] y
dirección de notificación [DIRECCION_NOTIFICACION_CODEUDOR], quien para efectos del presente contrato se denominará EL
CODEUDOR SOLIDARIO;
`;

export const CLAUSULA_CODEUDOR = `
CLÁUSULA DE CODEUDOR SOLIDARIO
Comparece al presente contrato [NOMBRE_CODEUDOR], mayor de edad, identificado(a) con [TIPO_DOCUMENTO_CODEUDOR]
No. [NUMERO_DOCUMENTO_CODEUDOR], domiciliado(a) en [CIUDAD_CODEUDOR], con correo electrónico [EMAIL_CODEUDOR],
teléfono [TELEFONO_CODEUDOR] y dirección de notificación [DIRECCION_NOTIFICACION_CODEUDOR], quien para efectos del
presente contrato actuará como CODEUDOR SOLIDARIO de EL ARRENDATARIO.
`;

export const NOTIFICACION_CODEUDOR = `
EL CODEUDOR SOLIDARIO:
Dirección: [DIRECCION_NOTIFICACION_CODEUDOR]
Correo: [EMAIL_CODEUDOR]
`;

export const FIRMA_CODEUDOR = `<strong>EL CODEUDOR SOLIDARIO:</strong>
Nombre: [NOMBRE_CODEUDOR]
Documento: [DOCUMENTO_CODEUDOR]
`;

export function wrapContractHtml(content: string, title: string): string {
  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      @page { margin: 2cm; }
      /* Estilos DEL DOCUMENTO, acotados a .contract-doc para no filtrarse a la app
         cuando el HTML se inyecta en la vista previa. Sirven igual en el PDF. */
      .contract-doc {
        font-family: Georgia, "Times New Roman", serif;
        color: #1e293b;
        line-height: 1.6;
        max-width: 820px;
        margin: 0 auto;
        padding: 8px 6px 24px;
        font-size: 13.5px;
        text-align: justify;
      }
      .contract-doc h1 {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 20px;
        font-weight: 800;
        text-align: center;
        color: #0f172a;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        margin: 0 0 6px;
      }
      .contract-doc article > p:first-of-type,
      .contract-doc > article > p:first-of-type { text-align: center; }
      .contract-doc h2 {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13.5px;
        font-weight: 800;
        color: #5b21b6;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        margin: 24px 0 8px;
        padding-bottom: 5px;
        border-bottom: 2px solid #ddd6fe;
      }
      .contract-doc h3 {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12.5px;
        font-weight: 700;
        color: #334155;
        margin: 16px 0 6px;
      }
      .contract-doc p, .contract-doc li { margin: 7px 0; white-space: pre-wrap; }
      .contract-doc ol { padding-left: 22px; }
      .contract-doc ol li { margin: 4px 0; }
      .contract-doc strong { font-weight: 700; color: #0f172a; }
      /* Datos clave remarcados (canon, fechas, inmueble, partes) */
      .contract-doc .dato {
        font-weight: 700;
        color: #4c1d95;
        background: #f5f3ff;
        padding: 0 3px;
        border-radius: 3px;
      }
      .contract-doc a { color: #6d28d9; }
    </style>
  </head>
  <body><div class="contract-doc">${content}</div></body>
</html>`;
}

