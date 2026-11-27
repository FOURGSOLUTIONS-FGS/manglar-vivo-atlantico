"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CheckSquare, FileText, MapPin, PlusCircle, Users } from "lucide-react";
import {
  buildCoopConceptDraft,
  buildMgaDraft,
  CRA_SECTORS,
  OFFICIAL_CHECKLISTS,
  PROPOSAL_STATES,
  type ProposalActionType,
} from "@/lib/cra-domain";
import { analyzeLocationOffline } from "@/lib/spatial-offline";

const CraMap = dynamic(() => import("@/components/CraMap"), { ssr: false });

interface ActorItem {
  id: string;
  nombre_entidad_o_persona: string;
  tipo_actor: string;
  tipo_accion: string;
  sector_id: number;
  municipio_ubicacion: string;
}

interface ProposalItem {
  id: string;
  proponente: string;
  titulo_proyecto: string;
  tipo_accion: ProposalActionType;
  hectareas: number;
  sector_id: number;
  ubicacion_objetivo: string;
  accion_plan_heredada: string;
  prioridad_heredada: string;
  checklist_cumplimiento: number[];
  estado: string;
}

export default function ParticipacionPage() {
  const [tab, setTab] = useState<"actores" | "proponer" | "seguimiento" | "formulacion">(
    "proponer"
  );
  const [actors, setActors] = useState<ActorItem[]>([]);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);

  // Form Actor
  const [actorName, setActorName] = useState("");
  const [actorType, setActorType] = useState("Comunidad u organización de base");
  const [actorAction, setActorAction] = useState("conservacion");
  const [actorSector, setActorSector] = useState(3);
  const [actorMuni, setActorMuni] = useState("Juan de Acosta");

  // Form Propuesta sobre el mapa
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>({
    lat: 10.8719,
    lon: -75.0972,
  });
  const [inherited, setInherited] = useState({
    sectorId: 3,
    sectorNombre: "Tubará – Juan de Acosta",
    accionPlan: "Preservación",
    prioridad: "Alta",
  });
  const [propTitle, setPropTitle] = useState("");
  const [propActorIdx, setPropActorIdx] = useState(0);
  const [propTipo, setPropTipo] = useState<ProposalActionType>("Siembra");
  const [propHa, setPropHa] = useState(2.5);
  const [propSummary, setPropSummary] = useState("");
  const [checklist, setChecklist] = useState<number[]>([1, 1, 0, 0, 1, 0]);

  // Formulación MGA / Cooperación
  const [selectedPropId, setSelectedPropId] = useState<string>("");
  const [draftMode, setDraftMode] = useState<"mga" | "coop">("mga");

  const loadAll = async () => {
    const [aRes, pRes] = await Promise.all([fetch("/api/actors"), fetch("/api/proposals")]);
    if (aRes.ok) {
      const aJson = await aRes.json();
      setActors(aJson.actors || []);
    }
    if (pRes.ok) {
      const pJson = await pRes.json();
      const list = (pJson.proposals || []) as ProposalItem[];
      setProposals(list);
      if (list.length > 0 && !selectedPropId) setSelectedPropId(list[0].id);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handlePickMap = async (lat: number, lon: number) => {
    setPicked({ lat, lon });
    const ctx = await analyzeLocationOffline(lat, lon);
    const accion = ctx.kmzAccionPlan || "Restauración";
    const prio = ctx.kmzPrioridad || (accion === "Preservación" ? "Alta" : "Media");
    setInherited({
      sectorId: ctx.sector.id,
      sectorNombre: ctx.sector.nombre,
      accionPlan: accion,
      prioridad: prio,
    });
  };

  const handleCreateActor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actorName.trim()) return;
    await fetch("/api/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_entidad_o_persona: actorName,
        tipo_actor: actorType,
        tipo_accion: actorAction,
        sector_id: actorSector,
        municipio_ubicacion: actorMuni,
        acepta_ley_1581: true,
      }),
    });
    setActorName("");
    loadAll();
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propTitle.trim()) return;
    const actor = actors[propActorIdx];
    await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor_id: actor?.id ?? null,
        proponente: actor?.nombre_entidad_o_persona ?? "Comunidad local",
        titulo_proyecto: propTitle,
        tipo_accion: propTipo,
        hectareas: propHa,
        sector_id: inherited.sectorId,
        ubicacion_objetivo: inherited.sectorNombre,
        latitud: picked?.lat ?? null,
        longitud: picked?.lon ?? null,
        accion_plan_heredada: inherited.accionPlan,
        prioridad_heredada: inherited.prioridad,
        resumen_objetivo: propSummary,
        checklist_cumplimiento: checklist,
      }),
    });
    setPropTitle("");
    setPropSummary("");
    setTab("seguimiento");
    loadAll();
  };

  const advanceProposal = async (p: ProposalItem) => {
    const idx = PROPOSAL_STATES.indexOf(p.estado as (typeof PROPOSAL_STATES)[number]);
    const next = PROPOSAL_STATES[Math.min(PROPOSAL_STATES.length - 1, Math.max(0, idx + 1))];
    await fetch("/api/proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, estado: next }),
    });
    loadAll();
  };

  const activeProp = proposals.find((p) => p.id === selectedPropId) ?? proposals[0];
  const draftText = activeProp
    ? draftMode === "mga"
      ? buildMgaDraft({
          titulo: activeProp.titulo_proyecto,
          proponente: activeProp.proponente,
          tipoAccion: activeProp.tipo_accion,
          hectareas: Number(activeProp.hectareas),
          sectorId: activeProp.sector_id,
          accionPlan: activeProp.accion_plan_heredada || "Restauración",
          prioridad: activeProp.prioridad_heredada || "Alta",
        })
      : buildCoopConceptDraft({
          titulo: activeProp.titulo_proyecto,
          proponente: activeProp.proponente,
          tipoAccion: activeProp.tipo_accion,
          hectareas: Number(activeProp.hectareas),
          sectorId: activeProp.sector_id,
          accionPlan: activeProp.accion_plan_heredada || "Restauración",
        })
    : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:pt-8">
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#005F96]">
          Evolución real de manglarcra.netlify.app/maqueta · Supabase PostGIS
        </p>
        <h1 className="font-display mt-1 text-3xl font-black text-[#08334C]">
          Actores, Checklists CRA y Formulación MGA / CO₂e
        </h1>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: "proponer", label: "Proponer acción en mapa", icon: PlusCircle },
          { id: "actores", label: "Registro obligatorio de actores", icon: Users },
          { id: "seguimiento", label: "Seguimiento (6 estados)", icon: CheckSquare },
          { id: "formulacion", label: "Borrador MGA / Cooperación", icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
                active
                  ? "bg-[#005F96] text-white"
                  : "border border-[#08334C]/12 bg-white text-[#08334C] hover:bg-[#F7F3EA]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "proponer" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="mb-2 text-xs font-black text-[#08334C]/75">
              <MapPin className="mr-1 inline h-4 w-4 text-[#005F96]" />
              Haz clic en el mapa para heredar Sector, Acción y Prioridad reales del KMZ:
            </p>
            <CraMap
              reports={[]}
              layersVisible={{
                priorities: true,
                manglarProbable: true,
                porRevisar: true,
                doselSeco: false,
                groundTruth: false,
                reports: false,
              }}
              onPickPoint={handlePickMap}
              pickedPoint={picked}
              heightClass="h-[420px]"
            />
          </div>

          <form onSubmit={handleCreateProposal} className="bezel-outer lg:col-span-6">
            <div className="bezel-inner space-y-4 p-6">
              <div className="rounded-2xl bg-[#F7F3EA] p-3.5 text-xs">
                <p className="font-black text-[#005F96]">Herencia automática en el punto:</p>
                <p className="mt-1 font-bold text-[#08334C]">
                  {inherited.sectorNombre} · Plan: {inherited.accionPlan} · Prioridad:{" "}
                  {inherited.prioridad}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black text-[#08334C]/70">
                  Actor proponente
                </label>
                <select
                  value={propActorIdx}
                  onChange={(e) => setPropActorIdx(Number(e.target.value))}
                  className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
                >
                  {actors.map((a, idx) => (
                    <option key={a.id} value={idx}>
                      {a.nombre_entidad_o_persona}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-black text-[#08334C]/70">
                    Tipo de acción CRA
                  </label>
                  <select
                    value={propTipo}
                    onChange={(e) => setPropTipo(e.target.value as ProposalActionType)}
                    className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
                  >
                    {(Object.keys(OFFICIAL_CHECKLISTS) as ProposalActionType[]).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-black text-[#08334C]/70">
                    Hectáreas previstas
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={propHa}
                    onChange={(e) => setPropHa(Number(e.target.value))}
                    className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-black text-[#08334C]/70">
                  Nombre corto del proyecto
                </label>
                <input
                  type="text"
                  required
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  placeholder="Ej. Restauración participativa caño Juan de Acosta"
                  className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-black text-[#08334C]/70">
                  Checklist oficial CRA (Res. 1263 de 2018 · 6 ítems):
                </p>
                <div className="space-y-1.5">
                  {OFFICIAL_CHECKLISTS[propTipo].map((item, i) => (
                    <label key={item} className="flex items-start gap-2 text-xs text-[#08334C]/85">
                      <input
                        type="checkbox"
                        checked={Boolean(checklist[i])}
                        onChange={(e) =>
                          setChecklist((prev) =>
                            prev.map((v, idx) => (idx === i ? (e.target.checked ? 1 : 0) : v))
                          )
                        }
                        className="mt-0.5"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[48px] w-full rounded-full bg-[#005F96] text-sm font-black text-white hover:bg-[#08334C]"
              >
                Enviar propuesta a la CRA
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === "actores" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <form onSubmit={handleCreateActor} className="bezel-outer lg:col-span-5">
            <div className="bezel-inner space-y-3.5 p-6">
              <h2 className="font-display text-xl font-bold text-[#08334C]">
                Registro obligatorio de actores (Reglamentación CRA)
              </h2>
              <input
                type="text"
                required
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                placeholder="Nombre de entidad, escuela, ONG o líder"
                className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
              />
              <select
                value={actorType}
                onChange={(e) => setActorType(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
              >
                <option>Comunidad u organización de base</option>
                <option>Escuela</option>
                <option>Academia</option>
                <option>Organización no gubernamental</option>
                <option>Entidad pública</option>
                <option>Empresa</option>
              </select>
              <select
                value={actorAction}
                onChange={(e) => setActorAction(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
              >
                <option value="conservacion">Conservación</option>
                <option value="restauracion">Restauración</option>
                <option value="monitoreo">Monitoreo</option>
                <option value="investigacion">Investigación</option>
              </select>
              <select
                value={actorSector}
                onChange={(e) => setActorSector(Number(e.target.value))}
                className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
              >
                {CRA_SECTORS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={actorMuni}
                onChange={(e) => setActorMuni(e.target.value)}
                placeholder="Municipio / ubicación específica"
                className="min-h-[44px] w-full rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs"
              />
              <button
                type="submit"
                className="min-h-[46px] w-full rounded-full bg-[#005F96] text-xs font-black text-white"
              >
                Registrar actor (Ley 1581 de 2012)
              </button>
            </div>
          </form>

          <div className="bezel-outer lg:col-span-7">
            <div className="bezel-inner space-y-2.5 p-6">
              <h2 className="font-display text-xl font-bold text-[#08334C]">
                Directorio público de actores ({actors.length})
              </h2>
              {actors.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F7F3EA] p-3.5 text-xs"
                >
                  <div>
                    <p className="font-black text-[#08334C]">{a.nombre_entidad_o_persona}</p>
                    <p className="text-[#08334C]/75">
                      {a.tipo_actor} · {a.municipio_ubicacion}
                    </p>
                  </div>
                  <span className="rounded-full bg-[#005F96]/12 px-3 py-1 font-black uppercase text-[#005F96]">
                    {a.tipo_accion}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "seguimiento" && (
        <div className="bezel-outer">
          <div className="bezel-inner space-y-3 p-6">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#08334C]/10 bg-[#F7F3EA]/70 p-4 text-xs"
              >
                <div>
                  <p className="font-black text-[#08334C]">{p.titulo_proyecto}</p>
                  <p className="text-[#08334C]/75">
                    {p.proponente} · {p.tipo_accion} ({p.hectareas} ha) · Plan:{" "}
                    {p.accion_plan_heredada} ({p.prioridad_heredada})
                  </p>
                  <p className="mt-1 font-bold text-[#1F7A4C]">
                    Checklist cumplido: {(p.checklist_cumplimiento || []).filter(Boolean).length}/6
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 font-black text-[#005F96]">
                    {p.estado}
                  </span>
                  {p.estado !== "Cerrada" && (
                    <button
                      type="button"
                      onClick={() => advanceProposal(p)}
                      className="rounded-full bg-[#005F96] px-3 py-1.5 font-black text-white"
                    >
                      Avanzar estado →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "formulacion" && (
        <div className="bezel-outer">
          <div className="bezel-inner space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={activeProp?.id || ""}
                onChange={(e) => setSelectedPropId(e.target.value)}
                className="min-h-[44px] rounded-xl border border-[#08334C]/15 bg-[#F7F3EA] px-3 text-xs font-bold"
              >
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo_proyecto}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraftMode("mga")}
                  className={`rounded-full px-4 py-2 text-xs font-black ${
                    draftMode === "mga" ? "bg-[#005F96] text-white" : "bg-[#F7F3EA]"
                  }`}
                >
                  Metodología General Ajustada (DNP)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode("coop")}
                  className={`rounded-full px-4 py-2 text-xs font-black ${
                    draftMode === "coop" ? "bg-[#005F96] text-white" : "bg-[#F7F3EA]"
                  }`}
                >
                  Nota Conceptual Cooperación (CO₂e)
                </button>
              </div>
            </div>

            <pre className="whitespace-pre-wrap rounded-2xl bg-[#08334C] p-5 font-sans text-xs leading-relaxed text-[#F7F3EA]">
              {draftText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
