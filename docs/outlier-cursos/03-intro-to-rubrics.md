# Intro to Rubrics — Outlier EDU

> _(En el material aparece etiquetado como "Course 02" de Outlier EDU; es el 3.º curso que documentamos.)_
>
> Introducción fundamental a las **rúbricas (rubrics)**, un tipo de **dato de post-entrenamiento** que Outlier entrega con frecuencia a sus clientes. Muestra que los principios para crear buenas rúbricas están enraizados en cómo se usan para **mejorar los LLM** que usamos a diario.

---

## En este curso aprenderás
- Qué **es** una rúbrica
- **Pre-training** y **Post-Training**
- **Principios** de rúbricas útiles
- El **arte** de componer rúbricas

> Este curso se enfoca en las rúbricas, un tipo **muy especial de dato de post-entrenamiento** que Outlier crea a menudo para sus clientes.

---

## ¿Qué es una rúbrica?

> **Una rúbrica es, simplemente, una lista de verificación (checklist) de criterios adjunta a un prompt.**

**Cómo se compone una rúbrica (proceso del anotador):**
1. Se parte de un **prompt**.
2. El anotador **imagina cómo sería la respuesta ideal** a ese prompt.
3. El anotador **descompone las características (features)** de esa respuesta ideal en un **conjunto de criterios**.

### Ejemplo simple

**Prompt:** "¿Quién fue el segundo presidente de EE. UU.? Solo el nombre."
**Respuesta ideal:** "John Adams."

Se convierte esa respuesta ideal en una rúbrica con **dos criterios**:
- **Criterio #1:** "La respuesta identifica al segundo presidente de EE. UU. como John Adams."
- **Criterio #2:** "La respuesta contiene solo un nombre."

**Cómo se usa:**
- Una respuesta que **cumple ambos** criterios → **perfecta.** ✅
- Una respuesta que cumple **solo uno** → **peor.** ❌

> 💡 Este ejemplo es muy simple, pero las rúbricas son una **herramienta poderosa** que puede enseñar a los modelos de IA a realizar **tareas muy complejas y abiertas (open-ended).**

---

## Contenido

## ¿Para qué se usan las rúbricas?

**Definición ampliada:** las rúbricas son **extremadamente útiles para el post-entrenamiento** porque **equilibran** entre dos extremos:
- enseñarle al modelo **un output exacto**, y
- darle solo **preferencias humanas vagas**.

Ese equilibrio las hace útiles para enseñar a los modelos a responder prompts que piden respuestas **open-ended pero estructuradas** (abiertas pero con estructura).

**Por qué importa:** muchas tareas que queremos que los LLM hagan mejor son **abiertas pero estructuradas**:
- razonar un problema de matemáticas,
- analizar un poema desde una perspectiva específica,
- ofrecer un diagnóstico médico,
- preparar una estrategia de negocio.

> Estas tareas **pueden no tener una única respuesta objetivamente correcta**, pero **expertos humanos pueden escribir una serie de criterios** que permitan **distinguir una mejor respuesta de una peor**. Eso es exactamente lo que hace una rúbrica.

---

## Pre-training y Post-training

**Pre-training (preentrenamiento):**
- Los LLM son representaciones matemáticas del lenguaje, entrenadas con **enormes cantidades de texto** para aprender los patrones del lenguaje. Ese proceso es el **pretraining**.
- Analogía: es (muy a grandes rasgos) como un **bebé aprendiendo a hablar** — por exposición a muchísimo lenguaje real, el modelo aprende a predecir qué **token** (palabra o parte de palabra) es más probable que venga después.
- Requiere una **cantidad gigante** de texto (p. ej. todo internet).
- ⚠️ **Limitación:** el pretraining solo enseña a **responder** a un texto de entrada; **no** enseña a dar una **buena** respuesta.

**Post-training (post-entrenamiento):**
- Aquí el modelo recibe **menos texto**, pero ese texto ha sido **anotado** para **aumentar su calidad**. Es donde se le enseña a dar buenas respuestas.
- **Los anotadores humanos son parte crítica del post-training.**

---

## Tipos de post-training

Usando el aprendizaje humano como analogía aproximada:

| Tipo | Qué es | Analogía humana |
|------|--------|-----------------|
| **Evaluation (Evaluación)** | Calificar las respuestas del modelo contra un **benchmark** para medir su desempeño. Solo **prueba lo que el modelo ya sabe** (no le enseña). | Hacer un examen en el colegio |
| **Supervised Fine-Tuning (SFT)** | Mostrarle al modelo un **prompt + la respuesta ideal**. El modelo aprende a **ajustar** sus respuestas futuras para parecerse a la ideal. | Memorización / ejercicios repetidos (drills) |
| **Reinforcement Learning (RL)** | Calificar las respuestas del modelo y luego **darle feedback** para que mejore. | Corregir tarea / calificar un ensayo |

> 👤 **Rol del anotador humano:** contribuye escribiendo las **respuestas ideales para SFT** o **calificando respuestas del modelo para RL**.

---

## Tipos de Reinforcement Learning (aquí encajan las rúbricas)

El RL tiene varios subtipos (**las rúbricas están entre ellos**). Cada tipo enseña bien ciertas tareas:

| Subtipo | Cómo califica | Funciona mejor para… |
|---------|---------------|----------------------|
| **RLVR** — RL con **Verifiable Rewards** (recompensas verificables) | Califica las respuestas contra una **respuesta objetiva** y premia cuando acierta. Por ensayo y error, el modelo aprende a acertar más seguido. | Tareas con **respuesta correcta bien definida**, como **matemáticas** |
| **RLHF** — RL con **Human Feedback** (retroalimentación humana) | Califica las respuestas contra **preferencias humanas subjetivas**. Cuando los humanos premian una respuesta, el modelo aprende a dar respuestas parecidas. | Tareas donde la respuesta correcta es muy **open-ended** y sujeta a preferencia humana, como **escribir un poema** |

> 🧩 **Dónde encajan las rúbricas:** entre estos dos extremos. Sirven para tareas **open-ended pero estructuradas** — demasiado abiertas para RLVR (no hay una única respuesta verificable) pero demasiado estructuradas para dejarlas solo a la preferencia vaga de RLHF. La rúbrica aporta **criterios objetivos y verificables** sobre una tarea abierta.

---

## Las rúbricas equilibran objetividad (RLVR) y subjetividad (RLHF)

Cómo funciona el proceso con rúbricas, paso a paso:
1. Los **anotadores humanos escriben un conjunto de criterios sí/no (yes/no)** que definen qué características debe tener la mejor respuesta a un prompt dado.
2. Luego ellos (u otro modelo) **califican la respuesta del modelo en cada criterio**.
3. Las rúbricas permiten que el modelo **aprenda preferencias humanas**, pero con un proceso de aprendizaje **más objetivo y granular** que el RLHF.

**Para qué funcionan muy bien:** tareas **parcialmente open-ended** que, a la vez, tienen claramente **mejores y peores maneras** de resolverse — como dar con una buena receta, hacer un plan de tratamiento para un paciente, o escribir un email delicado a tu jefe.

---

## Entonces, ¿qué es realmente una rúbrica? (dos metáforas)

| ❌ Metáfora "rúbrica de calificación" (grading rubric) | ✅ Metáfora "receta" (recipe) — la útil |
|--------------------------------------------------------|------------------------------------------|
| Como las rúbricas de ensayos del colegio: varias **dimensiones** y **definiciones** de cómo ganar cada nota (1, 2, 3, 4) por dimensión. | Al **componer** tus propias rúbricas, es más útil pensarlas como **una receta para la respuesta ideal**. |
| Sirve como metáfora aceptable: en IA distinguen respuestas **mejores y peores** a prompts más open-ended. | Una **checklist exhaustiva** de todo lo que el modelo necesita para dar la **respuesta perfecta** al prompt. |
| | Te pones en la mentalidad de un **chef escribiendo la receta perfecta** para que el modelo la siga. La receta es un conjunto de criterios **específicos, simples, sí/no** que juntos producen la respuesta perfecta. |

> 🔑 **Mentalidad correcta al escribir una rúbrica:** piensa como un chef. No estás "poniendo notas" — estás escribiendo la **receta exacta** de la respuesta ideal, criterio por criterio.

---

## Ejemplos simples de rúbricas

**Ejemplo 1 — Task Prompt:** "¿Cuál es una receta simple de un postre que disfrutarían niños de 3 a 5 años?"
**Rúbrica:**
- La respuesta sugiere un postre apropiado para niños de 3–5 (p. ej. galletas con chispas, cupcakes, Rice Krispies).
- La respuesta menciona **al menos una razón** por la que el postre es adecuado para niños (p. ej. poco desorden, fácil de moldear, alternativa más saludable).
- La respuesta explica **por qué la receta es simple** (p. ej. menos de 10 ingredientes, menos de 10 pasos, poco tiempo de preparación).

> 💡 Nota: esta rúbrica cubre **tanto lo explícito** del prompt ("receta simple", "postre que disfruten niños de 3–5") **como una petición implícita** que la hace aún mejor ("por qué el postre es adecuado para niños").

**Ejemplo 2 — Task Prompt:** "¿Qué actividad de interior divertida hay para niños de 3–5 en un día lluvioso?"
**Rúbrica:**
- La respuesta sugiere una actividad de interior apropiada para 3–5 (p. ej. construir con bloques, circuito de obstáculos indoor, hora del cuento).
- La respuesta menciona **cómo la actividad ayuda al desarrollo** (p. ej. motricidad fina, creatividad, interacción social).
- La respuesta **reconoce que la actividad es adecuada para un día lluvioso** ("indoors", "día lluvioso", "cuando está mojado afuera").

> 💡 Igual que antes: cubre lo **explícito** ("actividad de interior", "para día lluvioso") **y** lo **implícito** que la mejora ("cómo la actividad ayuda al desarrollo").

> 🎯 **Patrón de una buena rúbrica:** captura los criterios **explícitos** del prompt **+** criterios **implícitos** que un experto sabría que hacen mejor la respuesta.

---

## ¿Cómo aprende un modelo de una rúbrica?

1. Se le **alimentan al modelo** la rúbrica + un conjunto de **respuestas de muestra**.
2. El modelo **califica las respuestas contra la rúbrica** y **suma los puntajes** para ver cuáles son mejores y peores.
3. Así el modelo **aprende cómo lucen las características de las respuestas mejores y peores.**

---

## Principios de rúbricas útiles

> Para que el modelo aprenda bien de una rúbrica, esta debe estar **estructurada de una forma muy específica**, o el modelo **podría aprender cosas equivocadas.**

**El objetivo: criterios MECE.** Las rúbricas son muy específicas a cada prompt, pero la meta es un conjunto de criterios:
- **Mutually Exclusive (mutuamente excluyentes):** no deben solaparse.
- **Collectively Exhaustive (colectivamente exhaustivos):** juntos, deben **definir por completo** la respuesta ideal.

**MECE se logra siguiendo 3 principios:**

| Principio | Regla | En una frase |
|-----------|-------|--------------|
| ❄️ **Atomicity (Atomicidad)** | Cada criterio debe cubrir **exactamente un** aspecto. | Un criterio = una sola cosa. |
| 🎯 **Specificity (Especificidad)** | Los criterios deben indicar **con precisión** lo que se espera. | Nada de vaguedad. |
| 🌀 **Self-containment (Autocontención)** | Cada criterio debe contener **toda la información** necesaria para evaluar una respuesta. | El criterio se explica solo. |

### Por qué importan (para el anotador y para el modelo)

- **Para el anotador:** seguir MECE asegura que abordas la rúbrica de forma **analítica y exhaustiva**.
- **Para el modelo:** MECE asegura que **aprende lo correcto** de las rúbricas.
  - Si los criterios **se solapan** → el modelo puede darles **demasiada importancia** (peso doble a lo mismo).
  - Si **no son exhaustivos** → el modelo puede **no aprender todo** lo necesario para una respuesta perfecta.

> ⚠️ Los principios son **simples de enunciar**, pero **aplicarlos puede ser complejo.**

---

## Ejemplo del principio de ATOMICIDAD — la lista del súper

**Escenario:** tu pareja te pide comprar unas cosas camino a casa y te manda esta lista por texto:
> → Harina
> → Huevos
> → Chispas de chocolate
> → Vainilla y sal
> → Azúcar (granulada y morena clara)

**Attempt #1 — qué sale mal:**
- Compras harina, huevos y chispas de chocolate → los **tachas** sin problema.
- Encuentras **sal, pero no vainilla**. Y hay **azúcar granulada, pero no morena clara**.
- **No puedes tachar** esos ítems… porque **no conseguiste todo lo que el ítem agrupaba.**

> 🔑 **La lección de atomicidad:** los ítems "**Vainilla y sal**" y "**Azúcar (granulada y morena clara)**" **NO son atómicos** — cada uno mezcla **dos cosas** en una sola línea. Al no ser atómicos, no puedes marcarlos como cumplidos/no cumplidos de forma limpia (conseguiste una parte pero no la otra). En una rúbrica pasa igual: **si un criterio junta dos aspectos, una respuesta puede cumplir uno y no el otro, y ya no sabes cómo calificarlo.** Por eso **cada criterio debe ser atómico = un solo aspecto.**

**La catástrofe (por qué la falta de atomicidad hace daño):** llegas a casa antes que tu pareja y le dejas la lista para que termine la compra. Ella agarra **vainilla y sal** + **ambos tipos de azúcar**. 😳 **¡Catástrofe!** Ahora tienes **doble sal y doble azúcar granulada**, porque cada uno siguió *exactamente* lo que decía la lista no-atómica y los ítems agrupados se compraron de nuevo enteros.
> **Qué pasó:** la lista **no era atómica**. Tu pareja siguió al pie de la letra lo que había, pero eso **la llevó por mal camino.**

**La lista corregida (atómica):** si la lista hubiera sido atómica desde el principio, esto no habría pasado. Cada ítem en **su propia línea**:
> Harina · Huevos · Chispas de chocolate · **Vainilla** · **Sal** · **Azúcar (granulada)** · **Azúcar (morena clara)**
> → **Mucho más claro.** Cada ítem se puede tachar por separado.

### Atomicity: definición y ejemplo en una rúbrica real

> **Atomicity:** cada criterio de la rúbrica debe evaluar **exactamente un aspecto distinto**. Evita agrupar varios criterios en uno solo. La mayoría de los criterios apilados con la palabra **"and" (y)** se pueden **partir en varias piezas**.

**Ejemplo (segundo presidente / George Washington):**
- ❌ **No atómico:** "La respuesta identifica a George Washington como el primer presidente de EE. UU. **y** menciona que sirvió dos mandatos." *(dos aspectos en un criterio)*
- ✅ **Atómico (partido en dos):**
  - "La respuesta identifica a George Washington como el primer presidente de EE. UU."
  - "La respuesta menciona que George Washington sirvió dos mandatos."

> 💡 **Truco práctico:** si un criterio tiene un **"y"**, probablemente puedes (y debes) **partirlo** en dos criterios atómicos.

---

## Ejemplo del principio de ESPECIFICIDAD — la lista (Attempt #2)

**La lista ya es atómica** (arreglamos el problema anterior). Se la mandas a tu pareja:
> Harina · Huevos · Chispas de chocolate · Vainilla · Sal · Azúcar (granulada) · Azúcar (morena clara)
> — "Sí, ¡entendido!" 🙂

**Attempt #2 — 😖 ¡Catástrofe otra vez!** Tu pareja vuelve del súper y:
- Querías hornear **galletas con chispas de chocolate**, pero tu pareja trajo **mantequilla con sal (salted butter)** y **sal de mesa (table salt)**.
- **¡Eso no sirve** para tu propósito!

> 🔑 **La lección de especificidad (planteada):** la lista era atómica, pero **no era específica**. "Sal" y "mantequilla" no bastan: no dijiste *qué tipo*. Faltó **precisar exactamente lo que se esperaba** (sal kosher/sin sal, mantequilla sin sal, etc.).

**La lista vaga vs la específica:**
- ❌ **Vaga:** "Harina · Chispas de chocolate · Sal" → demasiado margen de interpretación; tu pareja no puede traer *exactamente* lo que querías.
- ✅ **Específica:** "3 tazas de harina de uso general · 1 taza de chispas de chocolate (semisweet) · 1 cdta de sal (apta para finishing) · 2 huevos grandes · 2 cdta de extracto de vainilla · 1 taza de azúcar granulada · 1 taza de azúcar morena clara" → **mucho más detallado.**

### Specificity: definición y ejemplo en una rúbrica real

> **Specificity:** los criterios deben indicar **con precisión** lo que se espera. Deben ser **binarios (verdadero/falso)**. Evita descripciones vagas (p. ej. "la respuesta debe ser precisa"): añade detalle para que el criterio sea **lo más objetivamente calificable posible.**

**Ejemplos (vago → específico):**
- ❌ "La respuesta es concisa." → ✅ "La respuesta tiene **500 palabras o menos**."
- ❌ "La respuesta está bien formateada." → ✅ "La respuesta **usa formato para distinguir elementos**, como viñetas o una lista numerada."
- ❌ "La respuesta incluye evidencia suficiente." → ✅ "La respuesta **cita al menos dos fuentes revisadas por pares publicadas en una revista académica después de 2020**."

> 💡 El detalle extra es lo que hace que el criterio sea **objetivamente calificable** (cualquiera que lo aplique llega al mismo veredicto).

---

## Ejemplo del principio de SELF-CONTAINMENT (autocontención) — la lista (Attempt #3)

**La lista ya es específica** ("1 cdta de sal apta para finishing"). Pero…

**Attempt #3 — el problema:** tu pareja llega al súper, intenta **buscar qué tipo de sal** es "apta para finishing", pero… **no hay señal wifi.** 🧐 Toma su mejor conjetura: sal Kosher gruesa (para tener cristales grandes y sabrosos). El criterio **era específico, pero no contenía toda la información** necesaria para actuar **sin investigar por fuera**.

**La lista con toda la info (corrección):**
- ❌ **La que hay que buscar:** "1 cdta de sal (apta para finishing)" → específica, pero exige investigación externa.
- ✅ **La autocontenida:** "1 cdta de sal (apta para finishing, **lo que significa que tiene escamas delicadas y uniformes que se disuelven despacio sobre galletas tibias, como la sal marina Maldon**)" → ahora tu pareja **tiene todo lo que necesita, sin wifi.**

### Self-Containment: definición y ejemplos en una rúbrica real

> **Self-Containment:** cada criterio debe contener **toda** la información necesaria para evaluar una respuesta. Cada criterio debe ser **verificable sin requerir investigación externa.**

**Ejemplos (incompleto → autocontenido):**
- ❌ "La respuesta menciona la capital de Canadá." → ✅ "La respuesta menciona que la capital de Canadá **es Ottawa**."
- ❌ "La respuesta nombra a uno de los ganadores del Nobel de Física de 2023." → ✅ "La respuesta nombra a uno de los ganadores del Nobel de Física de 2023, **que fueron Pierre Agostini, Ferenc Krausz y Anne L'Huillier**."

> 📝 **Nota importante:** a veces **no es posible una respuesta directa y específica**, así que se recurre a **ejemplos**. Por ejemplo, si el prompt pide "3 alternativas al avión para viajes intercontinentales más eficientes", podrías escribir el criterio así: "La respuesta ofrece 3 alternativas al avión para viajes intercontinentales más eficientes, **como veleros, buques de carga, transatlánticos y trenes de alta velocidad**."

> 🔑 **La diferencia entre Specificity y Self-Containment** (fácil de confundir):
> - **Specificity** = el criterio dice **con precisión qué se espera de la respuesta** (binario, detallado). Ataca la vaguedad.
> - **Self-Containment** = el criterio incluye **la información/respuesta correcta necesaria para poder evaluarlo** sin buscar nada afuera. Ataca la dependencia de fuentes externas.
> En el ejemplo de la sal: ser "específico" fue decir *qué tipo* de sal; ser "autocontenido" fue **explicar qué significa** ese tipo, para no tener que googlearlo.

---

## El arte de componer rúbricas

> Escribir buenas rúbricas es difícil: imaginar la respuesta ideal y descomponerla en criterios sí/no requiere **creatividad y pensamiento analítico**. La práctica es la mejor maestra, pero hay conceptos que fortalecen tu forma de pensar.

**Tres conceptos que ayudan** (nota: en algunos proyectos de anotación los etiquetas explícitamente en tu rúbrica; en otros no aparecen explícitos):

| Concepto | Qué es |
|----------|--------|
| 📏 **Dimensions (Dimensiones)** | Los criterios deben cubrir **varios aspectos** de una respuesta ideal (factualidad, formato, conciencia del contexto, etc.). |
| 📕 **User Instructions (Instrucciones del usuario)** | Las mejores rúbricas cubren **todas las peticiones explícitas** del prompt **y** consideran **mejoras implícitas**. |
| 🏋️ **Weighting (Ponderación)** | Los criterios deben considerar las **necesidades absolutas**, lo **importante** y los **"nice-to-haves"** (deseables). |

> 💡 **Por qué importa doble:** estos conceptos no solo dan al anotador una estructura para pensar rúbricas de prompts complejos, sino que **aportan datos más ricos al LLM** para que aprenda de forma más granular qué hace buena o mala una respuesta. Cuando los humanos **categorizan y ponderan** los criterios, el LLM obtiene **información más profunda** sobre cómo entender las preferencias humanas.

---

## Concepto 1 — DIMENSIONS (dimensiones)

**Escenario (galletas con chispas):** no tienes una receta en mente, así que le pides ayuda a tu chatbot. Hay muchas formas de hacer galletas → ¿cómo sabes si hizo un buen trabajo? Quieres que la receta **siga cada dimensión de tu petición**, cubra necesidades **dichas y no dichas**, e incluya no solo lo importante sino también los **bonus**.

**Descomponer la receta en componentes (= dimensiones):**
- **Accuracy (Exactitud):** si la receta dijera hornear a 100 °F, tendrías masa cruda tibia → los datos deben ser correctos.
- **Completeness (Completitud):** si solo listara los ingredientes sin decir cómo combinarlos, no serviría.
- **Communication Quality (Calidad de comunicación):** es mucho más útil si los pasos van en **lista numerada** que en un solo bloque de texto.

### Las dimensiones más comunes de una rúbrica

> Las dimensiones son simplemente **distintos aspectos de una respuesta ideal**. A veces un proyecto se enfoca en una dimensión concreta, pero tenerlas en mente siempre ayuda a hacer **rúbricas comprensivas** (brainstorming).

| Dimensión | Pregunta que responde |
|-----------|----------------------|
| **Accuracy / Factuality** | ¿Los hechos son correctos? ¿La respuesta se alinea con el conocimiento experto/objetivo? |
| **Completeness (Completitud)** | ¿La respuesta cubre **todas** las partes de la petición, tanto **explícitas como implícitas**? |
| **Communication Quality** | ¿La explicación es clara, bien estructurada y fácil de seguir? |
| **Context Awareness (Conciencia del contexto)** | ¿El modelo entiende la situación, el entorno o el rol del usuario? |
| **Instruction Following** | ¿El modelo hizo lo que el prompt pidió? (p. ej. seguir formato, alcance o longitud) |

---

## Concepto 2 — USER INSTRUCTIONS (instrucciones del usuario)

**Escenario:** ingresas este prompt:
> "Estoy horneando galletas con chispas de chocolate para el cumpleaños de mi sobrina. Van a ir 20 niños. Dame una receta. Sin nueces, es alérgica."

**Peticiones EXPLÍCITAS** (las dijiste directamente y la respuesta *debe* cumplir):
- Debe tener una receta de galletas con chispas de chocolate.
- La receta debe alcanzar para **20 niños**.
- La receta **no debe incluir frutos secos / nueces (tree nuts)**.

**Peticiones IMPLÍCITAS** (no las dijiste, pero las esperarías):
- La respuesta debe estar **formateada como receta**, con lista de ingredientes y pasos numerados (no un bloque de texto).
- La receta probablemente debería usar **chocolate semi-dulce, no amargo**, porque a los niños suelen gustarles los sabores dulces y no los amargos.

> 🔑 **La lección de User Instructions:** una gran rúbrica **traduce el prompt** en criterios que cubren **lo explícito** (lo que el usuario pidió textual) **y lo implícito** (lo que un experto sabe que el usuario espera aunque no lo diga). Esto conecta con la dimensión de **Completeness**.

### Criterios explícitos vs implícitos

| **Explícitos** 👀 | **Implícitos** ☁️ |
|-------------------|-------------------|
| Lo que dijiste **directamente**: receta de galletas con chispas, para 20 niños, sin nueces. | Las **otras expectativas** que **no mencionaste** en el prompt. |
| En una rúbrica, serían todos **criterios explícitos**: los declaraste, y cualquier buena respuesta los incluiría. | Que no lo dijeras **no significa que no importen** para la calidad. Te molestaría una respuesta que te diera la receta como **muro de texto** o que sugiriera **granos de espresso en galletas para niños**. |

---

## Concepto 3 — WEIGHTING (ponderación)

**Escenario (galletas, una última vez):** al juzgar la calidad de la receta, **algunas cosas importan más que otras.** Los criterios se agrupan por importancia:

| Nivel | Qué es | Ejemplo en la receta |
|-------|--------|----------------------|
| **Mandatory (Obligatorio)** | Sin esto, no es la respuesta pedida. | Una receta que **olvida la harina o las chispas de chocolate** ni siquiera es una receta de galletas con chispas. |
| **Valuable (Valioso)** | Importante para la calidad, pero no rompe la respuesta si falta. | La **vainilla** o la **sal** en la masa: importan al sabor, pero seguirías teniendo galletas reconocibles sin ellas. |
| **Nice-to-have (Deseable)** | Añade un extra; totalmente aceptable sin ello. | **Escamas de sal marina** o **azúcar glas** espolvoreadas encima al final. |

### Cómo se expresan: los pesos (weights)

> Al modelo se le indica la **importancia relativa** de cada criterio mediante **pesos (weights)**. La escala varía — puede ser de **1 a 5**, o incluso incluir **pesos negativos** en una escala de **-10 a 10** — pero los pesos aseguran capturar **cada aspecto** de la respuesta ideal, desde lo obligatorio hasta lo "above-and-beyond".

**Ejemplo de rúbrica con pesos:**
1. La receta incluye 500 g de harina → **(+10, obligatorio)**
2. La receta incluye 2 cdta de extracto de vainilla → **(+5, valioso)**
3. La receta incluye un topping de acabado (escamas de sal marina o azúcar glas) → **(+1, nice-to-have)**
4. La receta incluye granos de espresso → **(-1, ligeramente perjudicial)**
5. La receta incluye frutos secos / nueces → **(-10, dañino)**

> ⚠️ **Ojo con los pesos negativos:** permiten **castigar** al modelo por incluir aspectos **distractores, dañinos o peligrosos** — una herramienta poderosa en contextos donde la **seguridad es prioritaria** (p. ej. las nueces con una sobrina alérgica = -10).

---

## Reflexiones finales (Final thoughts)

- Componer rúbricas es un ejercicio de **creatividad y análisis humano**: implica **imaginar la respuesta ideal** a un prompt **y descomponerla** en un conjunto exhaustivo de criterios simples y objetivos.
- Aunque los términos —**dimensiones, instrucciones explícitas/implícitas, pesos**— puedan sonar pedantes, son **herramientas para abordar las rúbricas de forma más sistemática y analítica**, y son parte integral de **cómo aprenden los modelos**. No todo proyecto usa todas estas categorías, pero **siempre conviene tenerlas en tu caja de herramientas.**
- **Tu ingenio y diligencia ayudan a que los modelos aprendan a darnos buenas "galletas".** 🍪

---

## Resumen ejecutivo (para llevar)

- **Rúbrica = checklist de criterios sí/no adjunta a un prompt**, que define la respuesta ideal (metáfora **"receta"**, no "calificación").
- **Dónde encajan:** son un subtipo de **RL** que **equilibra** entre RLVR (objetivo, respuesta única, p. ej. matemáticas) y RLHF (subjetivo, open-ended, p. ej. poema). Sirven para tareas **open-ended pero estructuradas**.
- **Post-training:** Evaluation (examinar) · SFT (respuesta ideal) · RL (feedback). El anotador escribe respuestas ideales (SFT) o califica (RL/rúbricas).
- **Objetivo MECE** (mutuamente excluyente + colectivamente exhaustivo) vía **3 principios**:
  - **Atomicity** — un criterio = un solo aspecto (si hay un "y", pártelo).
  - **Specificity** — di con precisión qué se espera; criterios binarios, objetivamente calificables.
  - **Self-Containment** — el criterio contiene toda la info para evaluar sin investigar afuera.
- **El arte de componer** (3 conceptos): **Dimensions** (Accuracy, Completeness, Communication Quality, Context Awareness, Instruction Following) · **User Instructions** (explícitas + implícitas) · **Weighting** (Mandatory / Valuable / Nice-to-have; pesos que pueden ser **negativos** para penalizar lo dañino).

---

## Quiz final (10 preguntas) — respuestas

1. **¿Para qué tipo de tareas son más útiles las rúbricas?**
   → **Tareas parcialmente open-ended con formas estructuradas de resolverse** (p. ej. escribir un email difícil al jefe). *(No: tareas con respuesta verificable única como matemáticas — eso es RLVR; ni tareas totalmente subjetivas como un poema — eso es RLHF.)*
2. **¿Qué aprende un modelo de los criterios de una rúbrica?** (varias)
   → **Cómo distinguir respuestas mejores de peores** a un prompt **Y** **qué características definen la respuesta ideal.** *(No: "la única respuesta correcta" — las rúbricas son para tareas abiertas, sin respuesta única.)*
3. **¿Razón más importante de que los criterios sean mutuamente excluyentes?**
   → **Si se solapan, el modelo podría dar demasiada importancia** a la característica que ambos criterios describen al aprender de la rúbrica.
4. **¿Razón más importante de que los criterios sean colectivamente exhaustivos?**
   → **Si no son comprensivos, el modelo puede no aprender todo lo necesario** para producir la respuesta ideal.
5. **¿Qué principios ayudan a producir rúbricas MECE?** (varias)
   → **Atomicity, Self-containment y Specificity.** *(No: "Subjectivity" — no es un principio.)*

6. **¿Por qué es importante que un criterio evalúe una y solo una cosa?**
   → **Le facilita al modelo calificar el criterio y aprender de él.** Si un criterio evalúa dos cosas a la vez, una respuesta puede cumplir una y fallar la otra, y no sabes cómo puntuarlo. *(No es por "eficiencia" ni por una "limitación técnica de los LLM".)* → principio de **Atomicity**.
7. **V/F:** "Los criterios explícitos son siempre más importantes que los implícitos para distinguir respuestas mejores de peores."
   → **FALSO.** Que un prompt pida o no explícitamente una característica **no determina** su importancia. Ej.: un prompt de consejo médico puede no decir "no des recomendaciones peligrosas", pero una respuesta con una recomendación peligrosa sería **muy mala**.
8. **¿Deberías incluir tus preferencias subjetivas en los criterios?**
   → **Sí, pero redactadas para calificarse lo más objetivamente posible.** En vez de "la respuesta debe ser concisa", escribe "la respuesta debe tener máximo 500 palabras". Las rúbricas enseñan preferencias humanas, pero son más útiles cuando se pueden **calificar de forma consistente**. *(No: "no hay lugar para preferencias"; ni "redáctalas lo más subjetivamente posible".)*
9. **Si el prompt hace una pregunta con respuesta objetiva, ¿debes incluir esa respuesta en el criterio?**
   → **Sí:** escribe algo como "el modelo menciona que la respuesta correcta es X". Los criterios deben contener **toda la información necesaria** para calificarlos, para que el modelo aprenda sin exigir información externa. → principio de **Self-Containment**.
10. **Etiquetar los criterios con dimensiones, labels explícito/implícito y pesos, ¿a quién beneficia?** (varias)
    → **Al modelo** (obtiene información más granular para aprender qué aspectos aplican) **y al anotador** (son herramientas para producir rúbricas MECE de forma analítica y comprensiva). *(No: "a nadie".)*
