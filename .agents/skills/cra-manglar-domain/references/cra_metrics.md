# Métricas Oficiales CRA Atlántico y Resumen del KMZ

Datos extraídos directamente de `https://manglarcra.netlify.app/data/core.json`, `hl.json` y `/Users/adrianstivengarzon/manglarhakcaton/Prioridades de Conservación (1).kmz`.

## 1. Cifras globales del ecosistema de manglar (CRA 2015–2026)

- **Manglar probable total:** `775 ha` (`465 ha` con probabilidad alta)
- **Áreas en observación / por revisar en campo:** `828 ha`
- **Dosel más seco en 2026 (anomalía <= -0.10 / -0.05):** `262 ha` (umbral `-0.10`) / `419.1 ha` (umbral `-0.05`)
- **Reserva total de carbono estimada:** `125,000 tC` (`270 tC/ha` promedio: `248 tC/ha` en suelo, `17 tC/ha` aérea, `4.5 tC/ha` en raíces)
- **Puntos *ground-truth* de validación CRA (`hl.json['pts']`):** `524` puntos verificados (`208` positivos / `316` negativos o contraste)
- **Plan de Manejo integrado en plataforma CRA (`/plataforma` y `/maqueta`):** `19,834 ha` (`5,199` polígonos) — cubre `554 ha` de las `775 ha` de manglar probable y deja **`221 ha` fuera de la zonificación**:
  - `Preservación`: `10,070 ha` (`415.8 ha` ≈ `416 ha` de manglar)
  - `Restauración`: `6,088 ha` (`70.0 ha` de manglar)
  - `Recuperación`: `2,938 ha` (`63.8 ha` ≈ `64 ha` de manglar)
  - `Rehabilitación`: `738 ha` (`4.4 ha` ≈ `4 ha` de manglar)
  - `Fuera de la zonificación`: `221 ha` de manglar probable
- **Parámetros `SITE` de `/maqueta` para formuladores (MGA / Cooperación):**
  - Sector 1 (Mallorquín): `270 tC/ha` · Sector 2 (Puerto Colombia): `255 tC/ha` · Sector 3 (Tubará – Juan de Acosta): `250 tC/ha` · Sector 4 (Totumo – Galerazamba): `262 tC/ha` · Factor `CO₂e`: `3.667`.

## 2. Desglose por los 4 sectores costeros oficiales

| Zona | Sector | Manglar ref. (ha) | Alta prob. (ha) | Por revisar (ha) | Dosel seco `-0.05` (ha) | Anomalía dosel | Riesgo medio | Vuln. media | Carbono (tC) | Centroide aprox. (WGS84) |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |
| **1** | Mallorquín – Bocas de Ceniza | 347.6 | 261.7 | 168.3 | 167.6 | -0.046 | 0.383 | 0.366 | 70,659 | `11.038055, -74.876041` |
| **2** | Puerto Colombia – Balboa – Puerto Velero | 91.4 | 59.7 | 105.8 | 77.7 | -0.102 | 0.418 | 0.589 | 16,119 | `10.945289, -75.003661` |
| **3** | Tubará – Juan de Acosta | 45.4 | 26.9 | 102.3 | 42.0 | **-0.151** | **0.436** | **0.641** | 7,263 | `10.866949, -75.104856` |
| **4** | Totumo – Astilleros – Galerazamba | 290.5 | 116.4 | **451.8** | 131.8 | -0.044 | 0.331 | 0.512 | 31,428 | `10.755924, -75.210915` |

## 3. Análisis del archivo `Prioridades de Conservación (1).kmz`

- **Total de polígonos:** `14,732` (`700,898.97 ha` sumadas en `AREA_HA`)
- **Bounding Box aproximado:** lat `[10.25877, 11.06144]`, lon `[-75.24527, -74.72566]`
- **Subzonas hidrográficas (`NOMSZH`):**
  - `Arroyos Directos al Caribe`: `7,079` polígonos (costero)
  - `Cienaga Mallorquin`: `2,329` polígonos (costero)
  - `Canal del Dique`: `3,271` polígonos
  - `Directos al Bajo Magdalena entre Calamar y desembocadura al mar Caribe (mi)`: `1,961` polígonos
  - `Rio Magdalena`: `92` polígonos
  - **Total costero (`Arroyos Directos al Caribe` + `Cienaga Mallorquin`):** `9,408` polígonos (`540,117.61 ha`)
- **Prioridad (`Val_Priori`):** `Alto`: `6,505` · `Medio`: `5,390` · `Bajo`: `2,837`
- **Acción general (`AccionGen`):** `Preservación`: `5,815` · `Restauración`: `4,335` · `Recuperación`: `3,898` · `Rehabilitación`: `684`
- **Áreas protegidas RUNAP (`Cat_Runap = 'Runap'`, `1,077` polígonos):**
  - `DMI Palmar - Titi` (`558`)
  - `PNR Los Rosales` (`201`)
  - `RFP El Palomar` (`172`)
  - `DMI Luriza` (`120`)
  - `RNSC_LosCharcones` (`26`)
- **Complejos prioritarios (`NOM_APC`):**
  - `Complejo de bosques y arbustales secos del corredor Turbaco-Canalete-Tubará'` (`2,632`)
  - `Complejo de humedales y bosques secos del Guajaro` (`1,558`)
  - `Blanco - Totumo - Bijibana` (`1,069`)
  - `Complejo cenagoso El Totumo y La Venia` (`897`)
  - `Complejo cenagoso de El Uvero-La Poza` (`219`)
  - `Complejo cenagoso del Canal del Dique` (`26`)

## 4. Ecosistema del Linktree oficial CRA (`linktr.ee/cratlantico`)

- **`https://manglarcra.netlify.app/`** (`/workflow`, `/plataforma`, `/maqueta`): Visor 2D/3D Copernicus Sentinel-2 (2015–2026) + maqueta estática Fase 2 en memoria.
- **`https://www.crautonoma.gov.co/red-viva-manglar/`**: Red Viva del Manglar (metodología GAIN Partners, directorio de iniciativas, grafo de alianzas y vacíos reportados conectados a Ficha Única).
- **`https://www.crautonoma.gov.co/atlantico-verde/`**: Mapa de la Naturaleza del Atlántico (`PNR Los Rosales`, `DRMI Palmar del Tití`, `Ciénaga de Mallorquín`, lagunas de Tocagua y Luruaco).
