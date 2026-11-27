# Handoff del Evento: Plataforma de Manglares del Atlántico y Reto del Hackathon

## 1. Resumen ejecutivo del contexto institucional

La Corporación (CRA) está construyendo una **plataforma abierta para la restauración y conservación de los manglares del departamento del Atlántico**, articulando rigor técnico, reglamentación de actores y ciencia ciudadana:

* **Evaluación multiperspectiva del ecosistema:** combina muestras en tierra y muestras en agua con información satelital para analizar el estado integral del manglar.
* **Carbono y validación en terreno:** incluye estimaciones de reservas de carbono del manglar en el Atlántico (en estudio a profundidad ante el interés por los **bonos de carbono**), cuyos datos técnicos y satelitales deben contrastarse continuamente con metodología en terreno (*ground-truth*).
* **Reglamentación y registro obligatorio de actores:** se prepara una nueva reglamentación bajo la cual todos los actores que realicen acciones de **conservación, monitoreo o investigación** dentro del ecosistema deberán registrarse en la plataforma para dar trazabilidad a qué se hace y en qué ubicación específica (por ejemplo, **Juan de Acosta**).
* **Acceso abierto a la ciudadanía:** además del panel institucional de la Corporación, la plataforma abre una entrada para que la comunidad pueda **proponer proyectos** de conservación y participar en **monitoreo ciudadano**.
* **El problema operativo a resolver:** las denuncias ciudadanas (como alertas originadas cerca de una escuela en Juan de Acosta) suelen llegar tarde. La Corporación necesita un panel con información oportuna y detallada para tomar decisiones rápidas, activar operativos y atender emergencias ambientales a tiempo.
* **Red de mentoría:** el ecosistema del reto cuenta con **mentores comunitarios** (conocen el territorio y las situaciones reales que ocurren en campo) y **mentores académicos** (aportan terminología y clasificación técnica precisa).

## 2. Síntesis del reto y las 3 preguntas mínimas de gobernanza

> **Reto oficial:** diseñar y prototipar una herramienta digital de ciencia ciudadana para monitorear en tiempo real el manglar del Atlántico, usable por cualquier persona (jóvenes, estudiantes, turistas y comunidad local), incluso sin conexión a internet.

El prototipo debe dar respuesta, como mínimo, a **tres preguntas clave de gobernanza**:

| # | Pregunta de gobernanza | Qué exige demostrar | Cómo se articula en la solución |
| :--- | :--- | :--- | :--- |
| **1** | **¿Dónde ocurre una amenaza o cambio en el manglar ahora mismo, qué pasa y con qué prioridad de conservación coincide?** | Inmediatez real (un reporte de hace un mes no sirve para reaccionar) y ubicación exacta cruzada con prioridad de conservación. | Captura con fecha/hora y GPS exacto + cruce con zonas de manglar y validación de prioridad con mentores comunitarios y académicos. |
| **2** | **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?** | Garantizar rigor y evitar falsas alarmas antes de detonar operativos de la Corporación. | Evidencia fotográfica geolocalizada + flujo de verificación por mentores/IA + contraste con datos *ground-truth* de la CRA. |
| **3** | **¿Cómo sostener la participación de escuelas y turistas en el tiempo?** | Sostenibilidad y escalabilidad más allá del entusiasmo inicial del hackathon o lanzamiento. | Flujos simples sin fricción para turistas, integración educativa para escuelas y retroalimentación visible del impacto de cada reporte. |

## 3. Requisitos obligatorios y entregables (Vit Arena)

Todos los entregables deben cargarse durante la jornada en la zona de entrega habilitada para cada cuenta en la plataforma oficial **Vit Arena**:

| Entregable | Requisito específico |
| :--- | :--- |
| **Prototipo funcional real** | Debe ser funcional (**no solo un mockup**) y demostrar cómo cada reporte geolocaliza las zonas del manglar. |
| **Operación offline y foto GPS** | Captura de reportes y fotografías geolocalizadas sin internet, con sincronización posterior. |
| **Usabilidad universal** | Accesible y muy fácil de usar para jóvenes, estudiantes, turistas y habitantes locales desde cualquier lugar. |
| **Vista / dashboard para la CRA** | Panel de control (vista o mockup funcional) con ingreso de datos en vivo y comparación con datos *ground-truth* de la CRA. |
| **Exportación en formato abierto** | Posibilidad de exportar los datos capturados en formato abierto para cumplir con lineamientos de **Gobierno Digital**. |
| **Uso documentado de IA** | Se promueve el uso de inteligencia artificial; la ficha técnica debe detallar las **herramientas y modelos de IA** utilizados. |
| **Pitch con demo ante jurado** | Presentación de **máximo 7 minutos** mostrando el prototipo funcionando y respondiendo las 3 preguntas de gobernanza. |
| **Carga en Vit Arena** | Subir enlace al **repositorio en GitHub**, **archivos del proyecto** (incluida la **ficha técnica**) y **video demostrativo del prototipo**. |

## 4. Campos recomendados (esquema de datos)

El siguiente esquema traduce los requisitos del evento en campos concretos listos para base de datos, formularios y exportación en formato abierto.

### A. Reporte ciudadano de monitoreo (núcleo del prototipo)

| Campo | Tipo | Obligatorio | Propósito |
| :--- | :--- | :--- | :--- |
| `reporte_id` | UUID / String | Sí | Identificador único generado incluso en modo offline. |
| `timestamp_captura` | ISO-8601 DateTime | Sí | Fecha y hora exactas de captura para validar inmediatez ("ahora mismo"). |
| `latitud` / `longitud` | Float | Sí | Coordenadas GPS del evento para ubicar la zona exacta del manglar. |
| `precision_gps_m` | Float | Recomendado | Margen de error del GPS para evaluar confiabilidad espacial. |
| `zona_manglar` / `municipio` | String | Sí | Polígono o sector detectado automáticamente (ej. Juan de Acosta). |
| `tipo_evento` | Enum | Sí | Categoría amigable: daño a fauna/especies, tala/relleno, contaminación/residuos, cambio hídrico, otro. |
| `descripcion_ciudadana` | Text | Opcional | Relato breve en lenguaje cotidiano de lo observado. |
| `evidencia_foto` | Archivo / Base64 | Sí | Fotografía geolocalizada tomada en terreno. |
| `perfil_reportante` | Enum | Sí | `habitante_local`, `estudiante_escuela`, `turista`, `actor_registrado`. |
| `estado_sincronizacion` | Enum | Sí | `pendiente_offline`, `sincronizado`. |
| `estado_validacion` | Enum | Sí | `nuevo`, `validado_comunitario`, `validado_academico`, `alerta_oficial_cra`, `descartado`. |
| `clasificacion_tecnica` | String | Post-reporte | Etiqueta técnica asignada por mentor académico o sugerida por IA. |
| `nivel_prioridad` | Enum | Calculado | `alta`, `media`, `baja` según cruce con capas de prioridad y *ground-truth* de la CRA. |
| `puntaje_confiabilidad` | Integer / Enum | Calculado | Nivel de confianza basado en foto, GPS en polígono de manglar y aval de mentores. |

### B. Registro obligatorio de actores (reglamentación CRA)

| Campo | Tipo | Obligatorio | Propósito |
| :--- | :--- | :--- | :--- |
| `actor_id` | UUID / String | Sí | Identificador único del actor registrado. |
| `nombre_entidad_o_persona` | String | Sí | Quién ejecuta la intervención en el ecosistema. |
| `tipo_actor` | Enum | Sí | Comunidad, escuela, universidad, ONG, empresa, entidad pública. |
| `tipo_accion` | Enum | Sí | `conservacion`, `restauracion`, `monitoreo`, `investigacion`. |
| `municipio_ubicacion` | String / GeoJSON | Sí | Zona o polígono donde interviene (ej. Juan de Acosta). |
| `periodo_actividad` | Rango fechas | Sí | Vigencia de la intervención para control territorial. |

### C. Propuesta ciudadana de proyectos (módulo complementario)

| Campo | Tipo | Obligatorio | Propósito |
| :--- | :--- | :--- | :--- |
| `propuesta_id` | UUID / String | Sí | Identificador de la iniciativa ciudadana. |
| `titulo_proyecto` | String | Sí | Nombre corto de la propuesta de conservación o restauración. |
| `ubicacion_objetivo` | String / GPS | Sí | Sector del manglar donde se plantea actuar. |
| `proponente` | String | Sí | Persona, escuela o colectivo que postula la idea. |
| `resumen_objetivo` | Text | Sí | Qué problema territorial aborda y resultado esperado. |

## 5. Features clave por módulo

### Módulo 1: App / Web App ciudadana (Mobile-First y Offline-First)
* **Captura ultrarrápida (3 pasos):** elegir tipo de alerta (con íconos claros para jóvenes, estudiantes y turistas), tomar foto y confirmar ubicación sin formularios largos.
* **Modo sin conexión real (PWA / almacenamiento local):** guarda reportes y fotos en el dispositivo (por ejemplo, IndexedDB) con un indicador visible de cola pendiente y sincronización automática al recuperar señal.
* **Geolocalización sobre zonas de manglar:** detecta coordenadas del dispositivo, muestra el punto sobre el mapa de manglares del Atlántico y señala si cae dentro de una zona prioritaria.
* **Asistencia con IA en la captura:** preclasificación automática de la foto o texto ciudadano hacia categorías técnicas (amenaza a fauna, residuos, afectación de cobertura) para facilitar el trabajo de los mentores.

### Módulo 2: Gobernanza y validación de confiabilidad
* **Flujo de doble validación:** vista rápida para que **mentores comunitarios** confirmen que el hecho ocurre en terreno ahora mismo y **mentores académicos** validen la clasificación técnica y severidad.
* **Semáforo de confiabilidad:** etiqueta automática que combina presencia de foto, timestamp reciente, coincidencia GPS con polígono de manglar y corroboración (varios reportes cercanos o aval de mentor) antes de activar alerta oficial.
* **Cruce con datos *ground-truth* de la CRA:** comparación en pantalla entre los registros ciudadanos y los datos base/campo de la CRA para priorizar conservación y validar consistencia.

### Módulo 3: Panel de control (Dashboard) para la CRA
* **Mapa operativo en tiempo real:** visualización de alertas activas filtrables por municipio (ej. Juan de Acosta), prioridad de conservación, tipo de amenaza y estado de validación.
* **Bandeja de respuesta rápida:** lista priorizada de emergencias verificadas para decidir operativos sin retraso y actualizar el estado de atención (*en revisión*, *operativo en curso*, *atendido*).
* **Sección de trazabilidad de actores y proyectos:** directorio básico de actores registrados por zona y buzón de propuestas ciudadanas.

### Módulo 4: Datos abiertos (Gobierno Digital)
* **Exportación en un clic:** descarga directa de la muestra de reportes filtrados en formatos abiertos estándar (**CSV** y **GeoJSON** o **JSON**), manteniendo campos estandarizados y sin exponer datos personales sensibles del ciudadano.

### Módulo 5: Sostenibilidad y retención (Escuelas y Turistas)
* **Modo Escuelas:** retos periódicos por institución educativa, bitácora de avistamientos/monitoreo y tablero de aportes por escuela para integrarlo a proyectos escolares ambientales.
* **Modo Turistas sin fricción:** acceso rápido mediante código QR en senderos o muelles turísticos (sin registro pesado), con ficha educativa breve del manglar y opción de reportar en menos de 1 minuto.
* **Cierre del ciclo de retroalimentación:** notificación o estado público donde quien reportó puede ver que su alerta fue validada y atendida por la CRA.

## 6. Checklist final antes de subir a Vit Arena

* [ ] **Demo en vivo probada sin internet:** simular modo avión, crear un reporte con foto y GPS, reconectar y verlo aparecer en el dashboard de la CRA.
* [ ] **Cruce *ground-truth* visible:** mostrar en pantalla cómo un reporte geolocalizado se contrasta con datos base de la CRA y asigna prioridad de conservación.
* [ ] **Exportación abierta verificada:** descargar un archivo CSV/GeoJSON real desde el prototipo y tener una muestra lista para subir.
* [ ] **Ficha técnica completa:** incluir arquitectura, stack, diccionario de datos abiertos y lista explícita de **herramientas y modelos de IA** usados.
* [ ] **Paquete en Vit Arena completo:** link público de GitHub + ficha técnica/archivos + video demostrativo del prototipo.
* [ ] **Pitch cronometrado (máx. 7 min):** problema y contexto CRA (1 min) → demo en vivo offline + dashboard + exportación (3.5 min) → respuestas explícitas a las 3 preguntas de gobernanza y uso de IA (2 min) → cierre e impacto escalable (30 s).
