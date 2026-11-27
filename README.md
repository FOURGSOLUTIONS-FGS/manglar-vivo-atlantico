# Manglar Vivo Atlántico — Ciencia Ciudadana y Alerta Temprana CRA (Vit Arena)

Plataforma **offline-first** de monitoreo ciudadano, validación territorial de doble nivel, despacho SOLID de alertas y gobernanza abierta para los manglares del departamento del Atlántico (**Corporación Autónoma Regional del Atlántico — CRA**).

- **Producción:** https://manglar-vivo-atlantico.vercel.app (y subdominio https://manglar.arpadura.com)
- **Ficha técnica y transparencia IA:** [FICHA_TECNICA.md](./FICHA_TECNICA.md)
- **Guion de demo 7 minutos (Vit Arena):** [PITCH_VIT_ARENA.md](./PITCH_VIT_ARENA.md)

## Las 3 preguntas de gobernanza que resuelve

1. **¿Dónde ocurre una amenaza o cambio ahora mismo, qué pasa y con qué prioridad coincide?**
   - Captura en 3 pasos (`/reportar`) con **4 dominios × 12 factores específicos**, **dictado por voz (`es-CO`)**, timestamp ISO-8601, GPS honesto (y modo demo marcado explícitamente `SIMULADO (DEMO)`) y cruce espacial instantáneo —incluso en modo avión— contra los **9,408 polígonos costeros** del KMZ CRA, las **775 ha de manglar probable**, las **828 ha por revisar** y las **262 ha de dosel seco 2026**.
2. **¿Cómo se valida que el dato ciudadano es confiable antes de integrarlo a alertas oficiales?**
   - Foto original preservando **EXIF**, **filtro visual IA anti-falsos positivos** (`google/gemini-2.5-flash` vía OpenRouter: 100 % rechazo a fotos de interiores/personas con penalización `0/25` y bloqueo de alertas rojas), **Semáforo de Confiabilidad (0–100 pts)**, contraste en **PostGIS** contra los **524 puntos *ground-truth*** de la CRA, doble validación (`/validar`) y **Centro Admin (`/admin`)** con 4 niveles de alerta, sonidos Web Audio, notificaciones en vivo y despacho real de correos HTML vía Hostinger SMTP.
3. **¿Cómo sostener la participación de escuelas y turistas en el tiempo?**
   - **Modo Escuelas (`/escuelas`):** adopción de las `828 ha por revisar`, bitácora PRAES y cierre de ciclo en 4 estaciones por código `MGL-2026-XXXX`.
   - **Modo Turistas QR (`/turista`):** ficha educativa de 30 s + QR real escaneable y reporte < 1 minuto sin registro.
   - **Participación y Formulación (`/participacion`):** registro obligatorio de actores (Ley 1581), 4 listas de chequeo (Res. 1263/2018), seguimiento de 6 estados y borradores prellenados **MGA (DNP)** y **CO₂e (`× 3.667`)**.

## Verificación y pruebas

```bash
npm install
npm test                         # 5 pruebas unitarias SOLID (clasificador, anti-falsos, correo, DIP)
node scripts/test_vision_dataset.mjs  # Benchmark de 14 fotos reales contra IA en producción
npm run build                    # Compilación producción Next.js 16 + TypeScript
```

## Desarrollo local

```bash
cp .env.example .env.local
# Configura Supabase, OpenRouter y Hostinger SMTP en .env.local
npm run dev
```
