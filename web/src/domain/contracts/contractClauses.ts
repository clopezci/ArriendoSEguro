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
    urbano destinado exclusivamente a vivienda, ubicado en [DIRECCION_INMUEBLE], ciudad de [CIUDAD_INMUEBLE],
    departamento de [DEPARTAMENTO_INMUEBLE], identificado, si aplica, con matrícula inmobiliaria No.
    [MATRICULA_INMOBILIARIA].
  </p>
  <p>[NOTA_DIRECCION_URBANA_Y_CATASTRO]</p>
  <p>El inmueble objeto del presente contrato corresponde a: [TIPO_INMUEBLE].</p>

  <h2>SEGUNDA. DESTINACIÓN</h2>
  <p>
    EL ARRENDATARIO se obliga a destinar el inmueble exclusivamente para vivienda propia y/o de su grupo autorizado,
    sin que pueda darle destinación comercial, industrial, turística, hotelera, subarrendarlo, cederlo o permitir su
    ocupación por terceros no autorizados, salvo autorización previa, expresa y escrita de EL ARRENDADOR.
  </p>

  <h2>TERCERA. CANON DE ARRENDAMIENTO</h2>
  <p>
    EL ARRENDATARIO pagará a EL ARRENDADOR, por concepto de canon de arrendamiento, la suma mensual de
    [CANON_MENSUAL_LETRAS] ($[CANON_MENSUAL]), pagadera dentro de los primeros [DIA_PAGO] días de cada mes,
    mediante [METODO_PAGO], o por el medio que las partes acuerden por escrito.
  </p>
  <p>
    Las partes declaran que el canon pactado ha sido revisado frente al valor comercial informado del inmueble y que
    no supera el límite legal aplicable para vivienda urbana.
  </p>

  <h2>CUARTA. DURACIÓN</h2>
  <p>
    El término de duración del presente contrato será de [DURACION_MESES] meses, contados a partir del día
    [FECHA_INICIO] y hasta el día [FECHA_FIN].
  </p>
  <p>
    Si las partes desean renovar el contrato, podrán hacerlo conforme a la ley y dejando constancia escrita o
    electrónica de las condiciones aplicables.
  </p>

  <h2>QUINTA. REAJUSTE DEL CANON</h2>
  <p>
    El canon de arrendamiento solo podrá reajustarse cada doce meses de ejecución del contrato bajo un mismo precio,
    de conformidad con los límites establecidos por la normatividad colombiana aplicable.
  </p>
  <p>
    El incremento no podrá superar el porcentaje legalmente permitido para el periodo correspondiente. Arriendo Seguro
    podrá servir como herramienta de cálculo y registro del reajuste, sin que ello sustituya la responsabilidad de las
    partes de verificar la normatividad vigente.
  </p>

  <h2>SEXTA. FORMA DE PAGO Y SOPORTES</h2>
  <p>
    EL ARRENDATARIO deberá pagar el canon en la forma y fecha pactadas.
  </p>
  <p>
    EL ARRENDADOR deberá entregar o permitir constancia del pago recibido. Cuando las partes usen Arriendo Seguro,
    podrán registrar los pagos realizados dentro de la plataforma como soporte documental.
  </p>
  <p>
    Las partes reconocen que Arriendo Seguro no recauda dinero, no administra recursos, no actúa como intermediario
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
    Las partes aceptan que el presente contrato pueda ser firmado mediante mecanismos de firma electrónica simple,
    siempre que permitan identificar al firmante, evidenciar su aprobación del contenido y conservar trazabilidad del
    evento de firma.
  </p>

  <h2>DÉCIMA TERCERA. TRATAMIENTO DE DATOS PERSONALES</h2>
  <p>
    Las partes autorizan el tratamiento de sus datos personales por parte de la plataforma Arriendo Seguro para las
    finalidades relacionadas con creación, gestión, firma, trazabilidad, conservación documental y soporte del
    contrato.
  </p>

  <h2>DÉCIMA CUARTA. EVALUACIÓN ESTRUCTURADA DE LA EXPERIENCIA ARRENDATICIA</h2>
  <p>
    Las partes aceptan que podrán registrar una evaluación estructurada de la experiencia arrendaticia mediante
    formularios cerrados. No constituye lista negra pública ni consulta libre por cédula.
  </p>

  <h2>DÉCIMA QUINTA. NOTIFICACIONES</h2>
  <p>
    EL ARRENDADOR: Dirección [DIRECCION_NOTIFICACION_ARRENDADOR] - Correo [EMAIL_ARRENDADOR]
  </p>
  <p>
    EL ARRENDATARIO: Dirección [DIRECCION_NOTIFICACION_ARRENDATARIO] - Correo [EMAIL_ARRENDATARIO]
  </p>
  <p>[NOTIFICACION_CODEUDOR_CONDICIONAL]</p>

  <h2>DÉCIMA SEXTA. MORA, TERMINACIÓN Y RESTITUCIÓN LEGAL DEL INMUEBLE</h2>
  <p>
    En caso de mora igual o superior a [NUMERO_MESES_MORA] canon(es), EL ARRENDADOR podrá iniciar actuaciones
    legales para terminación y restitución conforme a la ley.
  </p>

  <h2>DÉCIMA SÉPTIMA. TERMINACIÓN</h2>
  <ol>
    <li>Vencimiento del plazo pactado.</li>
    <li>Mutuo acuerdo.</li>
    <li>Incumplimiento de obligaciones legales o contractuales.</li>
    <li>Causales previstas en normatividad colombiana aplicable.</li>
    <li>Demás causales reconocidas por la ley.</li>
  </ol>

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

  <h2>VIGÉSIMA. USO DE LA PLATAFORMA ARRIENDO SEGURO</h2>
  <p>
    Arriendo Seguro actúa como herramienta tecnológica de apoyo documental. No actúa como inmobiliaria, aseguradora,
    entidad financiera, abogado ni garante del cumplimiento.
  </p>

  [CLAUSULA_ACUERDOS_ESPECIALES_CONDICIONAL]
  [OBSERVACIONES_COMPLEMENTARIAS_CONDICIONAL]

  <h2>VIGÉSIMA PRIMERA. ACEPTACIÓN</h2>
  <p>
    Leído el presente contrato por las partes, y aceptado su contenido, se firma electrónicamente en la fecha
    registrada por la plataforma.
  </p>
  <p>
    EL ARRENDADOR: [NOMBRE_ARRENDADOR] - [DOCUMENTO_ARRENDADOR] - Firma: [FIRMA_ARRENDADOR] - Fecha:
    [FECHA_FIRMA_ARRENDADOR]
  </p>
  <p>
    EL ARRENDATARIO: [NOMBRE_ARRENDATARIO] - [DOCUMENTO_ARRENDATARIO] - Firma: [FIRMA_ARRENDATARIO] - Fecha:
    [FECHA_FIRMA_ARRENDATARIO]
  </p>
  <p>[FIRMA_CODEUDOR_CONDICIONAL]</p>
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

export const FIRMA_CODEUDOR = `
EL CODEUDOR SOLIDARIO:
Nombre: [NOMBRE_CODEUDOR]
Documento: [DOCUMENTO_CODEUDOR]
Firma electrónica: [FIRMA_CODEUDOR]
Fecha de firma: [FECHA_FIRMA_CODEUDOR]
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
      body { font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5; margin: 24px; }
      article { max-width: 900px; margin: 0 auto; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      h2 { font-size: 15px; margin-top: 20px; margin-bottom: 8px; }
      p, li { font-size: 13px; margin: 6px 0; white-space: pre-wrap; }
      ol { padding-left: 18px; }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}

