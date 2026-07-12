# Advanced Prompt Engineering: Model Stumps — Outlier EDU

> _(En el material aparece etiquetado como "Course 03" de Outlier EDU; es el 2.º curso que documentamos.)_
>
> Introducción a técnicas avanzadas de ingeniería de prompts diseñadas para **hacer fallar (stump) a los modelos**. Muestra cómo las mismas técnicas que ayudan a escribir mejores prompts sirven también para **producir datos de entrenamiento valiosos** que señalan dónde fallan los modelos actuales.

---

## En este curso aprenderás
- Objetivos de la ingeniería de prompts avanzada
- Qué es un **fallo del modelo** (model failure)
- La **mentalidad "Model Stump"**
- Cómo **diseñar model stumps**
- Estrategias de stump de **un solo turno** (single-turn)
- Estrategias de stump **multi-turno** (multi-turn)
- Ejemplos generales de model stumps

---

## Recap del Curso 1 (Intro to Prompt Engineering)
- El principio central: puedes **introducir constraints** para ayudar a los LLM a manejar la **complejidad**.
- Los **constraints son condiciones** para la respuesta del modelo: pueden pedir un formato, tono, longitud, audiencia, tema concretos, y más.

---

## Contenido

## Qué es la ingeniería de prompts avanzada

- En este curso se introducen **técnicas más avanzadas** de prompting.
- **Novedad clave respecto al Curso 1:** ya no basta con poner constraints sueltos; ahora prestamos atención a cómo los constraints **se apilan (stack), interactúan entre sí o dependen unos de otros**.
- Se consideran **dos modos de interacción**:
  - **Single-turn (un solo turno):** un único prompt.
  - **Multi-turn (multi-turno):** una conversación con más de un prompt y respuesta.

---

## Objetivos de la ingeniería de prompts avanzada (Goals)

> Aprender a manejar las **interacciones entre constraints** en tus prompts sirve para muchos fines, tanto en:
> - **tus propias interacciones** con los modelos, como en
> - **la creación de datasets** que ayudan a que los modelos mejoren.

### Tres aplicaciones de la ingeniería de prompts avanzada

| Aplicación | Para qué sirve |
|------------|----------------|
| 👤 **Personal** | Crear un sistema de prompting avanzado que guíe a los modelos por **tareas complejas y avanzadas** de forma autónoma. Piensa: programar programas enteros, análisis legal complejo, construir una estrategia de negocio, un roadmap de proyecto, un programa de investigación, etc. |
| 🛡️ **Red Teaming & Safety (seguridad)** | Tipo particular de prompting avanzado donde expertos en seguridad **intentan diseñar prompts que hagan que los modelos produzcan salidas peligrosas, dañinas o maliciosas**. Al identificar esas estrategias, los investigadores pueden **mejorar la seguridad** entrenando a los modelos para compensar esas vulnerabilidades. |
| 🏋️ **Model Training (entrenamiento)** | El prompting avanzado permite **sondear dónde exactamente fallan hoy los modelos**. Los investigadores buscan datasets con ejemplos donde los prompts **"stump" (dejan trabado) al modelo** — prompts que los modelos actuales **no manejan bien** — para que aprendan a hacerlo mejor. |

> 🔑 **Idea central del curso:** las mismas técnicas que producen mejores prompts sirven para **generar datos de entrenamiento valiosos** que señalan las debilidades actuales de los modelos. Esto es exactamente el tipo de trabajo de anotación de datos en Outlier.

---

## Qué es un fallo del modelo (Model Failure) / Model Stumps

**Contexto:** a medida que los modelos se sofistican, manejan tareas con más complejidad, más ambigüedad y conocimiento más avanzado y de nicho. **Pero siguen fallando** en ciertas tareas complejas que quisiéramos que hicieran.

- Diseñar prompts que **"stumpean" al modelo de una forma particular** crea datasets muy valiosos que permiten **identificar debilidades concretas** y mejorarlas.
- **Producir model stumps es una tarea común de anotación de datos** (data annotation).
- Además, entender **cómo fallan los modelos** también mejora **tu propio uso personal** de la IA: te ayuda a diagnosticar y evitar esos fallos cuando construyes prompts complejos.

### Cómo se usan los fallos para entrenar (el ciclo)

1. **Definición:** un fallo del modelo ocurre cuando la respuesta **no cumple los constraints, expectativas o estándares de calidad** del prompt del usuario. (En ML a esto se le llama **loss**.)
2. **Corrección:** una forma de mejorar el *loss* es entrenar con datasets de prompts que causan **model stumps**, emparejados con **correcciones** a esos stumps. Las correcciones pueden ser **evaluaciones humanas, rúbricas (rubrics) o respuestas escritas por humanos** que describen o corrigen el fallo.
3. **Mejora dirigida:** este tipo de entrenamiento sirve para **mejora focalizada en áreas específicas** donde los modelos rinden mal. Por eso los investigadores **curan datasets de prompts diseñados para causar tipos específicos de stumps**.

---

## Categorías de Model Stumps (las 8 generales)

> Los equipos de Data Science de Outlier las clasifican así. **Pueden solaparse** entre sí.

| Categoría | El fallo ocurre cuando la respuesta… |
|-----------|--------------------------------------|
| 📌 **Reasoning (Razonamiento)** | comete un error de lógica, matemáticas, análisis, síntesis, etc. |
| 🖼️ **Instruction Following (Seguir instrucciones)** | no se adhiere a un constraint del usuario |
| ⭐ **Overconfidence (Exceso de confianza)** | no señala incertidumbre ni hace preguntas de seguimiento cuando el modelo no tiene suficiente información |
| 🧩 **Entity Confusion (Confusión de entidades)** | mezcla personas, lugares o cosas con nombres similares (p. ej. el prompt pregunta por "reyes" en ajedrez y la respuesta habla de monarcas) |
| 📖 **Factuality (Factualidad)** | **alucina** información falsa |
| ✏️ **Temporality (Temporalidad)** | comete errores relacionados con el tiempo (hablar de eventos futuros en pasado, dar información desactualizada) |
| 👤 **Self-coherence (Autocoherencia)** | no es consistente con la personalidad, opiniones o hechos que dio antes en una conversación multi-turno |
| ⚡ **Context Retention (Retención de contexto)** | no tiene en cuenta información que el usuario dio antes en una conversación multi-turno |

> 💡 Nota: **Self-coherence** y **Context Retention** son fallos propios de conversaciones **multi-turno**.

### Categorías especializadas (según el tipo de uso)

> Las 8 anteriores son solo un comienzo. Usos especializados de los modelos introducen categorías de fallo propias:

| Ámbito | Categoría | El fallo ocurre cuando… |
|--------|-----------|--------------------------|
| **Coding** `</>` | **Tool Use (Uso de herramientas)** | En programación, los modelos son más útiles como **agentes** con acceso a herramientas (buscadores, calendario interno…). Los agentes a veces **usan las herramientas en el orden o el contexto equivocados** para completar una tarea. |
| **Audio** 🎵 | **User Self-Editing (Autocorrección del usuario)** | Al hablarle a un modelo con capacidad de audio, el usuario **duda o se corrige** ("¿Puedes… eh… decirme…?", "¿Cuál es el segundo… digo, el tercero…?"). El modelo puede **fallar al procesar** correctamente esos prompts. |
| **Visual** 👓 | **Content Preservation (Preservación de contenido)** | Con modelos que procesan imágenes, el usuario pide **editar una característica específica** de una imagen. A veces la respuesta **no conserva los demás elementos** que el usuario no pidió editar. |

---

## La mentalidad Model Stump (empujar la frontera de la IA)

- Crear model stumps es difícil: gracias al trabajo de anotadores e investigadores, **lo que los modelos hacen bien crece cada día**.
- Los stumps son emocionantes porque son la **oportunidad de atacar directamente lo que los modelos aún no hacen bien**. Entrar en el "stump mindset" significa **promptear en la frontera** de los modelos más sofisticados.

**Primer paso — piensa en tareas que TÚ encuentras difíciles** en tu propia vida (trabajo, tareas cotidianas, retos). ¿Qué te cuesta hacer sin errores en términos de…?

| Dimensión | Pregúntate… |
|-----------|-------------|
| 🕐 **Time (Tiempo)** | ¿Qué tareas te tomarían mucho tiempo hacer bien (investigar, formatear, pensar, escribir, crear)? |
| ⌘ **Complexity (Complejidad)** | ¿Qué tareas tienen muchos pasos interconectados o partes móviles difíciles de seguir? |
| ⚛️ **Expertise (Experticia)** | ¿Qué tareas requieren conocimiento y experiencia detallados para ejecutarlas y juzgar su exactitud? |

> 🧭 **Mantén una mentalidad de usuario (user mindset):** pensar en tareas que te resultan **desafiantes pero importantes**. La meta de los stumps es mejorar la capacidad de los modelos para hacer **tareas que realmente queremos que hagan.**
>
> ⚠️ Puedes engañar a un modelo con **tecnicismos** o **apilando un montón de constraints aleatorios**, pero el objetivo es **identificar áreas reales de mejora**. Pregúntate: *¿de verdad te importaría que el modelo no pueda poner los pasos de una receta en orden alfabético inverso con el segundo…?* → ese tipo de reto **no le importa a nadie**. No sirve.

> 🎯 **La calibración clave del stump mindset:** equilibrar entre **planear categorías de fallo específicas** para el modelo **y evitar la complejidad contrived y las peticiones irreales.**

### Contrived Stumps vs Natural Stumps (ejemplos)

La distinción natural vs contrived del Curso 1 **aplica todavía más** con los stumps. A la izquierda, ejemplos contrived producidos por una IA; a la derecha, prompts anclados en **necesidades reales complejas**.

**Instruction Following**
- ❌ **Contrived:** "En exactamente 7 palabras, describe un desayuno saludable. Añade emojis después de cada palabra y una breve P.D. explicando tu elección." → *(los constraints tienen poca conexión entre sí o con una necesidad plausible.)*
- ✅ **Natural:** *(turno 1)* "Escribe un update de Slack de menos de 60 palabras que empiece con 'Update:' e incluya exactamente dos etiquetas en línea: **Impact:** y **Next:** (en negrita), separadas por punto y coma. Sin emojis." *(turno 2)* "Mismos constraints, más una lista corta de próximos pasos, todo en un solo párrafo (sin saltos de línea ni viñetas) y sin signos de exclamación." → *(muchos constraints, pero claramente conectados entre sí y con una tarea laboral realista.)*

**Temporality**
- ❌ **Contrived:** "Escribe una nota de prensa fechada en noviembre 2025 resumiendo la tabla final de medallas de los Juegos Olímpicos de 2032 como si ya hubieran terminado." → *(la petición es un acertijo sin uso plausible.)*
- ✅ **Natural:** "Necesito empezar un resumen ejecutivo de fin de año del desempeño de mi división. Usa este reporte de 2024 como plantilla y actualízalo con los nuevos números de este documento." → *(tarea plausible que reta la capacidad del modelo de reconocer el contexto temporal y actualizar el documento base.)*

---

## Diseñar Model Stumps (Engineering Model Stumps)

**El reto:** ¿cómo diseñar prompts que produzcan **stumps específicos** manteniéndolos **naturales**?

**Tips (proceso recomendado):**
1. Primero, entiende **la categoría de stump** que intentas producir y el **dominio** en el que trabajas.
2. Piensa en **tareas reales que hayas hecho** donde necesitaste una serie de pasos larga, compleja y/o experta para hacerlas bien.
3. **Traduce esas tareas a prompts**, usando **lenguaje cotidiano** y añadiendo **constraints** donde haga falta para indicar exactamente cómo necesitas la tarea.
4. **Evalúa qué tan bien** el modelo logró la tarea, prestando atención a los **pequeños detalles** necesarios para acertar.
5. Si el modelo **no quedó stumpeado, itera** añadiendo capas de complejidad:
   - en **single-turn** → añade **nuevos constraints**;
   - en **multi-turn** → haz **preguntas de seguimiento** que exijan al modelo mantener el **contexto**.

---

## Estrategias de stump de un solo turno (Single-Turn)

> Formas de **aumentar la complejidad** del prompt **manteniendo la naturalidad**.

| Estrategia | En qué consiste | Qué EVITAR |
|-----------|-----------------|------------|
| **Multiple Requests (Múltiples peticiones)** | Hacer varias peticiones **relacionadas** en un solo prompt. | ❌ **No apiles peticiones no relacionadas** (eso da un stump contrived). En su lugar, pide tareas **interdependientes** (una requiere el resultado de otra) o **branching** (p. ej. comparar dos opciones, elegir la mejor y actuar sobre ella). |
| **Ambiguity / Vagueness (Ambigüedad)** | Hacer peticiones que dependan de **mucho contexto o conocimiento de dominio**. Háblale al modelo como le hablarías a un **amigo o colega experto**. | ❌ **No introduzcas ambigüedades imposibles de resolver.** Los modelos no leen la mente. Una buena ambigüedad deja **sin decir** un contexto que **una persona experta sí podría inferir**. |

### Ejemplo trabajado — Single-Turn (consejo de entrenamiento)

Petición práctica que "se complica rápido". Muestra cómo **iterar** un prompt para stumpear al modelo manteniéndolo natural.

**Prompt v1** (Q&A / Brainstorming — pide consejo e ideas):
> "Mi pareja y yo queremos empezar a entrenar juntos. Queremos empezar con una rutina de pesas. **Yo soy exatleta pero no he entrenado consistentemente los últimos dos años. Mi pareja es nueva en pesas pero lleva mucho tiempo corriendo.** ¿Nos das una rutina de pesas de cuatro días que sea buena para los dos?"

Anatomía del prompt v1:
- **Context constraints:** da contexto sobre **dos entidades distintas** (yo exatleta / pareja corredora) que el modelo debe **mantener separadas** → reta *Entity Confusion* / *Context*.
- **Complex request:** una petición que exige **razonamiento, experticia y atención al contexto**.

**Resultado v1:** el modelo **maneja la complejidad con gracia** — la respuesta muestra experticia y atiende el contexto del prompt. *Pedimos mucho, pero el modelo lo resolvió.* → **No quedó stumpeado**, así que hay que **iterar**.

**Prompt v2** (se añade una petición **interdependiente**):
> "…¿Nos das una rutina de pesas de cuatro días que sea buena para los dos? **Luego ponla en una tabla con un calendario real para este mes, para que yo pueda ver cómo quedaría nuestro horario.**"

Por qué v2 es mejor stump:
- La nueva petición **depende de** la primera → el modelo **no puede** poner la rutina en una tabla/calendario hasta haberla generado (interdependencia real, no constraints apilados al azar).
- Sigue siendo **natural** → armar una rutina y ponerla en un calendario es algo que de verdad querrías hacer.

**Respuesta v2 (extracto):** el modelo genera un "Four-Day Strength Split" en tabla con columnas Día / Enfoque / Ejercicios / **Notas para ti (exatleta)** / **Notas para la pareja (nuevo)**.
> 👀 *Ojo (dato para analizar):* aunque se pidió una rutina de **cuatro días**, la tabla de la respuesta lista Día 1–5 + Días 6–7. Ese tipo de **desajuste con el constraint** (4 días) es justo la clase de fallo sutil —*Instruction Following*— que se busca detectar al evaluar.

**Análisis de la respuesta v2:** el modelo **hizo un buen trabajo, pero empieza a perder el hilo del contexto.** El prompt pedía un "**calendario real para este mes**", pero la tabla que devuelve (Semana 1–4, Lunes a Domingo) es **completamente genérica**, sin fechas reales. Probablemente esperabas algo más útil, con fechas.
> → **No es un fallo total, pero la respuesta es un poco menos ideal.** Aquí aparece la debilidad: es momento de hacer el constraint **más explícito**.

**Prompt v3** (se añade un **constraint temporal explícito**):
> "…para que yo pueda ver cómo quedaría nuestro horario. **Usa las fechas reales del mes, empezando el primer lunes.**"

- **Nuevo Temporal Constraint:** en v2 no fuimos explícitos y la respuesta quedó algo desviada. Ahora se prueba si el modelo lo maneja al **decirlo explícitamente**.

**Respuesta v3 (extracto):** el modelo **lo hace muy bien** — genera un "November 2025 Weightlifting Schedule" basado en el **primer lunes del mes (3 de noviembre de 2025)**, con fechas reales por semana (Nov 3, 10, 17, 24…).
> 💡 Incluso reconoció que un usuario en EE. UU. **quizá no quiera entrenar el día de Thanksgiving** (Week 4: "Nov 27 – sesión corta si Thanksgiving").
> → **Ese constraint no sirvió para producir un stump:** el modelo directamente **mejoró** la respuesta. Hay que **subir más la complejidad**.

**Prompt v4** (nuevos **constraints interdependientes** — "ahora sí estamos exigiendo al modelo"):
> "…Luego ponla en **dos tablas, una para cada uno**, dándonos un calendario real de este mes… Usa las fechas reales, empezando el primer lunes. **Marca qué días podremos entrenar juntos. Queremos entrenar juntos siempre que ambos trabajemos desde casa. Yo voy a la oficina lunes y viernes. Mi pareja va cada dos miércoles. Haz un calendario plausible que maximice la cantidad de días que entrenamos juntos.**"

Por qué v4 es un buen stump (complejo pero **natural**):
- Pide **un calendario por persona** que **maximice los días juntos** y **marque** esos días.
- Aunque es mucho más complicado, **refleja la realidad** de hogares con horarios de trabajo variables → es una tarea que una pareja **sí haría** una tarde.
- Involucra **tiempo, experticia y muchos pasos** interdependientes (calcular días WFH de cada uno, encontrar solapes, optimizar), pero es **perfectamente plausible**.

**Respuesta v4 (extracto):** el modelo arranca con "November 2025 Schedule Assumptions" (Tú: oficina lun/vie; Pareja: oficina cada dos miércoles = Nov 5, 19; Ambos WFH: mar, jue, casi todos los miércoles y fines de semana), fija fecha de inicio (lun 3 nov) y genera **una tabla por persona** con los días compartidos resaltados 🟩. → Este nivel de razonamiento multi-restricción es donde se empieza a **poner a prueba de verdad** la capacidad del modelo.

**Respuesta v4 — dónde por fin falla (cascada de fallos):** con la complejidad de v4, aparecen **fallos reales** de **self-consistency, temporality y reasoning**:
- **Contradicción (self-consistency):** arriba la respuesta dice que la pareja va a la oficina el **Nov 5 y Nov 19**, pero en la tabla *de la pareja* dice que solo va el **Nov 19**. Además marca incorrectamente el **Nov 5 como día de entrenar juntos**.
- **Contradicción interna:** en *tu* tabla apareces correctamente en oficina lunes y viernes, pero en el **Summary** el modelo sugiere **entrenar solo lunes y viernes** (justo los días que estás en oficina).
- **Factuality / alucinación:** la tabla de la pareja **alucina contexto que no diste** y llama a tu pareja **"her"** (ella), sin que lo hubieras especificado.

> 🔑 **Lección central del ejemplo single-turn:** iterar sobre la **complejidad y las dependencias** del prompt **introdujo una cascada de fallos.** Es decir: subiendo capas naturales e interdependientes, terminaste **stumpeando al modelo de verdad** — y en varias categorías a la vez (self-coherence + temporality + reasoning + factuality).
>
> Regla de oro reafirmada: empieza natural → si el modelo resuelve, **añade una capa** (petición interdependiente → constraint temporal explícito → optimización con restricciones cruzadas). Cada capa debe **seguir siendo algo que un usuario real querría**.

---

## Estrategias de stump multi-turno (Multi-Turn)

> Las conversaciones **multi-turno** ponen a prueba la capacidad del modelo de **retener contexto y constraints a lo largo de toda la conversación** — dan estrategias extra más allá de solo añadir complejidad a un prompt individual.

| Estrategia | En qué consiste | Clave / qué cuidar |
|-----------|-----------------|--------------------|
| 📖 **Instruction Following** | Ofrecer una **regla universal** cerca del inicio de la conversación, o **superponer instrucciones interdependientes** entre distintos turnos, para ver si el modelo **retiene la regla** y descubre las **dependencias** entre reglas. | ⚠️ **Que las instrucciones sean realistas.** Piensa en tareas donde te vuelves **gradualmente más específico** (editar un documento, refinar una idea creativa). |
| 🗺️ **Context Retention** | Dar al modelo **cada vez más contexto** a lo largo de la conversación. Introduce info sobre ti, tu familia, vida social o colegas, y luego pídele tareas que lo obliguen a **mantener toda la info clara sin que se la recuerdes** directamente. | El fallo aparece cuando **olvida o mezcla** el contexto acumulado. |
| 👤 **Self-correction / Contradiction** | **Cambiar de opinión** sobre un constraint más adelante, o **introducir un error pequeño** para ver si el modelo sigue el nuevo constraint o **señala tu error**. | ⚠️ **Debe ser factible** que el modelo responda a tu corrección/contradicción. **No es justo pedirle resolver una paradoja** — debe poder **corregir el error o hacer preguntas aclaratorias** si tecleas mal un nombre o fecha. |

### Ejemplo trabajado — Multi-Turn (mismo caso del workout)

**Prompt Turn 1 (baseline):** se retoma la **v3** del prompt (rutina 4 días + tabla + fechas reales desde el primer lunes), donde el modelo lo hacía bien.
> "…¿Nos das una rutina de pesas de cuatro días buena para los dos? Luego ponla en una tabla con el calendario real de este mes… Usa las fechas reales del mes, empezando el primer lunes."

- **Idea:** empezar con una petición base que el modelo **maneja bien** (razona los constraints, atiende las peticiones en orden y da un calendario bien formateado), para luego **añadir contexto o correcciones** en los turnos siguientes.

**Respuesta Turn 1 (extracto):** el modelo genera "November 2025 Schedule" — primer lunes = **lunes 3 de noviembre**, 4 días de pesas por semana (Lun/Mar/Jue/Vie: Upper A / Lower A / Upper B / Lower B), descanso mié/sáb/dom + recuperación activa opcional.
> → Igual que antes, **maneja bien** los constraints y las múltiples peticiones. La pregunta ahora: **¿qué pasa cuando añadimos contexto o nos corregimos** en los siguientes turnos?

**Prompt Turn 2 (revisar con nuevo constraint + más contexto):**
> "Ah, no podemos los martes. Los dos tenemos que ir a la oficina ese día."

- Se añade un **constraint nuevo** + contexto que el modelo debe **recordar durante toda la conversación**.

**Respuesta Turn 2 (extracto):** el modelo **maneja la edición con gracia** — genera "November 2025 Schedule (No Tuesdays)" y **deduce que quitar los martes obliga a mover** el plan de 4 días a otros días de la semana (Lun/Mié/Jue/Sáb). Descanso: martes, viernes, domingo.
> → Bien resuelto. Pero la vida real es complicada: **¿qué pasa si aparece algo más que no encaja?** Se sigue la conversación…

**Prompt Turn 3 (introducir una contradicción sutil y ver si razona):**
> "El 27 es Thanksgiving, estaremos fuera de la ciudad desde el jueves hasta el fin de semana. ¿Puedes editar el calendario para acomodarlo?"

- **Qué la hace buena estrategia:** es **natural y conversacional**. Quieres un mes de rutinas de 4 días, pero **viajas 4 días en una de esas semanas**.
- **No es un error, es un pequeño cambio en tu petición.** Un humano reconocería que esa semana quizá entrenas solo parte de los días o descansas. **Pero estas pequeñas contradicciones pueden ser difíciles de entender para el modelo.**

**Respuesta Turn 3 — AQUÍ SE PRODUCE EL STUMP:** el modelo **tiene problemas para razonar la contradicción** y aplicarla de forma **autocoherente y reteniendo el contexto**. El problema **se propaga en cascada** por toda la respuesta:
- Aunque acierta en **sugerir mover** las sesiones de esa semana más temprano, **no reconoce** que "estar fuera de jueves 27 a domingo 30" significa que **no puede** entrenar "lunes, martes, miércoles, sábado" esa semana → y propone justamente esos días.
- **Error de formato/reasoning:** coloca "**Nov 25**" (que es **martes**) bajo la columna de "**miércoles**".
- **Contradicción interna:** en "Rest Days" lista correctamente "Week 4 → jueves–domingo", pero eso **contradice** su propia sugerencia de entrenar el sábado.
- **Fallo de Context Retention / Instruction Following:** propone volver a entrenar el **martes**… ¡cuando en el **Turn 2** dijiste que **no puedes los martes**! El modelo **olvidó el constraint anterior.**

> 🔑 **Lección del ejemplo multi-turn:** una **contradicción pequeña, natural y factible** (viajo unos días de una semana) puede stumpear al modelo en varias categorías a la vez — **reasoning, self-coherence, context retention e instruction following** — porque debe **razonar el cambio Y recordar todos los constraints previos** simultáneamente. Ese es el valor de los stumps multi-turno.

---

## Ejemplos generales / dominios técnicos (General Examples)

- Los ejemplos del curso vienen del **uso general de chatbots**, pero a menudo los investigadores buscan model stumps para **afinar la capacidad de los modelos en un dominio particular**.
- **Buena noticia:** las **mismas estrategias** de model stumps aplican también en **dominios técnicos** como **ciencia de datos, programación (coding), derecho (law) y medicina**.
- Aunque los detalles cambian entre dominios, los modelos tienden a tener **dificultades similares**: manejar la complejidad, retener el contexto y ejecutar peticiones interdependientes.

---

## Reflexiones finales (Final thoughts)

- Diseñar prompts para stumpear a un modelo es una tarea **cada vez más difícil**: gracias a la colaboración de usuarios, investigadores de ML y anotadores, los modelos han mejorado mucho en navegar la ambigüedad, mantener el contexto, hacer buenas inferencias y ejecutar tareas complejas. Por eso producir **stumps realistas empuja aún más la frontera de la IA**.
- Además de servir para tareas de anotación, las lecciones aplican a **tu propio uso de la IA**: ahora sabes mejor **con qué siguen batallando los modelos** y cómo compensarlo con tus prompts.

> 🔄 **Truco de doble filo (¡clave!):** el **opuesto** de las estrategias de stump es lo que hace que el modelo trabaje **mejor** para ti en tareas complejas que te importan:
> | Para STUMPEAR (generar datos) | Para AYUDARTE (uso personal) |
> |-------------------------------|------------------------------|
> | Dejar contexto implícito / no recordarlo | **Recordarle el contexto** al modelo |
> | Introducir términos ambiguos | **Definir los términos ambiguos** |
> | Apilar múltiples peticiones interdependientes | Hacer las peticiones **una a la vez, con expectativas claras** |

---

## Resumen ejecutivo (para llevar)

- **Model stump / model failure:** cuando la respuesta **no cumple** los constraints, expectativas o estándares del prompt (en ML = **loss**). Los stumps se emparejan con **correcciones** (evaluaciones, rúbricas, respuestas humanas) para entrenar modelos y lograr **mejora dirigida**.
- **8 categorías generales:** Reasoning · Instruction Following · Overconfidence · Entity Confusion · Factuality · Temporality · Self-coherence · Context Retention (las 2 últimas son multi-turno). **Especializadas:** Tool Use (coding), User Self-Editing (audio), Content Preservation (visual).
- **Stump mindset:** parte de tareas **reales** que a ti te resultan difíciles por **Tiempo / Complejidad / Experticia**. La calibración clave: **fallo específico ↔ evitar complejidad contrived**. Regla de oro: *"¿a un usuario real le importaría?"*
- **Natural > Contrived:** el stump debe nacer de una **necesidad real**, no de acertijos ni constraints apilados al azar.
- **Estrategias Single-Turn:** Multiple Requests (interdependientes/branching, no inconexas) · Ambiguity (contexto que un experto inferiría, no imposible de resolver). Si no stumpea → **itera añadiendo capas naturales**.
- **Estrategias Multi-Turn:** Instruction Following (regla universal / instrucciones interdependientes entre turnos) · Context Retention (dar más contexto y no recordarlo) · Self-correction/Contradiction (cambiar de opinión o meter un error pequeño **y factible** — nunca una paradoja).
- **La cascada de fallos** es la señal de un buen stump: complejidad + dependencias bien puestas disparan **varios tipos de fallo a la vez**.

---

## Quiz final (5 preguntas) — respuestas

1. **V/F:** "Los model stumps son siempre comportamiento indeseable, sin ningún valor."
   → **FALSO.** Aunque pueden representar comportamiento no deseado, son **muy valiosos** para los investigadores, que los usan para **mejorar los modelos** en áreas donde hoy rinden mal.
2. **V/F:** "Al crear stumps para un dataset, lo mejor es escribir prompts que sean **acertijos contrived** porque confunden al modelo."
   → **FALSO.** Los stumps más valiosos son los que reflejan **conversaciones naturales/reales**, porque el objetivo es mejorar la capacidad del modelo de responder a **necesidades reales de usuario**.
3. **¿Qué estrategias son buenas para producir stumps valiosos?** (varias)
   → **Hacer múltiples peticiones interdependientes en un prompt** y **omitir contexto que un humano experto podría inferir.**
   (NO: apilar peticiones no relacionadas; NO: escribir el prompt de forma que sea imposible saber cómo sería una buena respuesta.)
4. **¿Qué dimensiones sirven para probar la capacidad del modelo al diseñar un stump?** (varias)
   → **Cuánto tiempo toma la tarea**, **cuánta experticia requiere** y **qué tan compleja es.**
   (NO: "qué tan tediosa e irrealista es la tarea" → eso es contrived.)
5. **V/F:** "Las técnicas de este curso aplican tanto a prompts generales como a dominios técnicos (medicina, derecho, coding)."
   → **VERDADERO.** Los detalles cambian entre dominios, pero los modelos tienen **dificultades similares** (complejidad, retención de contexto, peticiones interdependientes) en todos ellos.
