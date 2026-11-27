# Guion de Demostración en Vivo — Vit Arena (Máx. 7 minutos)

**URL Producción:** `https://manglar-vivo-atlantico.vercel.app` (o `https://manglar.arpadura.com`)  
**PIN Centro Admin CRA:** `2026` (también tiene botón *Acceso Demo Jurado* en 1 clic)

---

### Minuto 0:00 – 1:00 · Territorio real del Atlántico (`/`)
- Abre la portada con video aéreo oficial de la CRA y baja al **Teatro Satelital Costero** (imágenes Sentinel-2 reales `z1`–`z4`).
- Selecciona **Tubará – Juan de Acosta** (`-0.151` anomalía de sequía 2026, riesgo `0.436`) y **Totumo** (`451.8 ha` por revisar de las `828 ha`).
- **Frase clave:** *"La CRA ya tiene teledetección de primer nivel; nuestra solución conecta esa línea base satelital con los ojos de comunidades, colegios y turistas — incluso sin señal de internet."*

### Minuto 1:00 – 3:00 · Captura en 3 pasos, dictado por voz y filtro IA anti-falsos (`/reportar`)
1. **Paso 1:** Muestra la taxonomía limpia de **4 dominios × 12 factores exactos** (elige `Cobertura y Suelo → Quema o incendio`).
2. **Paso 2 (Momento WOW #1 — Blindaje de confiabilidad):**
   - Abre **"Probar con dataset (13 fotos)"** y selecciona primero **"Prueba negativa: foto de interior"** (o toma una foto del auditorio).
   - Muestra cómo Gemini Vision la **rechaza en vivo (`0/25 pts`)**, explica qué vio realmente y **bloquea la falsa alerta roja**.
   - Ahora elige la foto real de **`Quema o incendio en borde`** (o usa el botón **"Dictar con tu voz"** en español colombiano): la IA confirma la amenaza real (`+25 pts`).
3. **Paso 3:** Activa un punto satelital (`Juan de Acosta`, claramente etiquetado **`SIMULADO (DEMO)`** por honestidad GPS), muestra el cruce espacial instantáneo contra KMZ + 828 ha + Dosel Seco 2026 y envía el reporte.
4. **Recibo claro hasta para un niño:** suena el tono de alerta, entrega código `MGL-2026-XXXX` y muestra en lenguaje simple **quién acaba de recibir el aviso** (Sala CRA + Policía Ambiental, meta `< 2 h`).

### Minuto 3:00 – 5:00 · Gobernanza, Doble Validación y Correo Urgente en Vivo (`/admin` y `/validar`)
- Abre **`/admin`**, desbloquea con 1 clic (**Acceso Demo Jurado**), activa notificaciones y reproduce la sirena urgente.
- Muestra la pestaña **"¿Quién recibe cada alerta?"** (4 niveles: Roja `< 2 h`, Naranja `< 24 h`, Azul `< 48 h`, Verde `828 ha`).
- En **"Correos urgentes"**, envía en vivo una alerta real vía **Hostinger SMTP** (`alertas-manglar@arpadura.com`) al correo de prueba (o al celular de un jurado) y muestra el correo HTML con foto, mapa GPS, semáforo y botón que abre directamente `/admin?code=MGL-...`.
- Muestra brevemente **`/validar`** (doble aval Comunitario + Académico contrastado contra los **524 puntos ground-truth**).

### Minuto 5:00 – 6:15 · Sostenibilidad en el tiempo (`/escuelas`, `/turista`, `/participacion`)
- **`/escuelas`:** consulta el código `MGL-2026-0101` para demostrar el **cierre de ciclo en 4 estaciones** (los estudiantes ven cuándo la CRA atendió su alerta).
- **`/turista`:** muestra la estación QR real escaneable para visitantes sin registro.
- **`/participacion`:** toca el mapa para heredar Plan de Manejo + checklist Res. 1263/2018 + descarga de borrador **MGA (DNP)** y **Nota Conceptual CO₂e (`× 3.667`)**.

### Minuto 6:15 – 7:00 · Sala Satelital, Datos Abiertos y Cierre (`/cra`)
- Muestra **`/cra`** en tiempo real (Supabase Realtime + capas KMZ/828 ha/Dosel seco) y haz clic en **Exportar CSV / GeoJSON (Ley 1581)** anonimizado y enriquecido con los 12 subtipos y nivel de alerta.
- **Cierre:** *"Offline-first real, arquitectura SOLID con pruebas automatizadas, IA transparente y auditada al 100 % contra falsos positivos, y lista para operar hoy con la CRA Atlántico."*
