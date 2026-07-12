# From Expert to Data Architect — Outlier EDU

> _(En el material aparece etiquetado como "Course 07" de Outlier EDU; es el 4.º curso que documentamos.)_
>
> Introducción a la anotación de datos para **expertos de dominio (subject matter experts)**. Explica cómo se usan **formatos específicos de datos** en el post-entrenamiento de modelos y da herramientas para **traducir la experticia abierta (open-ended) en datos legibles por máquina.**

---

## En este curso aprenderás
- El **"porqué"** de los formatos de datos de entrenamiento
- La **traducción** de conocimiento experto en datos humanos
- Un **caso de estudio**: Ground Truth Final Answers
- El conocimiento experto en **distintos formatos de datos**

**Idea marco:** este curso **tiende un puente entre la experticia profesional y los requisitos técnicos de un proyecto**. Ofrece un framework para convertir el conocimiento experto abierto en **datos de entrenamiento estructurados**, y luego un caso de estudio para aplicarlo en proyectos reales de anotación.

---

## ¿Por qué los LLM necesitan expertos humanos?

- La **experticia de dominio** es cada vez más valiosa para refinar los modelos más avanzados.
- Los datos scrapeados de internet + las preferencias del público general enseñan al modelo los **fundamentos** del lenguaje y el conocimiento común.
- **Pero los dominios expertos son un problema más difícil:** hay **menos datos de pre-entrenamiento** disponibles sobre temas de nicho.
- La experticia avanzada no es solo una colección de hechos de nicho: implica **pensamiento sintético y juicios bien entrenados** en contextos **profundos, complejos y ambiguos.**

> Cuanto mejor puedan los chatbots y agentes producir **ese tipo de razonamiento**, mejor sirven como herramientas y asesores de confianza para **amplificar el trabajo de los expertos.**

---

## El problema: Experticia vs. Datos

- La experticia es **compleja y open-ended.** Sintetizar métodos de laboratorio de varios subcampos, producir un argumento legal novedoso, o escribir un análisis cultural perspicaz requiere **contexto profundo de dominio** y **juicios refinados** que son **difíciles de expresar de forma cerrada y consistente.**
- Pero los métodos de post-entrenamiento funcionan mejor cuando los **datos siguen una plantilla estricta (template).**
- **La tensión fundamental:** la forma en que los modelos aprenden mejor **puede no ser** la forma en que tú expresas tu experticia. → **Hace falta traducción.**

> 💬 Ejemplo del autor del módulo: tiene un PhD en teoría literaria. Su primer proyecto de anotación requería preguntas de opción múltiple sobre conocimiento de posgrado; su examen de calificación había sido una serie de preguntas de ensayo de 15 páginas + un oral de 3 horas. **Hubo un desajuste de formato** — tuvo que ajustar su enfoque.

### Cambiar de rol: de experto de la materia a "arquitecto de datos"

- Convertir la experticia de forma libre en **datos estructurados útiles requiere traducción.**
- Con tu experticia, **ya tienes todo el know-how** para crear datos de altísima calidad. Lo único que necesitas es **empaquetarlo (package)** en las "cajas" que los algoritmos de ML pueden procesar.

---

## ¿Por qué importa esto?

- Como los modelos se pre-entrenan con un corpus enorme (casi todo internet), pueden quedar **sub-entrenados en los contextos y complejidades específicas que importan a los expertos.**
- Cuando un experto le pide ayuda con una **revisión de literatura nueva** o el **diseño de un experimento novedoso**, el modelo solo tiene **contexto superficial** para trabajar → el resultado son **respuestas erróneas, superficiales o incluso alucinaciones.**
- **La meta:** modelos que tengan el contenido y el contexto en sus datos de entrenamiento para servir como **asistentes profesionales útiles**, incluso en las tareas más complejas.

### La solución: datos de post-entrenamiento creados por expertos como tú

- Igual que las **certificaciones profesionales** y el **peer review** permiten a los profesionales juzgar el trabajo de otros, la **anotación de datos por expertos** permite a una comunidad de expertos de la materia **evaluar las capacidades de los modelos** e impartirles las **normas de conocimiento y razonamiento** de su campo.
- **Capturando escenarios expertos realistas** y juzgando/corrigiendo las respuestas del modelo, le das el conocimiento y contexto para ser un **socio genuino** (redactar una subvención, construir una prueba matemática, etc.).

---

## Caso de estudio: Ground Truth Final Answers (GTFA)

> ¿Cómo se ve esta "traducción" en la práctica? Se usa un formato común de anotación como caso de estudio: el **Ground Truth Final Answer (GTFA)**.

### Data Formats (formatos de datos)
- Sobre todo, traducir tu experticia a datos estructurados es prestar mucha atención a las **guidelines (directrices)** de cada proyecto.
- Cuando los expertos tienen dificultades con tareas de anotación, suele deberse más al **formato particular** que el proyecto busca producir que a su experticia profesional.
- Las directrices se escriben **en colaboración con los investigadores de IA** que usarán los datos para experimentar con sus modelos. Aunque el formato parezca arbitrario o inconveniente, **suele relacionarse directamente con el tipo de post-entrenamiento** que quieren hacer.

### ¿Qué es un GTFA?
- Un **Ground Truth Final Answer** es **un único número, palabra o frase** que es la (única) respuesta **correcta** a un prompt de chatbot.
- Piénsalo como la respuesta que pondrías **en una casilla al final** de tus cálculos en un examen de matemáticas.

### GTFA y RLVR
- Los GTFA son importantes para un tipo de post-entrenamiento llamado **RLVR (Reinforcement Learning with Verifiable Rewards).**
- En RLVR, las respuestas del modelo se califican contra un conjunto de prompts con **respuestas objetivas**. Si el modelo produce la respuesta correcta, recibe recompensa; si no, no. El **ciclo de recompensa** hace que el modelo "aprenda" a acertar más seguido.
- **RLVR ha dado excelentes resultados** avanzando las capacidades de los modelos en dominios como **matemáticas y programación**. Incluso tareas complejas de varios pasos son aptas para RLVR. Por ese éxito, muchos investigadores quieren usarlo en **otros dominios.**
- ⚠️ **Requisito clave:** para que RLVR funcione, la respuesta debe ser **absolutamente inequívoca (indisputably true)** — es decir, los prompts de entrenamiento **deben tener Ground Truth Final Answers.**

---

## GTFA + Experticia (el reto)

El formato GTFA puede ser **desafiante** para los expertos anotadores:
- La experticia de dominio suele implicar **razonamiento complejo, sintético y específico al contexto.**
- Los expertos de un campo a menudo **no están de acuerdo entre sí** sobre cuál es la mejor respuesta a una pregunta.
- En cambio, los GTFA deben ser **breves, rígidamente formateados e indiscutiblemente verdaderos** para servir en RLVR.

**Matices:**
- Incluso en dominios que tratan con **razonamiento deductivo**, los GTFA pueden ser un reto: hay muchas preguntas/tareas avanzadas que **no** se responden con un único valor definitivo (una prueba matemática completa o una arquitectura de software **no** dan un buen GTFA).
- En campos más **interpretativos**, crear prompts que reflejen razonamiento avanzado y **a la vez** tengan un GTFA es aún más difícil y contraintuitivo.
- Aun así, RLVR ha tenido éxito mejorando modelos en tareas open-ended más allá de las que tienen respuesta única, por eso los investigadores **buscan datasets de preguntas avanzadas con GTFA.**

---

## GTFA + Realismo

- Complicación extra: los prompts de entrenamiento con GTFA suelen ser más útiles cuando son **realistas.**
- **"Realista" es difícil de definir**, pero una definición práctica: *"Un prompt realista es uno que un usuario real de un chatbot, con una necesidad real del mundo real, podría escribir."*
- Cuando los datos reflejan **casos de uso reales**, los modelos mejoran en **necesidades reales.** Por eso los datasets deberían reflejar la **amplia gama de contextos, necesidades y flujos de trabajo** de los usuarios de IA.
- ⚠️ **Tensión (realismo vs verificabilidad):** en dominios expertos, el **realismo compite con tener un GTFA verificable.** Solo un pequeño subconjunto de problemas profesionales reales se responde con un único número o palabra.

> 🧭 Pensar en este tradeoff **realismo ↔ verificabilidad** es justo el ejercicio de pasar de experto de la materia a **arquitecto de datos.** Pregúntate: ¿hay situaciones reales de tu vida profesional donde escribirías a un chatbot algo que tenga un GTFA? Piensa en pasos intermedios de un proceso mayor (una revisión de literatura, un setup experimental) que sí tengan un GTFA — o el tipo de preguntas que ponen en tareas y exámenes.

---

## GTFAs en distintos dominios (ejemplos)

> Ejemplos de prompts expertos de un proyecto real que creaba un dataset con GTFA. Restricción adicional: el prompt debía **stumpear** a los modelos actuales (por eso los ejemplos balancean **realismo con un GTFA verificable**). En algunos campos parecen preguntas de examen; en campos interpretativos, un poco como acertijos (menos reflejo de necesidades reales).

| Dominio | ✅ Con GTFA verificable | ❌ Sin GTFA verificable (por qué falla) |
|---------|------------------------|------------------------------------------|
| **Mathematics** | "Considera el mayor natural N para el que existe un ciclo hamiltoniano válido para un grafo con vértices V={1,2,…,N}… ¿probabilidad de que un ciclo hamiltoniano elegido al azar…?" → **GTFA: 1/1716** | "Demuestra la desigualdad submartingala de Doob." → las **pruebas no tienen formato estandarizado** y hay muchas formas válidas de probar la misma conjetura. |
| **Economics** | "Dos firmas controlan la contaminación con abatimiento marginal MC₁… MC₂… Encuentra el costo total de abatimiento bajo un enfoque de comando-y-control." → **GTFA: 36** | "Discute los matices de una población que envejece… efectos de umbral que unen teorías clásicas y modernas de cambio demográfico." → relación **interpretativa, no factualmente resoluble.** |
| **Biology** | (prompt técnico muy específico sobre ratón taucopatía, secuenciación RNA, senescencia microglial…) → **GTFA: Bcl-2-associated X protein** | "Basado en reportes clínicos… factores específicos de resiliencia." → la respuesta es **comparable solo de forma vaga** ("comparable", "significativamente"). |
| **Law** | "He presentado demanda contra un corredor por incumplimiento de contrato y agravio (tort)… ¿qué doctrina puede impedir los daños al perseguirlos en distinta acción?" → **GTFA: Election of remedies** | "El concepto de 'Strict Liability' según *Rylands v Fletcher*…" → requiere una **interpretación de teoría legal que varía según el marco metodológico.** |

---

## El tradeoff en un campo cualitativo (Verificable ↔ Realista)

> Los investigadores querían prompts **desafiantes Y realistas** que **además** tuvieran GTFA verificables. En un campo interpretativo (p. ej. filosofía del lenguaje), esos requisitos **chocan**:

```
VERIFICABLE
Challenging  ←———————————————→  Realistic
(cuanto más desafiante,        (cuanto más realista,
 menos realista)                menos desafiante)
```

- **Muy desafiante, poco realista:** "Da el nombre del teórico que participó en un debate notorio con el profesor más famoso por extender el trabajo del filósofo del lenguaje de quien Judith Butler tomó la noción de speech act." *(acertijo con respuesta única, pero nadie preguntaría eso realmente.)*
- **Muy realista, poco desafiante:** "¿Quién desarrolló originalmente el concepto de speech act? No recuerdo su nombre." *(pregunta real, pero trivial.)*

> 🧭 **Navega el tradeoff con tu experticia profesional.** En campos interpretativos, prompts verificables y suficientemente desafiantes serán **inevitablemente algo menos realistas** que en STEM. Las preguntas cualitativas suelen implicar **interpretación y síntesis**, mientras que las de STEM avanzado más a menudo llevan a un **análisis complejo con un GTFA.** Aun así, hay estrategias para **acercar** tus prompts a "preguntas de examen de calificación" (qualifying exam).

### Cuatro estrategias para encontrar GTFA en campos cualitativos

| Estrategia | Qué es |
|-----------|--------|
| **Tricky objective tasks (tareas objetivas difíciles)** | ¿Tu campo tiene tareas objetivas difíciles? A menudo se batalla con ellas (p. ej. escansión/análisis métrico en literatura, sintaxis en lingüística, iconografía en historia del arte). |
| **Recent / detailed research** | Prompts sobre detalles de investigación académica reciente o los linajes de argumentos específicos → requieren experticia profunda **teniendo** un GTFA. Haz preguntas **más complejas que la mera recuperación** de datos. |
| **Highly specific facts (hechos muy específicos)** | En Historia, Literatura o Arte hay hechos oscuros que requieren un nivel experto de fuentes, pero que **tienen consenso experto**. |
| **Complex theoretical concepts** | Referencias a conceptos teóricos específicos pueden requerir conocimiento experto **manteniendo respuesta única.** Ej.: dado un marco teórico, hacer una pregunta objetiva sobre sus matices conceptuales o su historia. |

---

## Estrategia de "reverse engineering" para crear prompts (crafting)

> Un método que puede inspirar prompts **verificables pero desafiantes**. Experimenta y usa tu experticia. Se construye **al revés**: empiezas por la respuesta.

1. **Start with the GTFA:** piensa una frase o nombre específico de tu campo (teorías, autores, metodologías, conceptos, etc.) que sirva como **GTFA fuerte.**
2. **Add reasoning steps:** haz brainstorming de qué **cadena de razonamiento** podría llevar al GTFA. ¿Puedes trazar un paso metodológico, un argumento teórico, o una síntesis de fuentes que **desemboque** en esa respuesta?
3. **Construct the prompt:** arma el prompt para que la cadena de razonamiento quede **implícita, oculta o no-obvia.** Busca que sea realista, no arbitraria — que los matices conceptuales/metodológicos se sientan **acertijos semánticos**, no trampas.
4. **Iterate until the model is stumped:** repite. No añadas constraints arbitrarios; piensa en cómo **haría el razonamiento un estudiante de posgrado**, en vez de solo sacarle una mala respuesta con trampas.

### Checklist para prompts realistas

Quizá no logres un prompt de investigación 100% realista con GTFA, pero **puedes quitar antinaturalidad** preguntándote:
- ¿Esperaría que un **estudiante de posgrado real** del campo pudiera responder e interesarse por esta pregunta?
- ¿Mi prompt contiene **constraints arbitrarios** puestos solo para hacerlo más difícil?
- ¿Suena a lenguaje que usarías para **comunicarte con un colega**, y no con un chatbot?
- ¿Mi prompt es **más un acertijo que una pregunta** (ambigüedad rebuscada, cadenas largas de referencias, condiciones sobre-apiladas)?

### Ejemplo (aceptable pero mejorable)

> "A primera vista, las pinturas de 'más y menos' (plus and minus) de Piet Mondrian parecen una dispersión de formas al azar. Sin embargo, las obras son en realidad geométricas y basadas en una escena del mundo natural. La serie es notablemente geométrica… un paso en la transición progresiva de Mondrian hacia qué estilo de pintura. En tu respuesta, usa la terminología de Barr (1936) que distingue su estilo posterior, en comparación con el estilo usado en movimientos como el cubismo."

> 💡 Es **aceptable, pero podría ser más realista** — nota la dirección equivocada (misdirection) al final, que pide algo distinto (una *era*) que la pintura descrita en el cuerpo del prompt.

---

## Otros formatos de anotación de datos

> Se profundizó en GTFA porque es **muy distinto** de las preguntas de tu vida profesional. Otros formatos se **parecen más** a las formas que ya toma tu experticia:

| Formato | Cómo funciona |
|---------|---------------|
| **RLHF (RL con Human Feedback)** | El modelo se recompensa según las **preferencias subjetivas** de anotadores humanos. Calificas una respuesta en varias **dimensiones**, o comparas dos respuestas y eliges cuál prefieres. Sirve para tareas **totalmente open-ended**, como la escritura creativa. |
| **Rubrics (rúbricas)** | El modelo se recompensa según **cuánto puntúa en una rúbrica**. Creas una serie de **criterios sí/no** que definen las mejores respuestas posibles. Útil en contextos expertos donde las tareas **no dan buenos GTFA** pero sí hay mejores y peores formas de resolverlas (p. ej. desarrollar un marco metodológico). |

> 🔑 **La lección se mantiene:** aunque el formato sea rígido, **el formato del dataset es crítico** porque es clave para el tipo de entrenamiento en que se usará. Convierte esa frustración en creatividad: usa tu experticia para **equilibrar los tradeoffs** propios de cada formato.
> - Ej.: las **Rúbricas** tienen el tradeoff **especificidad ↔ generalidad** — los criterios deben ser inclusivos del rango completo de buenas respuestas al prompt, **pero** lo bastante específicos para no premiar respuestas malas. Frustrante, sí, pero es un **ejercicio interesante de juicio profesional.**

---

## Best practices para abordar la anotación experta

El formato y los requisitos varían por proyecto y dominio, pero hay principios transversales:

- **Sweat the details (cuida los detalles):** presta atención a **todos** los requisitos y necesidades de formato del proyecto.
- **Draw on your experience (apóyate en tu experiencia):** los mejores datos vienen de **escenarios y necesidades reales**; considera tu experiencia al crear prompts o construir rúbricas.
- **Translate your knowledge (traduce tu conocimiento):** aunque los datos no reflejen tu día a día, quizá no estés escribiendo prompts para un LLM en apuros — pero **sigues siendo el experto** y aprendes cómo pueden fallar los modelos. No te saltes el proceso: puedes **capturar el conocimiento esencial, las metodologías y los modos de razonamiento** de tu dominio en los datos.
- **Consider tradeoffs (considera los tradeoffs):** como mostró el ejemplo del GTFA, no siempre podrás traducir tu conocimiento directamente al formato confinado del training data. Ahí es donde tu **juicio profesional** entra en juego: captura la **esencia** del razonamiento de tu dominio. Considera los tradeoffs entre **realismo, complejidad, verificabilidad y precisión.**

---

## Quiz final (10 preguntas) — respuestas

1. **¿Por qué es necesario el conocimiento experto de dominio para entrenar modelos avanzados?**
   → **B)** A los modelos les falta suficiente data de pre-entrenamiento en temas de nicho, quedando con solo contexto superficial que puede causar alucinaciones o respuestas erróneas.
2. **¿Cómo define el curso un Ground Truth Final Answer (GTFA)?**
   → **C)** Un único número, palabra o frase que es la (única) respuesta correcta a un prompt de chatbot.
3. **En RLVR, ¿qué determina si el modelo recibe recompensa?**
   → **D)** Recibe recompensa si produce la **respuesta objetiva correcta** al ser calificado contra el GTFA del prompt.
4. **¿Cuál es el tradeoff principal al crear prompts GTFA, sobre todo en campos interpretativos?**
   → **B)** El tradeoff entre **realismo y verificabilidad**, porque solo un pequeño subconjunto de problemas profesionales reales se responde con un único número o palabra.
5. **En un campo cualitativo, ¿qué estrategia sugiere el curso para usar conceptos teóricos complejos y crear GTFA verificables?**
   → **B)** Hacer una **pregunta objetiva** sobre los matices conceptuales o la historia de un marco teórico específico.
6. **En la estrategia de "Reverse Engineering", ¿cuál es el primer paso recomendado?**
   → **C)** Empezar por el **GTFA**, pensando una frase o nombre muy específico de tu campo.
7. **¿Qué formato de datos es mejor para tareas totalmente open-ended (como escritura creativa) donde se premia según elecciones subjetivas humanas?**
   → **B)** Reinforcement Learning with Human Feedback (RLHF).
8. **Según el "Checklist de prompts realistas", ¿qué señal indica que un prompt quizá NO es lo bastante realista?**
   → **C)** Contiene **constraints completamente arbitrarios** puestos solo para hacerlo más difícil.
9. **Al evaluar el formato Rubrics, ¿cuál es el tradeoff principal al crear criterios?**
   → **B)** El tradeoff entre **especificidad** (no premiar respuestas malas) y **generalidad** (ser inclusivo con todas las buenas respuestas posibles).
10. **Al traducir tu conocimiento a datos estructurados, ¿cómo manejar que los formatos de IA no calcen perfecto con tu flujo profesional diario?**
    → **C)** No te saltes el proceso; considera cómo **capturar el conocimiento esencial y los modos de razonamiento** de tu dominio **dentro del formato requerido.**

**Resumen de letras:** 1→B · 2→C · 3→D · 4→B · 5→B · 6→C · 7→B · 8→C · 9→B · 10→C

---

## Reflexiones finales (Final thoughts)

- El núcleo de traducir el conocimiento experto en datos usables es la **atención al detalle.** Los formatos son rígidos **porque reflejan cómo aprenden los modelos.**
- **Sigue primero los requisitos de formato.** Luego pregúntate:
  - ¿Cómo equilibro mejor el tradeoff entre **requisitos y realismo**?
  - ¿Cómo trabajo **dentro de los límites** del proyecto capturando a la vez la **amplitud y profundidad** de mi experticia?
  - ¿Cómo expreso los **matices** de mi dominio dentro de las restricciones del training data estructurado?
  - ¿Qué partes de mi flujo profesional **encajan** mejor en estos formatos, y cuáles quizá deba **dejar fuera**?
- Trabajar dentro de estas restricciones puede ser frustrante, pero es una **oportunidad de ejercer tu juicio y creatividad profesional.** Es precisamente **tu experticia de dominio** la que guía los tradeoffs que haces como **arquitecto de datos.**

> 🎉 **Tu experticia ayudará a refinar la próxima frontera de los modelos de IA.**

---

## Resumen ejecutivo (para llevar)

- **Tu nuevo rol = "arquitecto de datos":** traducir/empaquetar tu experticia open-ended en el formato estricto que los algoritmos de ML pueden procesar.
- **Por qué:** los modelos están sub-entrenados en dominios de nicho → dan respuestas superficiales o alucinaciones. Los expertos aportan las **normas de conocimiento y razonamiento** de su campo.
- **GTFA (Ground Truth Final Answer):** único número/palabra/frase que es la respuesta correcta. Alimenta el **RLVR** (RL con recompensas verificables), que brilla en matemáticas/código.
- **Tensiones a navegar con juicio profesional:**
  - **Realismo ↔ Verificabilidad** (GTFA): pocos problemas reales tienen respuesta única.
  - **Especificidad ↔ Generalidad** (Rubrics): inclusivo con lo bueno, pero que no premie lo malo.
- **Encontrar GTFA en campos cualitativos:** tareas objetivas difíciles · investigación reciente/detallada · hechos muy específicos con consenso · conceptos teóricos complejos.
- **Reverse engineering:** empieza por el GTFA → construye la cadena de razonamiento → escóndela en el prompt → itera pensando como estudiante de posgrado (no con trampas).
- **Otros formatos:** RLHF (preferencias subjetivas, tareas open-ended) · Rubrics (criterios sí/no para tareas sin GTFA).
- **Best practices:** cuida los detalles · apóyate en tu experiencia · traduce tu conocimiento · considera los tradeoffs (realismo, complejidad, verificabilidad, precisión).
