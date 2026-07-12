# Intro to Prompt Engineering — Outlier EDU

> Introducción fundamental a la ingeniería de prompts: cómo funciona el prompting y consejos prácticos para diseñar prompts que cumplan tus necesidades. Útil tanto para tareas de anotación de datos como para el uso personal de la IA.

---

## En este curso aprenderás
- Qué **es** un prompt
- Qué **aspecto tiene** un prompt
- Qué aspecto tiene un prompt **en la práctica**
- **Casos de uso** de los prompts
- Prompts **simples** vs prompts **complejos**
- Prompts **naturales** vs prompts **artificiales/forzados** (contrived)
- **Aplicaciones** en el mundo real

---

## ¿Qué es un prompt?

**Idea clave:** un prompt es el texto que le das de entrada a un LLM; el modelo procesa ese lenguaje y devuelve el texto que predice como más probable a continuación, según los datos con que fue entrenado.

**Cómo funciona por debajo:**
- Los **LLM (Large Language Models)** son **representaciones matemáticas del lenguaje**. Se les alimenta una cantidad enorme de lenguaje natural (gran parte de internet) y el modelo **aprende los patrones** presentes en ese lenguaje.
- Cuando el modelo recibe **texto nuevo** (tu prompt), usa esos patrones para **adivinar qué lenguaje es más probable que siga**.
- Ese "texto nuevo" que tú introduces **es el prompt**.
- El lenguaje que devuelve el modelo depende **tanto del idioma/estilo de tu prompt** como del lenguaje con el que fue entrenado originalmente.

---

## ¿Qué aspecto tiene un prompt?

**Respuesta corta: cualquiera.** Un LLM puede procesar casi cualquier texto que le des. Pero que su salida sea *útil* depende de dos cosas:
1. **Cómo redactas tu prompt** (craft your prompt).
2. **Con qué texto fue entrenado** el modelo.

**Los LLM son enormes máquinas de reconocer patrones (pattern-matching):**
- Si tu prompt **se parece** al lenguaje que el modelo vio muchas veces en su entrenamiento → es más probable que produzca una salida **coherente y apropiada al contexto**.
- Si tu prompt es algo **nuevo/nicho** para el modelo (una combinación de palabras muy inusual, o casi galimatías) → el modelo tiene **menos contexto** del cual partir y la salida será peor.

---

## ¿Qué aspecto tiene en la práctica?

- Puede sonar abstracto, pero **la gente usa los chatbots porque son útiles.**
- Toda necesidad de un usuario de chatbot **se puede expresar en lenguaje** y **se satisface con más lenguaje**.
- **Analogía con un buscador:** cuando buscas en Google introduces una consulta porque buscas cierta información; recibes una descripción formateada de lo que buscas, y el buscador devuelve lo que su algoritmo predice como más relevante.
- Con un **LLM**, tú **expresas lo que necesitas en tu prompt** y el LLM devuelve el texto que su cálculo predice como más probable para **satisfacer esa necesidad**.
- Como el LLM fue entrenado con prácticamente todo internet, tiene lenguaje para **cubrir un rango amplísimo de necesidades**.

**Además de buscar información como un motor de búsqueda, también puedes:**
- **Chat / Roleplay:** imaginar qué diría una figura famosa sobre un tema, etc.
- **Brainstorm:** pedir una lista de ideas creativas sobre un tema específico.
- **Rewrite:** dar un texto en un estilo y pedir que lo reescriba en otro estilo o formato.
- …y mucho más.

---

## Casos de uso de los prompts (8 categorías)

> Categorías amplias que los científicos de datos de Outlier usan para **clasificar prompts reales**. Las necesidades reales son complicadas y **los prompts reales suelen cruzar varias categorías**.

| Categoría | Qué hace |
|-----------|----------|
| **Q&A (Preguntas y respuestas)** | Hacer una pregunta sobre un tema abierto o un texto específico y obtener una respuesta |
| **Chatbot** | Mantener una conversación con el modelo dándole un rol o punto de vista específico |
| **Brainstorming** | Crear una lista de ideas para un tema, idea o problema concreto |
| **Creative Writing (Escritura creativa)** | Crear un texto nuevo (poema, email, relato) a partir de la idea general que introduces |
| **Extraction (Extracción)** | Extraer información específica de un texto de referencia |
| **Classification (Clasificación)** | Dar un texto de referencia + un conjunto de categorías para que el LLM lo clasifique |
| **Summarization (Resumen)** | Dar un texto de referencia y obtener un resumen de su contenido (quizá desde un punto de vista concreto) |
| **Rewriting (Reescritura)** | Que el LLM reescriba un texto de referencia en un formato, tono o estilo específico |

### Ejemplo: un prompt para generar ejemplos (meta-prompt de Brainstorming)

Prompt usado en el curso para producir ejemplos de cada categoría:

> "Genera tres prompts de LLM realistas, cercanos y de sonido natural para mí, que caigan bajo cada una de las siguientes categorías. Ponlos en un formato fácil de usar (p. ej., categoría en negrita con los prompts en viñetas debajo). Asegúrate de que suenen como cosas que un usuario real escribiría. **Varía la longitud, complejidad, perfil de usuario y temas** de los prompts. Deben involucrar distintos casos de uso pero ser **entendibles por una audiencia general**."

**Desglose de subcasos (del ejemplo del curso):**
- **Open Q&A** — preguntar sin material de referencia y obtener respuesta útil de inmediato: pregúntame lo que sea, explicar un concepto, preguntas generales que no requieren texto de referencia (p. ej. cultura pop).
- **Chatbot** — conversar con un modelo que toma un punto de vista o rol: tener una conversación, prepararse para una entrevista o presentación, taller/refinar una idea (p. ej. consejo de un autor o experto favorito).
- **Brainstorming** — crear una lista corta de ideas para un tema/actividad/problema: tema o caso de uso a explorar, ideas de regalo o menú, ideas de marketing o branding, nuevos productos o estrategias de negocio, descubrimiento de medios/comida ("me gusta X, ¿qué más me podría gustar?").
- **Creative Writing** — crear algo significativo y útil desde cero: escribir un email felicitando a un amigo por adoptar un gatito (lindo e informal), escribir un cuento para dormir, etc.

> ⚠️ Nota del curso: el video de ejemplo no tiene sonido; puedes saltarlo, pero conviene leer la respuesta del chatbot para ver ejemplos de los distintos casos de uso.

**Resto de subcasos (definiciones + ejemplos del prompt del curso):**
- **Creative Writing** — crear algo significativo y útil desde cero: felicitar por email a un amigo por adoptar un gatito (lindo/informal), cuento para dormir sobre astronautas y tigres, inventar una excusa creativa para escribirle al jefe.
- **Closed Q&A** — preguntar sobre un **texto de referencia específico** y obtener respuesta: "¿Cuál fue la facturación de esta empresa en 2023?", "¿Quién es el máximo anotador en este documento?", "¿Este menú incluye opciones sin gluten?".
- **Extraction** — extraer información específica de un texto de referencia: "¿Cuáles son las primeras vocales de cada palabra?", "¿Cuáles son mis action items de esta cadena de correos?".
- **Classification** — dar texto de referencia + las clasificaciones a usar, y obtener insights o una lista de coincidencias: clasificar cada vehículo según motor V4 / V6 / eléctrico; gastos; sentimiento; restricciones dietéticas en comidas; action items en un email.
- **Summarization** — dar un texto de referencia y obtener un resumen, quizá con foco en temas concretos o desde un punto de vista: documentos/reportes financieros, notas de reunión, artículos o reseñas.
- **Rewriting** — dar texto + formato/caso/rol/tono para reescribirlo: cambiar el tono (de lista de receta a menú de restaurante; de texto informal a email formal), reescribir desde la perspectiva opuesta, transformaciones cómicas.

### Ejemplos realistas por categoría (respuesta del modelo al meta-prompt)

Muestran cómo interactúan usuarios reales. Nota el patrón: **contexto + rol + restricciones concretas**.

- **Open Q&A**
  - "¿Cuál es la diferencia entre arquitectura de **microservicios** y **monolítica**? Necesito una forma simple de explicárselo a mi jefe, que no es muy técnico."
  - "Ayúdame a zanjar un debate: ¿un hot dog es un 'sándwich'? Dame el argumento más convincente de cada lado."
  - "¿Quién fue el vocalista principal de **Queen** y cuál fue su álbum más vendido?"
- **Chatbot** (asignar rol + objetivo)
  - "Practiquemos una conversación difícil. Tú eres mi **arrendador** y necesito negociar una renta más baja por arreglos pendientes. Sé firme pero razonable."
  - "Necesito un nombre pegadizo para una cafetería de café sostenible y de origen ético. Finge que eres un **estratega de marca** de una firma top y hazme unas preguntas para empezar."
  - "Actúa como mi **entrenador físico**. Mi meta es correr 10K en tres meses; hoy corro 3 millas, 3 veces por semana. ¿Cuál es el siguiente paso inmediato de mi plan, y por qué?"
- **Brainstorming**
  - "Organizo una fiesta de oficina temática de los **90s** y necesito una playlist de ~15 canciones muy reconocibles pero no sobreexplotadas."
  - "Mi hermano se mudó a su primer apartamento y ama los videojuegos vintage. Quiero un **regalo de estreno** único por menos de $75. ¿Ideas?"
  - "Tengo un negocio de carteras de cuero hechas a mano en EE. UU. Necesito **eslóganes** cortos que resalten la calidad y que sean hechas a mano."
- **Creative Writing**
  - "Escribe un **email de disculpa** corto a una clienta llamada Sarah por un plazo incumplido. Profesional pero no rígido, y propón un nuevo plazo firme para mañana."
  - "Necesito un **post de LinkedIn** corto y divertido anunciando que asistiré a una conferencia importante la próxima semana. Emocionado, que invite a conectar, pero sin clichés como 'súper emocionado'."
  - "Escribe un **relato muy corto** (menos de 100 palabras) sobre un farero jubilado que descubre un mensaje en una botella que cambia su vida."
- **Closed Q&A** (nota cómo el texto/imagen de referencia es parte del prompt)
  - *(El usuario pega un reporte de resultados detallado)* → "Basándote **solo** en el texto que te di, ¿cuáles fueron los **gastos totales de I+D** del trimestre fiscal actual?"
  - *(El usuario sube una captura de un formulario online complicado con muchos campos)* → "¿Qué campos de este formulario están marcados explícitamente como **opcionales**?"

> 🔑 **Patrón que enseña el curso:** un buen prompt real combina **contexto** (para quién/qué situación), **rol o punto de vista** (a veces) y **restricciones concretas** (longitud, tono, presupuesto, "basándote solo en…"). Eso es lo que hace que la salida sea útil.

**Más ejemplos por categoría (el "texto de referencia" es parte del prompt):**
- **Closed Q&A:** *(pega una sección de documento histórico)* → "Según este texto, ¿cuál fue la **razón principal** de que fracasaran las negociaciones del tratado?"
- **Extraction:**
  - *(pega un hilo de correo largo con muchos participantes)* → "Recorre esta cadena y extrae **cada fecha y hora** mencionada, aunque solo sean sugerencias para una reunión."
  - *(da una lista de ingredientes de cinco recetas)* → "Para cada receta, lista solo los ingredientes que sean **fuente de proteína**."
  - *(pega una descripción de puesto)* → "Del texto, extrae todas las **competencias de software requeridas** ('Dominio de…') en una lista de viñetas simple."
- **Classification:**
  - *(pega la transcripción de un chat de servicio al cliente)* → "Clasifica cada mensaje del cliente por **sentimiento**: Positivo, Negativo o Neutral."
  - *(da una lista de gastos con montos)* → "Categoriza cada gasto en: **'Viajes', 'Material de oficina' o 'Entretenimiento a clientes'**."
  - *(pega un párrafo sobre un plan de desarrollo urbano)* → "Identifica los elementos del plan clasificables como 'Reducir **congestión de tráfico**' vs 'Mejorar **zonas verdes**'."
- **Summarization:**
  - *(pega un artículo muy largo sobre un debate político)* → "Resúmelo en **tres puntos clave**, como si se lo explicaras a alguien con conocimiento básico del tema."
  - *(da la transcripción de una reunión de 30 min)* → "Resume las notas, enfocándote específicamente en las decisiones sobre el **presupuesto del proyecto**."
  - *(pega una reseña detallada de un producto)* → "Dame un resumen de **dos frases** enfocado solo en la experiencia del reseñador con la **duración de la batería**."
- **Rewriting:**
  - *(pega una sección legal muy técnica)* → "Reescribe este párrafo para que lo entienda fácilmente un **estudiante de secundaria**."
  - *(da una lista seca de temas de presentación)* → "Reescríbela como una **introducción narrativa y convincente** para un discurso keynote. Tono inspirador."
  - *(pega un email formal a un colega sobre un problema técnico)* → "Reescríbelo como un **mensaje de texto casual y algo humorístico** que le enviarías a un amigo cercano sobre el mismo tema."

---

## Prompts simples vs prompts complejos

> Idea puente: como imaginas por las categorías, **los prompts pueden ser muy simples o muy complejos**. Cuanto más complejo el prompt, **más contexto de su entrenamiento y más procesamiento** necesita el modelo para predecir la respuesta adecuada.

| Prompts **simples** | Prompts **complejos** |
|---------------------|------------------------|
| Requieren poca interpretación | Lenguaje ambiguo o con muchos matices |
| Una sola tarea | Múltiples ideas, muchos pasos interdependientes |
| Fáciles de categorizar | Múltiples categorías o petición inusual |
| Preguntan por cosas que aparecen por todo internet | Preguntan por cosas de fuentes de nicho, poco presentes en el set de entrenamiento |
| Requieren menos contexto profundo (cultural, científico, lingüístico, etc.) | Están profundamente insertos en un contexto rico |

> ⚠️ Matiz del curso: la capacidad de los LLM para responder prompts complejos está **limitada por su set de entrenamiento**. Aun así, pueden llevar a cabo tareas **sorprendentemente complejas**.

---

## Constraints (restricciones) — la palanca clave

> **Una forma de hacer que los LLM realicen tareas complejas es darles restricciones específicas.**

- Los **constraints son condiciones** que tu prompt le impone a la respuesta del modelo.
- Pueden incluir peticiones de un **formato** concreto, **tono**, **longitud**, **audiencia**, o la **exclusión** de un tema específico.
- Los constraints **aumentan la complejidad del prompt** pero, a la vez, **le dan al modelo más contexto y detalle** de cómo debe responder. (Es decir: más restricción bien puesta = mejor salida, no peor.)

### Tipos de constraints

| Tipo | Qué controla |
|------|--------------|
| **Content (Contenido)** | Indicar al modelo que **incluya o excluya** cierta información |
| **Style & Tone (Estilo y tono)** | Pedir un estilo concreto (frases largas, vocabulario poético) o un tono (humorístico, deferente) |
| **Formatting (Formato)** | Manipular el formato (viñetas, tablas) o la estructura (empezar con un resumen, usar listas) |
| **Expertise (Nivel de experticia)** | Pedir que responda a cierto nivel (principiante, experto nivel PhD, etc.) |
| **Uncertainty (Incertidumbre)** | Pedir que diga **qué tan seguro** está, que **no adivine**, o que avise cuando no sepa |
| **Geography (Geografía)** | Indicar dónde estás o para quién es (restaurantes, médicos cercanos) |
| **Time Range (Rango temporal)** | Pedir respuestas relevantes a un rango histórico o actual |

### Ejemplo de constraints (sobre el meta-prompt de Brainstorming)

En el prompt de "genera tres ejemplos por categoría" ya había varias restricciones actuando juntas:
- **Length constraint:** "tres" prompts → fija la cantidad de salida.
- **Formatting constraint:** "categoría en negrita con los prompts en viñetas" → fija formato y estructura.
- **Style constraint:** "que suenen naturales, entendibles por una audiencia general" → fija estilo/tono/audiencia.

> 🔑 **Añadir constraints es la forma natural de guiar al LLM** para que realice tareas complejas por ti.

---

## Prompts naturales vs prompts artificiales (Natural vs Contrived)

> El curso compara, lado a lado, prompts escritos **para datos de entrenamiento** (izquierda) contra prompts reales del **historial de ChatGPT de un colega** (derecha). La meta: reconocer la diferencia entre complejidad **natural** y complejidad **contrived** (forzada/artificial).

**Diferencias clave a notar:**

| Prompts **contrived** (artificiales) | Prompts **reales / naturales** |
|--------------------------------------|--------------------------------|
| Estilo de escritura formal o **acartonado/rígido** (stilted) | Estilo **casual y natural** |
| **Poca variación** en las peticiones: estilo, contexto, estructura | **Muy variados** en estilo, contexto y estructura |
| **Poca conexión** con necesidades plausibles de un usuario | **Conexión clara** con las necesidades y el contexto del usuario |
| **Constraints forzados** (p. ej. "sin pájaros de Oceanía") | Constraints **claramente ligados a una necesidad real** (p. ej. burrata para una evaluación de desempeño) |

> 🎯 **Lección práctica para anotación de datos:** cuando te pidan escribir prompts, deben parecerse a los **reales** — casual, variado, con constraints que respondan a una necesidad genuina — y **evitar** lo contrived: rigidez, monotonía y restricciones inventadas sin propósito.

---

## Aplicaciones en el mundo real (proceso en 3 pasos)

> El curso enseña un flujo repetible con tres contextos (**School / Professional / Personal**):
> **1) Necesidad → 2) Primer borrador del prompt → 3) Refinar con constraints.**

### Paso 1 — Necesidad (Needs)
Parte de una necesidad concreta antes de escribir nada:
- **School Use:** estás atascado con un problema de cálculo de tu tarea.
- **Professional Use:** te postulas a un ascenso y debes escribir tu autoevaluación; no sabes cómo presentar lo del año.
- **Personal Use:** organizas una cena para amigos cercanos con distintas necesidades dietéticas y niños que comen quisquilloso.

### Paso 2 — Primer borrador (First Drafts)
Convierte cada necesidad en un primer prompt (aún básico):
- **School:** "No entiendo cómo hacer este problema de integración, ¿me muestras cómo?"
- **Professional:** "Necesito escribir una autoevaluación. Aquí hay algunas cosas que logré, ¿me las conviertes en una evaluación?"
- **Personal:** "¿Qué platos fáciles puedo hacer para una cena? Tengo dos comensales quisquillosos y a todos les gustan cosas distintas."

> 💡 Nota del curso: **estos prompts no están mal, pero puedes añadir más información y constraints** para guiar al LLM hacia la mejor respuesta posible.

### Paso 3 — Refinar los borradores (Refining Your Drafts)
Convierte los detalles de tu situación en **constraints específicos**. Añadir detalle en cada caso (nivel, enfoque, formato, restricciones dietéticas, etc.) le da al modelo más contexto para elaborar su respuesta.

> 🔑 **Cierre del curso:** al añadir detalle y convertirlo en constraints concretos, le das al modelo el contexto para acertar. **Con prompt engineering cuidadoso, puedes guiar al LLM para satisfacer necesidades muy específicas y complejas.**

---

## Quiz final (7 preguntas) — respuestas

1. **V/F:** "La respuesta de un LLM depende solo del texto con que fue entrenado, no de cómo redactas tu prompt."
   → **Falso.** La respuesta depende **tanto** del lenguaje de tu prompt **como** del lenguaje de entrenamiento.
2. **¿Qué tareas puedes hacer con un prompt?** (varias) → **Todas:** Chatting, Classification, Summarization, Creative Writing, Brainstorming.
3. **¿Qué rasgos hacen un prompt más complejo?** (varias) → **Información de fuentes de nicho / de un campo o profesión específica** y **requerir múltiples pasos interdependientes**. (No lo hacen: tener respuesta objetiva clara, ni preguntar por info común y ampliamente disponible.)
4. **¿Por qué los constraints son buenos para prompts útiles?** → **Ayudan al modelo a manejar mejor la complejidad**, dándole contexto/detalle de cómo responder. (No es que "más complejo siempre sea mejor", ni que "reduzcan la complejidad".)
5. **Ejemplos de constraints válidos** (varias) → **Todos:** limitar a <500 palabras, pedir tono humorístico, pedir que no adivine si no está seguro, pedir la respuesta en tabla, mencionar que vives en San Francisco para recomendaciones de restaurantes.
6. **¿Lo más crítico para que prompts/constraints sean naturales y no contrived?** → **Que estén claramente conectados con necesidades reales que tienes como usuario.** (No: lenguaje lo más formal posible, ni constraints muy complejos y multicapa.)
7. **¿Cómo mejorar un prompt para una respuesta más útil?** (varias) → **Añadir contexto** (p. ej. "soy principiante"), **especificar metas en detalle** (p. ej. "quiero que me enseñe a resolverlo, no solo la respuesta") y **dar más precisión sobre estructura/formato**. (NO: hacer el lenguaje más ambiguo.)

---

## Resumen ejecutivo (para llevar)

- Un **prompt** es el texto de entrada; el LLM devuelve la continuación más probable según su entrenamiento. La calidad de la salida depende de **cómo redactas** + **con qué se entrenó**.
- Hay **8 casos de uso**: Q&A, Chatbot, Brainstorming, Creative Writing, Extraction, Classification, Summarization, Rewriting (los reales suelen cruzarse).
- Prompts van de **simples a complejos**; la complejidad exige más contexto del modelo.
- **Constraints = la palanca**: condiciones (contenido, estilo/tono, formato, experticia, incertidumbre, geografía, tiempo) que suben la complejidad **pero** guían mejor la respuesta.
- Prefiere prompts **naturales** (casuales, variados, ligados a necesidades reales) sobre **contrived** (rígidos, monótonos, con restricciones inventadas).
- Flujo práctico: **Necesidad → Primer borrador → Refinar con constraints.**
