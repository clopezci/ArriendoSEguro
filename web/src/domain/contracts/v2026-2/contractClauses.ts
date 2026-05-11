/**
 * Plantilla `AS-LEASE-2026.2` — VIVIENDA URBANA.
 *
 * Nota: no se usa todavía. La activación se hace en el bloque 11 del plan
 * `web/docs/plan-mejoras-contrato-flujo.md`. Hasta entonces el wizard sigue
 * generando contratos con `AS-LEASE-MVP-2026.1`.
 *
 * Los marcadores `// PENDIENTE: validar con abogado` indican textos que el
 * abogado debe confirmar antes de activar oficialmente esta versión.
 */

export const CONTRACT_TEMPLATE_V2026_2 = `
<article>
  <h1>CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA</h1>
  <p class="meta">Versión [VERSION_CONTRATO] · Plataforma Arriendo Seguro</p>

  <p>Entre los suscritos a saber:</p>
  <p>[COMPARECENCIA_ARRENDADOR]</p>
  <p>[COMPARECENCIA_ARRENDATARIO]</p>
  <p>[COMPARECENCIA_CODEUDOR_CONDICIONAL]</p>
  <p>
    hemos celebrado el presente Contrato de Arrendamiento de Vivienda Urbana, que se regirá por las normas civiles y
    comerciales aplicables, especialmente por la Ley 820 de 2003, la Ley 527 de 1999 (firma y mensaje de datos) y la
    Ley 1581 de 2012 (protección de datos personales), y por las siguientes cláusulas:
  </p>

  <h2>PRIMERA. TIPO DE CONTRATO</h2>
  <p>
    Las partes declaran que el presente contrato es de arrendamiento de [TIPO_CONTRATO_LEGIBLE]. La plataforma
    Arriendo Seguro habilitará progresivamente otras modalidades; mientras tanto, este documento se rige por la
    regulación aplicable a vivienda urbana.
  </p>

  <h2>SEGUNDA. OBJETO</h2>
  <p>
    EL ARRENDADOR entrega a título de arrendamiento a EL ARRENDATARIO, y este recibe en tal calidad, el inmueble
    urbano destinado exclusivamente a vivienda, ubicado en [DIRECCION_INMUEBLE], ciudad de [CIUDAD_INMUEBLE],
    departamento de [DEPARTAMENTO_INMUEBLE], identificado, si aplica, con matrícula inmobiliaria No.
    [MATRICULA_INMOBILIARIA].
  </p>
  <p>[NOTA_DIRECCION_URBANA_Y_CATASTRO]</p>
  <p>El inmueble objeto del presente contrato corresponde a: [TIPO_INMUEBLE].</p>

  <h2>TERCERA. DESTINACIÓN</h2>
  <p>
    EL ARRENDATARIO se obliga a destinar el inmueble exclusivamente para vivienda propia y/o de su grupo autorizado,
    sin que pueda darle destinación comercial, industrial, turística, hotelera, subarrendarlo, cederlo o permitir su
    ocupación por terceros no autorizados, salvo autorización previa, expresa y escrita de EL ARRENDADOR.
  </p>

  <h2>CUARTA. CANON DE ARRENDAMIENTO Y OBLIGACIÓN DE PAGO</h2>
  <p>
    EL ARRENDATARIO se obliga a pagar a EL ARRENDADOR la suma mensual de [CANON_MENSUAL_LETRAS]
    ($[CANON_MENSUAL]) por concepto de canon de arrendamiento, dentro de los primeros [DIA_PAGO] días de cada mes,
    mediante [METODO_PAGO], o por el medio que las partes acuerden por escrito.
  </p>
  <p>
    Las partes declaran que el canon pactado ha sido revisado frente al valor comercial informado del inmueble y que
    no supera el límite legal aplicable para vivienda urbana.
  </p>
  <p>
    EL ARRENDADOR deberá entregar o permitir constancia del pago recibido. Cuando las partes usen Arriendo Seguro,
    podrán registrar los pagos realizados dentro de la plataforma como soporte documental.
  </p>
  <p>
    Las partes reconocen que Arriendo Seguro no recauda dinero, no administra recursos, no actúa como intermediario
    financiero y no garantiza el pago del canon.
  </p>

  <h2>QUINTA. DURACIÓN Y PRÓRROGAS</h2>
  <p>
    El término de duración del presente contrato será de [DURACION_MESES] meses, contados a partir del día
    [FECHA_INICIO] y hasta el día [FECHA_FIN].
  </p>
  <p>
    Si las partes desean renovar o prorrogar el contrato, podrán hacerlo conforme a la ley y dejando constancia
    escrita o electrónica de las condiciones aplicables. La sola continuidad de la ocupación, sin oposición, podrá
    interpretarse de acuerdo con las reglas legales sobre prórroga automática en vivienda urbana.
  </p>

  <h2>SEXTA. REAJUSTE DEL CANON</h2>
  <p>
    El canon de arrendamiento solo podrá reajustarse cada doce meses de ejecución del contrato bajo un mismo precio,
    de conformidad con los límites establecidos por la normatividad colombiana aplicable.
  </p>
  <p>
    El incremento no podrá superar el porcentaje legalmente permitido para el periodo correspondiente. Arriendo Seguro
    podrá servir como herramienta de cálculo y registro del reajuste, sin que ello sustituya la responsabilidad de las
    partes de verificar la normatividad vigente.
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

  <h2>OCTAVA. ENTREGA DEL INMUEBLE E INVENTARIO</h2>
  <p>
    EL ARRENDADOR entregará el inmueble en condiciones aptas para el uso convenido. Las partes podrán elaborar un
    inventario inicial del inmueble, incluyendo estado general, elementos entregados, medidores, llaves, fotografías y
    observaciones, dejando registro en la plataforma.
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
    <li>Pagar oportunamente el canon de arrendamiento en la forma y fecha pactadas.</li>
    <li>Pagar los servicios públicos, administración u otros gastos que le correspondan según lo pactado.</li>
    <li>Usar el inmueble exclusivamente para vivienda.</li>
    <li>Cuidar el inmueble y responder por daños causados por mal uso, culpa o negligencia.</li>
    <li>No subarrendar, ceder ni cambiar la destinación sin autorización previa, expresa y escrita.</li>
    <li>Restituir el inmueble al finalizar el contrato en condiciones adecuadas.</li>
    <li>Cumplir las obligaciones legales aplicables.</li>
  </ol>

  <h2>DÉCIMA PRIMERA. PROHIBICIÓN DE DEPÓSITOS EN DINERO</h2>
  <p>
    Las partes reconocen que, tratándose de arrendamiento de vivienda urbana, no se exige ni se pacta depósito en
    dinero efectivo u otra caución real prohibida para garantizar las obligaciones asumidas por EL ARRENDATARIO.
  </p>

  <p>[CLAUSULA_CODEUDOR_CONDICIONAL]</p>

  <h2>DÉCIMA SEGUNDA. LIQUIDACIÓN DE SUMAS ADEUDADAS</h2>
  <p>
    En caso de mora o incumplimiento, las sumas adeudadas por EL ARRENDATARIO podrán liquidarse con base en el canon
    pactado, los pagos registrados en la plataforma Arriendo Seguro, los soportes documentales aportados por las
    partes y las fechas de vencimiento de cada obligación.
  </p>
  <p>
    Para tal liquidación se tendrán en cuenta los registros de pagos, los recibos cargados, las comunicaciones de mora
    y, en general, todo soporte que conste en el expediente digital del arriendo. La liquidación así obtenida servirá
    como base para acuerdos amistosos, conciliación o, en su caso, las acciones legales que correspondan.
  </p>

  <h2>DÉCIMA TERCERA. MORA, TERMINACIÓN Y RESTITUCIÓN LEGAL DEL INMUEBLE</h2>
  <p>
    En caso de mora igual o superior a [NUMERO_MESES_MORA] canon(es), EL ARRENDADOR podrá iniciar las actuaciones
    legales correspondientes para la terminación del contrato y la restitución del inmueble, conforme a la Ley 820 de
    2003 y demás normas aplicables.
  </p>

  <h2>DÉCIMA CUARTA. TERMINACIÓN</h2>
  <ol>
    <li>Vencimiento del plazo pactado.</li>
    <li>Mutuo acuerdo.</li>
    <li>Incumplimiento de obligaciones legales o contractuales.</li>
    <li>Causales previstas en la normatividad colombiana aplicable.</li>
    <li>Demás causales reconocidas por la ley.</li>
  </ol>

  <h2>DÉCIMA QUINTA. RESTITUCIÓN DEL INMUEBLE</h2>
  <p>
    Al finalizar el contrato, EL ARRENDATARIO deberá restituir el inmueble en condiciones adecuadas, salvo deterioro
    normal por uso legítimo.
  </p>

  <h2>DÉCIMA SEXTA. FIRMA ELECTRÓNICA REFORZADA Y MENSAJE DE DATOS</h2>
  <p>
    Las partes aceptan firmar el presente contrato mediante firma electrónica, conforme a la Ley 527 de 1999. Para
    asegurar identidad, integridad y trazabilidad de cada firma, la plataforma Arriendo Seguro implementará, sin costo
    para las partes en la fase inicial, los siguientes mecanismos:
  </p>
  <ol>
    <li>Verificación por código único de un solo uso (OTP) enviado al correo electrónico de cada firmante.</li>
    <li>Registro de dirección IP, fecha y hora del evento de firma.</li>
    <li>Registro del agente de usuario (navegador / dispositivo) utilizado al firmar.</li>
    <li>Cálculo y registro de un hash criptográfico del documento firmado para garantizar su integridad.</li>
    <li>Conservación de una versión inmutable del contrato y de un certificado de evidencia por firmante.</li>
  </ol>
  <p>
    El conjunto de registros mencionados constituye un mensaje de datos y, junto con el contrato firmado, hace prueba
    del consentimiento expresado por cada parte.
  </p>

  <h2>DÉCIMA SÉPTIMA. TRATAMIENTO DE DATOS PERSONALES</h2>
  <p>
    Las partes autorizan el tratamiento de sus datos personales por parte de Arriendo Seguro para las finalidades
    relacionadas con la creación, gestión, firma, trazabilidad, conservación documental y soporte del contrato,
    conforme a la Ley 1581 de 2012, sus decretos reglamentarios y el aviso de privacidad publicado en la plataforma.
  </p>
  <p>
    EL ARRENDADOR, EL ARRENDATARIO y, cuando aplique, EL CODEUDOR SOLIDARIO, declaran conocer dicha política y aceptar
    sus términos. Podrán ejercer sus derechos de acceso, rectificación, actualización y supresión a través de los
    canales informados en el aviso de privacidad.
  </p>

  <h2>DÉCIMA OCTAVA. EVALUACIÓN ESTRUCTURADA DE LA EXPERIENCIA ARRENDATICIA</h2>
  <p>
    Las partes aceptan que podrán registrar una evaluación estructurada de la experiencia arrendaticia mediante
    formularios cerrados. La evaluación no constituye lista negra pública ni consulta libre por cédula, y solo se
    publicará agregada en perfiles cuando lo permita la política de la plataforma.
  </p>

  <h2>DÉCIMA NOVENA. NOTIFICACIONES Y COMUNICACIONES</h2>
  <p>
    EL ARRENDADOR: Dirección [DIRECCION_NOTIFICACION_ARRENDADOR] · Correo [EMAIL_ARRENDADOR]
  </p>
  <p>
    EL ARRENDATARIO: Dirección [DIRECCION_NOTIFICACION_ARRENDATARIO] · Correo [EMAIL_ARRENDATARIO]
  </p>
  <p>[NOTIFICACION_CODEUDOR_CONDICIONAL]</p>
  <p>
    Las partes aceptan recibir comunicaciones, requerimientos y notificaciones derivadas del contrato a través de los
    correos electrónicos registrados y de la plataforma Arriendo Seguro, sin perjuicio de los demás canales legales
    que correspondan.
  </p>

  <p>[CLAUSULA_ESPECIALES_CONDICIONAL]</p>

  <p>[CLAUSULA_NOTARIZACION_CONDICIONAL]</p>

  <h2>VIGÉSIMA. ANEXOS Y EVIDENCIA DIGITAL</h2>
  <p>
    Hacen parte integral del presente contrato, cuando hayan sido generados o cargados en la plataforma, los
    siguientes documentos:
  </p>
  <ol>
    <li>Contrato firmado electrónicamente.</li>
    <li>Anexo de firma electrónica con certificado de evidencia (IP, fecha, hora, user agent y hash).</li>
    <li>Inventario inicial y acta de entrega.</li>
    <li>Registro de pagos del expediente.</li>
    <li>Soportes de pago cargados por las partes.</li>
    <li>Estado de cuenta consolidado.</li>
    <li>Comunicaciones de mora o requerimientos.</li>
    <li>Documento autenticado en notaría, cuando las partes así lo decidan.</li>
  </ol>

  <h2>VIGÉSIMA PRIMERA. USO DE LA PLATAFORMA ARRIENDO SEGURO</h2>
  <p>
    Arriendo Seguro actúa como herramienta tecnológica de apoyo documental. No actúa como inmobiliaria, aseguradora,
    entidad financiera, abogado ni garante del cumplimiento. Las partes son las responsables del cumplimiento de las
    obligaciones contractuales y legales aquí descritas.
  </p>

  <h2>VIGÉSIMA SEGUNDA. ACEPTACIÓN</h2>
  <p>
    Leído el presente contrato por las partes, y aceptado su contenido, se firma electrónicamente conforme a la
    cláusula DÉCIMA SEXTA, en la fecha registrada por la plataforma.
  </p>
  <p>
    EL ARRENDADOR: [NOMBRE_ARRENDADOR] · [DOCUMENTO_ARRENDADOR] · Firma: [FIRMA_ARRENDADOR] · Fecha:
    [FECHA_FIRMA_ARRENDADOR]
  </p>
  <p>
    EL ARRENDATARIO: [NOMBRE_ARRENDATARIO] · [DOCUMENTO_ARRENDATARIO] · Firma: [FIRMA_ARRENDATARIO] · Fecha:
    [FECHA_FIRMA_ARRENDATARIO]
  </p>
  <p>[FIRMA_CODEUDOR_CONDICIONAL]</p>
</article>
`;

export const COMPARECENCIA_CODEUDOR_V2026_2 = `
y
[NOMBRE_CODEUDOR], mayor de edad, identificado(a) con [TIPO_DOCUMENTO_CODEUDOR] No. [NUMERO_DOCUMENTO_CODEUDOR],
domiciliado(a) en [CIUDAD_CODEUDOR], con correo electrónico [EMAIL_CODEUDOR], teléfono [TELEFONO_CODEUDOR] y
dirección de notificación [DIRECCION_NOTIFICACION_CODEUDOR], quien para efectos del presente contrato se denominará EL
CODEUDOR SOLIDARIO;
`;

/**
 * Cláusula de codeudor reforzada para `AS-LEASE-2026.2`:
 * - firma expresa,
 * - obligación solidaria con el arrendatario,
 * - notificación clara,
 * - autorización de tratamiento de datos,
 * - aceptación de prórrogas dentro de los límites legales.
 *
 * PENDIENTE: validar con abogado el alcance de la aceptación de prórrogas
 * para evitar fricción con la jurisprudencia colombiana sobre obligaciones
 * solidarias y consentimiento informado del codeudor.
 */
export const CLAUSULA_CODEUDOR_V2026_2 = `
<h2>DÉCIMA PRIMERA-BIS. CODEUDOR SOLIDARIO</h2>
<p>
  Comparece al presente contrato [NOMBRE_CODEUDOR], mayor de edad, identificado(a) con [TIPO_DOCUMENTO_CODEUDOR]
  No. [NUMERO_DOCUMENTO_CODEUDOR], domiciliado(a) en [CIUDAD_CODEUDOR], con correo electrónico [EMAIL_CODEUDOR],
  teléfono [TELEFONO_CODEUDOR] y dirección de notificación [DIRECCION_NOTIFICACION_CODEUDOR], quien actuará como
  CODEUDOR SOLIDARIO de EL ARRENDATARIO.
</p>
<ol>
  <li>
    <strong>Obligación solidaria:</strong> EL CODEUDOR SOLIDARIO se obliga solidariamente con EL ARRENDATARIO frente
    a EL ARRENDADOR respecto de todas las obligaciones derivadas del presente contrato, incluido el pago del canon,
    los servicios públicos, los gastos pactados y los perjuicios causados al inmueble.
  </li>
  <li>
    <strong>Notificación:</strong> EL CODEUDOR SOLIDARIO acepta ser notificado en su dirección y correo electrónico
    aquí registrados, así como a través de la plataforma Arriendo Seguro, para cualquier incumplimiento o
    requerimiento relacionado con el contrato.
  </li>
  <li>
    <strong>Autorización de datos personales:</strong> EL CODEUDOR SOLIDARIO autoriza expresamente el tratamiento de
    sus datos personales por parte de la plataforma Arriendo Seguro, conforme a la Ley 1581 de 2012 y al aviso de
    privacidad, para gestionar las finalidades relacionadas con su rol dentro del contrato.
  </li>
  <li>
    <strong>Aceptación de prórrogas:</strong> Dentro de los límites permitidos por la ley colombiana y la
    jurisprudencia aplicable, EL CODEUDOR SOLIDARIO acepta mantener su garantía solidaria respecto de las prórrogas
    automáticas o expresas que las partes pacten, salvo manifestación escrita en contrario antes del vencimiento del
    término inicial.
  </li>
  <li>
    <strong>Firma expresa:</strong> EL CODEUDOR SOLIDARIO firma electrónicamente este contrato mediante el mecanismo
    descrito en la cláusula DÉCIMA SEXTA, dejando constancia individual de su consentimiento.
  </li>
</ol>
`;

export const NOTIFICACION_CODEUDOR_V2026_2 = `
EL CODEUDOR SOLIDARIO:
Dirección: [DIRECCION_NOTIFICACION_CODEUDOR]
Correo: [EMAIL_CODEUDOR]
`;

export const FIRMA_CODEUDOR_V2026_2 = `
EL CODEUDOR SOLIDARIO:
Nombre: [NOMBRE_CODEUDOR]
Documento: [DOCUMENTO_CODEUDOR]
Firma electrónica: [FIRMA_CODEUDOR]
Fecha de firma: [FECHA_FIRMA_CODEUDOR]
`;

/**
 * Cláusula condicional con las cláusulas especiales solicitadas por las
 * partes. Solo aparece si el usuario marcó "tengo cláusulas especiales" en
 * el wizard (paso del bloque 5). El aviso de costo adicional se muestra en
 * UI antes de generar el contrato; en el documento queda únicamente el texto
 * de las cláusulas seleccionadas.
 */
export const CLAUSULA_ESPECIALES_V2026_2 = `
<h2>VIGÉSIMA TERCERA. CLÁUSULAS ESPECIALES SOLICITADAS POR LAS PARTES</h2>
<p>
  Las partes incorporan al presente contrato las siguientes cláusulas especiales acordadas entre ellas, las cuales se
  entienden como complementarias y no contrarias a la ley aplicable:
</p>
<p>[DETALLE_CLAUSULAS_ESPECIALES]</p>
<p>
  Estas cláusulas son específicas del presente arrendamiento y no modifican el alcance de la regulación general de
  vivienda urbana.
</p>
`;

/**
 * Cláusula condicional para autenticación notarial. Solo aparece si el
 * usuario seleccionó "sí" en el paso del bloque 9. Indica el procedimiento
 * y el aliado digital próximo.
 */
export const CLAUSULA_NOTARIZACION_V2026_2 = `
<h2>VIGÉSIMA CUARTA. AUTENTICACIÓN NOTARIAL</h2>
<p>
  Las partes manifiestan su voluntad de autenticar el presente contrato ante notaría pública. Para ello, descargarán
  el documento desde la plataforma Arriendo Seguro, lo imprimirán, surtirán el trámite de autenticación y cargarán de
  nuevo el documento autenticado en el expediente correspondiente.
</p>
<p>
  La autenticación notarial no sustituye los efectos de la firma electrónica de la cláusula DÉCIMA SEXTA, sino que la
  refuerza para los efectos previstos por la ley. Próximamente, Arriendo Seguro habilitará un aliado de notariado
  digital que permitirá realizar este trámite de manera totalmente electrónica.
</p>
`;

export function wrapContractHtmlV2026_2(content: string, title: string): string {
  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; margin: 24px; }
      article { max-width: 900px; margin: 0 auto; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      h2 { font-size: 15px; margin-top: 20px; margin-bottom: 8px; }
      p, li { font-size: 13px; margin: 6px 0; white-space: pre-wrap; }
      ol { padding-left: 18px; }
      p.meta { color: #475569; font-size: 12px; margin-top: -8px; margin-bottom: 16px; }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}
