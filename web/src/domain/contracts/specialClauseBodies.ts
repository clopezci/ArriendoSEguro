/**
 * Redacción legal de las cláusulas especiales del catálogo predefinido.
 *
 * Estas cláusulas se imprimen en el contrato como acuerdos voluntarios
 * entre las partes (sin costo adicional para el usuario, porque el catálogo
 * es curado). Se redactan en lenguaje natural colombiano, respetando:
 *
 * - Ley 820 de 2003 (vivienda urbana): no contradecir el régimen base ni
 *   prohibir el uso pacífico del inmueble por parte del arrendatario.
 * - Constitución Política, art. 13 (no discriminación) y normatividad de
 *   propiedad horizontal (Ley 675 de 2001): las cláusulas se sujetan al
 *   reglamento de propiedad horizontal aplicable cuando existe.
 * - Habeas Data (Ley 1581 de 2012): no recolectamos datos sensibles en
 *   estas cláusulas.
 * - Las cláusulas son potestativas; un abogado deberá validar la versión
 *   `AS-LEASE-2026.2` antes de activarse oficialmente (Bloque 11 del plan).
 *
 * Cualquier ajuste a estos textos requiere revisión legal previa.
 */

/**
 * Identificador reservado para la opción de cláusula "Otra" (texto libre).
 * Debe mantenerse en sincronía con `SPECIAL_CLAUSE_OTHER_ID` en
 * `web/src/features/contracts/special-clauses.ts`. Lo replicamos aquí para
 * mantener la capa de dominio independiente de la capa de features (que es
 * client-side).
 */
export const SPECIAL_CLAUSE_OTHER_ID = "OTRA" as const;

export interface SpecialClauseBody {
  /** Título corto que se imprime como encabezado del bullet. */
  title: string;
  /** Cuerpo en español, sin HTML adicional al `<p>` que lo envuelve. */
  body: string;
}

export const SPECIAL_CLAUSE_BODIES: Record<string, SpecialClauseBody> = {
  MASCOTAS: {
    title: "Mascotas en el inmueble",
    body:
      "EL ARRENDATARIO podrá tener mascotas en el inmueble siempre que (i) mantenga al día las condiciones de aseo, " +
      "salud y vacunación que disponga la autoridad sanitaria, (ii) evite ruidos o molestias que afecten la convivencia " +
      "con los vecinos, (iii) respete el reglamento de propiedad horizontal aplicable y (iv) responda económicamente " +
      "por los daños imputables a la mascota tanto en el inmueble como en zonas comunes.",
  },
  FUMADORES: {
    title: "Política sobre humo de tabaco",
    body:
      "Las partes acuerdan que no se permite fumar al interior del inmueble. Los daños derivados del incumplimiento " +
      "de esta cláusula (manchas, olores persistentes, deterioro de pintura o muebles) podrán generar costos adicionales " +
      "de mantenimiento o limpieza profesional al momento de la restitución, los cuales serán asumidos por EL ARRENDATARIO " +
      "y descontados de eventuales saldos a su favor o cobrados por separado.",
  },
  PARQUEADERO: {
    title: "Uso de parqueadero o garaje",
    body:
      "Si el inmueble cuenta con cupo de parqueadero o garaje, este podrá ser usado por EL ARRENDATARIO conforme a las " +
      "condiciones señaladas en el inventario inicial y al reglamento de propiedad horizontal. EL ARRENDATARIO responderá " +
      "por los daños que su vehículo cause a las áreas comunes o al cupo asignado. No está permitido subarrendar el cupo " +
      "ni darle uso distinto al de estacionamiento sin autorización previa y escrita de EL ARRENDADOR.",
  },
  TELETRABAJO: {
    title: "Uso para teletrabajo o trabajo profesional",
    body:
      "EL ARRENDATARIO podrá usar el inmueble como espacio para teletrabajo o trabajo profesional, en los términos " +
      "permitidos por la Ley 2191 de 2022 y demás normas concordantes, siempre que dicho uso (i) no convierta el inmueble " +
      "en un establecimiento comercial abierto al público, (ii) no implique atención presencial de clientela en forma " +
      "habitual y (iii) no contravenga el reglamento de propiedad horizontal. Esta autorización no altera la destinación " +
      "del inmueble para vivienda urbana familiar.",
  },
  MOBILIARIO: {
    title: "Inmueble entregado amoblado",
    body:
      "El inmueble se entrega con el mobiliario, electrodomésticos y enseres que se relacionen en el inventario inicial " +
      "que hace parte integral de este contrato. EL ARRENDATARIO se obliga a conservar dichos bienes en buen estado y " +
      "a restituirlos al finalizar el contrato, salvo el deterioro normal derivado de su uso legítimo. Las pérdidas o " +
      "daños imputables a EL ARRENDATARIO serán reparados o reintegrados por él.",
  },
  ZONAS_VERDES: {
    title: "Mantenimiento de zonas verdes, patios o terrazas",
    body:
      "Las partes acuerdan que el cuidado básico de las zonas verdes, patios o terrazas del inmueble (riego, poda " +
      "menor, limpieza periódica) corresponderá a EL ARRENDATARIO. Las intervenciones mayores que requieran personal " +
      "especializado, así como las obras estructurales, seguirán siendo responsabilidad de EL ARRENDADOR y se coordinarán " +
      "con anticipación con EL ARRENDATARIO.",
  },
  SEGURIDAD: {
    title: "Alarmas, cámaras o sistemas de seguridad",
    body:
      "EL ARRENDATARIO podrá usar los sistemas de seguridad existentes en el inmueble (cerraduras, alarmas, cámaras), " +
      "cuidando su buen estado y funcionamiento. Cualquier cambio de cerraduras o instalación de elementos adicionales " +
      "deberá ser informado previamente y por escrito a EL ARRENDADOR, quien podrá conservar copia de las llaves o " +
      "acceso para efectos de restitución o emergencias, sin perjuicio del derecho del arrendatario al uso pacífico del " +
      "inmueble durante la vigencia del contrato.",
  },
};

/**
 * Devuelve la redacción legal de las cláusulas seleccionadas, excluyendo
 * la opción «Otra» (esa se renderiza aparte como texto libre con disclaimer).
 */
export function getSelectedClauseBodies(
  selectedIds: readonly string[],
): SpecialClauseBody[] {
  return selectedIds
    .filter((id) => id !== SPECIAL_CLAUSE_OTHER_ID)
    .map((id) => SPECIAL_CLAUSE_BODIES[id])
    .filter((body): body is SpecialClauseBody => Boolean(body));
}
