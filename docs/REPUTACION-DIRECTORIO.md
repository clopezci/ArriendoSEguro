# Directorio de reputación (consulta entre usuarios) — activación diferida

Permite que **usuarios registrados** consulten la reputación (agregado) de otro
usuario que **autorizó opt-in**, con la finalidad de evaluar un arriendo. Está
**construido pero APAGADO** hasta el visto bueno del abogado.

## Activar (SOLO tras validación legal)
En Vercel → Settings → Environment Variables:

```
NEXT_PUBLIC_REPUTATION_DIRECTORY_ENABLED = true
```

Redeploy. Mientras la variable no exista o no sea `true`, todo el directorio
está oculto y sus rutas responden 404.

## Diseño y cumplimiento (Ley 1581 de 2012)
- **Opt-in del titular**, revocable, con evidencia (fecha, versión de política,
  IP, user-agent) en `reputation_directory_consents`.
- La consulta devuelve **solo el agregado** (promedios + desglose por variable),
  nunca quién calificó ni el detalle por contrato.
- **Exige sesión** (no público, no búsqueda por cédula: se consulta por correo).
- Cada consulta queda **auditada** (quién consultó a quién).
- Convive con el **derecho de réplica/rectificación** y con la ponderación por
  recencia (el dato negativo pierde peso con el tiempo).

## Pendiente antes de encender
1. **Sign-off de abogado experto en Habeas Data / SIC.** Evaluar en especial si
   aplica la **Ley 1266 de 2008** (régimen de bancos de datos de información
   comercial/crediticia): notificación previa de dato negativo, caducidad del
   dato negativo, consulta gratuita del titular, etc.
2. **Registrar la base de datos en el RNBD** de la SIC.
3. Publicar la **cláusula de autorización** específica en el registro/onboarding
   y en la política de tratamiento de datos.

> Nota: no es asesoría legal. Requiere validación profesional antes de activar.
