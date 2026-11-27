---
name: cra-manglar-domain
description: >-
  Use when designing features, data models, UI copy, validation workflows,
  scoring rules, or pitch/deliverables for the CRA Atlántico Mangroves
  citizen-science hackathon prototype and Vit Arena submission.
---

# Dominio CRA — Manglares del Atlántico

Guía operativa del reto institucional de la **Corporación Autónoma Regional del Atlántico (CRA)** para monitoreo ciudadano en tiempo real, gobernanza y sostenibilidad del manglar del Atlántico.

## 1. Cobertura territorial oficial (4 Sectores y 5 Ciénagas)

Consultar cifras exactas en [cra_metrics.md](./references/cra_metrics.md).

1. **Zona 1 — Mallorquín – Bocas de Ceniza** (`347.6 ha` referencia · riesgo medio `0.383` · mayor presión antrópica `0.776`)
2. **Zona 2 — Puerto Colombia – Balboa – Puerto Velero** (`91.4 ha` referencia · riesgo medio `0.418`)
3. **Zona 3 — Tubará – Juan de Acosta** (`45.4 ha` referencia · **mayor sequía del dosel `-0.151`** y **mayor riesgo medio `0.436`**)
4. **Zona 4 — Totumo – Astilleros – Galerazamba** (`290.5 ha` referencia · **451.8 ha por revisar**, el mayor rezago de verificación en campo)

Ciénagas incluidas en el monitoreo CRA: `Ciénaga de Mallorquín`, `Ciénaga Manatíes`, `Ciénaga de Balboa`, `Ciénaga El Salado`, `Ciénaga del Totumo`.

## 2. Taxonomía ciudadana vs. clasificación técnica académica

La captura ciudadana debe ser amigable (< 1 minuto, 3 pasos), mientras la validación técnica traduce a categorías del Plan de Manejo CRA:

| Tipo de evento ciudadano (`tipo_evento`) | Descripción amigable en app | Posible clasificación técnica académica |
| :--- | :--- | :--- |
| `dano_fauna_especies` | Daño o amenaza a fauna / especies | Perturbación de hábitat / extracción de fauna asociada |
| `tala_relleno` | Tala, quema o relleno del manglar | Pérdida de cobertura / relleno / expansión urbana o agropecuaria |
| `contaminacion_residuos` | Basura, vertimientos o contaminación | Presión antrópica por residuos sólidos / vertimiento hídrico |
| `cambio_hidrico` | Caño taponado, sequía o mortandad | Alteración hidrológica / hipersalinidad / estrés hídrico |
| `otro` | Avistamiento positivo o hallazgo por revisar | Validación de cobertura (`ground-truth`) / observación en campo |

Acciones del Plan de Manejo heredadas al cruzar con capas CRA (`AccionGen`):
- `Preservación` · `Restauración` · `Recuperación` · `Rehabilitación`

## 3. Flujo de doble validación y Semáforo de Confiabilidad

### Estados de validación (`estado_validacion`)
1. `nuevo` — Recién capturado por ciudadano/estudiante/turista (online u offline sincronizado).
2. `validado_comunitario` — Confirmado por **mentor comunitario** (hecho real en territorio, contexto local).
3. `validado_academico` — Clasificación técnica y severidad confirmadas por **mentor académico** (o avalado junto con evidencia IA + *ground-truth*).
4. `alerta_oficial_cra` — Promovido para activar operativo institucional CRA (`attention_status`: `pendiente` → `en_revision` → `operativo_en_curso` → `atendido`).
5. `descartado` — Falsa alarma, duplicado o fuera de contexto (con motivo registrado en bitácora).

### Semáforo de Confiabilidad (`puntaje_confiabilidad`, 0–100 pts)
- **+25 pts:** Evidencia fotográfica geolocalizada adjunta (con hash/EXIF o captura en sitio).
- **+25 pts:** Coordenadas GPS dentro de polígono de manglar, prioridad de conservación o buffer costero (<= 250 m), con `precision_gps_m <= 50` (si es modo `SIMULADO (DEMO)`, marcar bandera explícita).
- **+15 pts:** Inmediatez de captura (`timestamp_captura` < 24 h respecto al reporte/alerta).
- **+15 pts:** Coincidencia o corroboración espacial (otro reporte en <= 500 m / 48 h o cercanía a zona *ground-truth* / área por revisar CRA).
- **+20 pts:** Aval de mentor (+10 comunitario, +10 académico).

Umbrales visuales del semáforo:
- **Verde (`>= 75`):** Alta confiabilidad — candidato inmediato a `alerta_oficial_cra`.
- **Ámbar (`45–74`):** Confiabilidad media — requiere revisión de mentor comunitario/académico.
- **Rojo (`< 45`):** Baja confiabilidad — información incompleta o fuera de zona prioritaria.

## 4. Módulos obligatorios de gobernanza y sostenibilidad

1. **Registro obligatorio de actores (`registered_actors`):** Trazabilidad exigida por la reglamentación CRA y Resolución 1263 de 2018 (`conservacion`, `restauracion`, `monitoreo`, `investigacion`) con polígono/sector y vigencia.
2. **Propuestas ciudadanas (`citizen_proposals`) y checklists oficiales (`/maqueta`):** Postulación de iniciativas comunitarias/escolares que heredan automáticamente sector, prioridad y acción del Plan de Manejo al marcar el punto en el mapa, e incluyen las **4 listas de chequeo oficiales CRA** (6 ítems c/u):
   - **`Siembra`:** (1) Especie y procedencia de vivero local/propágulos del mismo sector; (2) Sitio dentro de manglar probable, áreas por revisar o restauración; (3) Temporada de lluvias, salinidad y marea verificadas; (4) Permiso o concepto CRA según **Resolución 1263 de 2018**; (5) Participación comunitaria acordada por escrito; (6) Plan de monitoreo (supervivencia a 3, 6 y 12 meses con fotos ubicadas).
   - **`Restauración hidrológica`:** (1) Diagnóstico de flujo de agua (caños taponados, diques, salinidad); (2) Diseño con cotas y volumen de sedimento; (3) Concepto CRA y autoridad marítima si aplica; (4) Manejo de sedimentos y residuos; (5) Medidas para no afectar pesca ni acceso comunitario; (6) Línea base de espejo de agua y turbidez del workflow.
   - **`Solución basada en la naturaleza`:** (1) Problema atendido y evidencia; (2) Alternativa gris descartada y por qué; (3) Especies nativas y materiales biodegradables; (4) Mantenimiento a 5 años y responsable; (5) Indicadores de servicio (retroceso costero, altura del dosel, carbono); (6) Consulta previa verificada cuando aplique.
   - **`Conservación y vigilancia`:** (1) Área definida sobre el mapa; (2) Protocolo de reporte de tala, relleno o vertimiento; (3) Vínculo CRA + Policía Ambiental; (4) Capacitación de vigías comunitarios; (5) Registro fotográfico periódico; (6) Seguimiento trimestral con capa de cambios del workflow.
   - **Ciclo oficial de estados de propuestas/acciones (`EST`):** `Propuesta` → `En revisión` → `Con observaciones` → `Aprobada` → `En ejecución` → `Cerrada`.
   - **Formulación guiada (MGA — DNP y Nota Conceptual de Cooperación):** Prellenado automático con cifras del sitio (`manglar probable`, `por revisar`, `dosel seco`, `riesgo`) y cálculo de contribución climática con el factor oficial **`3.667`** (`t CO₂e = ha × tC/ha × 3.667`).
   - **Retorno al workflow satelital:** Cada fotografía geolocalizada y validada genera una etiqueta *ground-truth* independiente para reentrenar los modelos satelitales de la CRA.
3. **Modo Escuelas:** Selector/código de institución educativa, retos periódicos (ej. verificar las **828 ha por revisar** cerca a Juan de Acosta o Mallorquín) y tablero de aportes escolares.
4. **Modo Turistas QR:** Acceso directo por URL/QR (`?modo=turista&estacion=...`) sin registro previo, ficha educativa breve del manglar y reporte en menos de 60 segundos.
5. **Cierre de ciclo:** Vista pública o consulta por código de reporte donde quien reportó ve si su alerta fue validada y atendida por la CRA.

## 5. Checklist de entregables Vit Arena

- [ ] Prototipo funcional real (no mockup) con geolocalización sobre capas del Atlántico.
- [ ] Prueba en vivo de captura offline (modo avión) + foto + GPS + sincronización automática.
- [ ] Dashboard CRA en tiempo real con contraste contra datos *ground-truth* (`524` puntos CRA + `828 ha` por revisar).
- [ ] Exportación en un clic en **CSV** y **GeoJSON** anonimizados (Gobierno Digital / Ley 1581 de 2012).
- [ ] Ficha técnica documentando arquitectura, diccionario de datos abiertos y modelos/herramientas de IA usados.
- [ ] Repo público en GitHub + video demo + pitch <= 7 min respondiendo las 3 preguntas de gobernanza.
