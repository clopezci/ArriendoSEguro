/** Inyecta un bloque JSON-LD (schema.org) sin escapar HTML en el JSON. */
export function JsonLdScript({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
