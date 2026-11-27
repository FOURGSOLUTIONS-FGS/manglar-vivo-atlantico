"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  CheckSquare,
  Copy,
  Download,
  FileText,
  MapPin,
  PlusCircle,
  Users,
} from "lucide-react";
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
  const [tab, setTab] = useState<"proponer" | "actores" | "seguimiento" | "formulacion">(
    "proponer"
  );
  const [actors, setActors] = useState<ActorItem[]>([]);
  const [proposals, setProposals] = useState<ProposalItem[]>([]);

  const [actorName, setActorName] = useState("");
  const [actorType, setActorType] = useState("Comunidad u organización de base");
  const [actorAction, setActorAction] = useState("conservacion");
  const [actorSector, setActorSector] = useState(3);
  const [actorMuni, setActorMuni] = useState("Juan de Acosta");

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
  const [checklist, setChecklist] = useState<number[]>([1, 1, 0, 0, 1, 0]);

  const [selectedPropId, setSelectedPropId] = useState<string>("");
  const [draftMode, setDraftMode] = useState<"mga" | "coop">("mga");
  const [copiedDraft, setCopiedDraft] = useState(false);

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
        checklist_cumplimiento: checklist,
      }),
    });
    setPropTitle("");
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

  const downloadDraftTxt = () => {
    const blob = new Blob([draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draftMode}_manglar_atlantico.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const checklistPct = Math.round((checklist.filter(Boolean).length / 6) * 100);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#EDF2F6]">
      {/* Cabecera azul institucional CRA */}
      <div className="border-b border-white/15 bg-[#005F96] text-white">
        <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10">
          <h1 className="font-display text-3xl font-black text-white sm:text-4xl">
            Actores, Checklists Res. 1263/2018 y Formulación MGA
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-white/85">
            Plataforma funcional de participación territorial en Supabase PostGIS: hereda acción y prioridad del Plan de Manejo CRA directamente desde el mapa satelital y genera borradores MGA (DNP) y nota conceptual CO₂e.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { id: "proponer", label: "Proponer acción en mapa", icon: PlusCircle },
              { id: "actores", label: "Registro de actores", icon: Users },
              { id: "seguimiento", label: "Seguimiento (6 estados)", icon: CheckSquare },
              { id: "formulacion", label: "Borrador MGA / CO₂e", icon: FileText },
            ].map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-xs font-black transition ${
                    active
                      ? "bg-[#EDB512] text-[#041A29]"
                      : "border border-white/25 bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10">
        {tab === "proponer" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-[#041A29]">
                <MapPin className="h-4 w-4 text-[#005F96]" />
                Toca el mapa satelital para heredar Sector, Acción y Prioridad oficiales:
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
                heightClass="h-[500px]"
              />
            </div>

            <form
              onSubmit={handleCreateProposal}
              className="space-y-4 rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8 lg:col-span-6"
            >
              <div className="rounded-lg border border-[#005F96]/25 bg-[#EDF2F6] p-4 text-xs">
                <p className="font-bold text-[#005F96]">Herencia espacial en el punto marcado</p>
                <p className="mt-1 font-black text-[#041A29]">
                  {inherited.sectorNombre} · Plan: {inherited.accionPlan} · Prioridad:{" "}
                  {inherited.prioridad}
                </p>
              </div>

              <select
                value={propActorIdx}
                onChange={(e) => setPropActorIdx(Number(e.target.value))}
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs font-bold text-[#041A29]"
              >
                {actors.map((a, idx) => (
                  <option key={a.id} value={idx}>
                    {a.nombre_entidad_o_persona}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={propTipo}
                  onChange={(e) => setPropTipo(e.target.value as ProposalActionType)}
                  className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs font-bold text-[#041A29]"
                >
                  {(Object.keys(OFFICIAL_CHECKLISTS) as ProposalActionType[]).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={propHa}
                  onChange={(e) => setPropHa(Number(e.target.value))}
                  aria-label="Hectáreas propuestas"
                  className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 font-mono text-xs font-bold text-[#041A29]"
                />
              </div>

              <input
                type="text"
                required
                value={propTitle}
                onChange={(e) => setPropTitle(e.target.value)}
                placeholder="Título del proyecto (ej. Siembra comunitaria Juan de Acosta)"
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-sm text-[#041A29]"
              />

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold">
                  <span className="text-[#041A29]">Checklist oficial CRA (Res. 1263/2018)</span>
                  <span className="font-mono tabular-nums text-[#16794A]">{checklistPct}%</span>
                </div>
                <div className="mb-3 h-2 overflow-hidden rounded-[2px] bg-[#EDF2F6]">
                  <div
                    className="h-full bg-[#16794A] transition-all duration-300"
                    style={{ width: `${checklistPct}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {OFFICIAL_CHECKLISTS[propTipo].map((item, i) => (
                    <label
                      key={item}
                      className="flex cursor-pointer items-start gap-2.5 text-xs text-[#041A29]/85"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(checklist[i])}
                        onChange={(e) =>
                          setChecklist((prev) =>
                            prev.map((v, idx) => (idx === i ? (e.target.checked ? 1 : 0) : v))
                          )
                        }
                        className="mt-0.5 h-4 w-4 accent-[#005F96]"
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[50px] w-full rounded-lg bg-[#005F96] text-sm font-black text-white transition hover:bg-[#041A29]"
              >
                Registrar propuesta en la CRA
              </button>
            </form>
          </div>
        )}

        {tab === "actores" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <form
              onSubmit={handleCreateActor}
              className="space-y-3.5 rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8 lg:col-span-5"
            >
              <h2 className="font-display text-xl font-black text-[#041A29]">
                Registro obligatorio de actores
              </h2>
              <input
                type="text"
                required
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                placeholder="Nombre de entidad, escuela, ONG o líder"
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-sm font-bold text-[#041A29]"
              />
              <select
                value={actorType}
                onChange={(e) => setActorType(e.target.value)}
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs font-bold text-[#041A29]"
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
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs font-bold text-[#041A29]"
              >
                <option value="conservacion">Conservación</option>
                <option value="restauracion">Restauración</option>
                <option value="monitoreo">Monitoreo</option>
                <option value="investigacion">Investigación</option>
              </select>
              <select
                value={actorSector}
                onChange={(e) => setActorSector(Number(e.target.value))}
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs font-bold text-[#041A29]"
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
                className="min-h-[46px] w-full rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/50 px-3 text-xs text-[#041A29]"
              />
              <button
                type="submit"
                className="min-h-[48px] w-full rounded-lg bg-[#005F96] text-xs font-black text-white transition hover:bg-[#041A29]"
              >
                Registrar actor (Ley 1581 de 2012)
              </button>
            </form>

            <div className="rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8 lg:col-span-7">
              <h2 className="font-display text-xl font-black text-[#041A29]">
                Directorio público de actores ({actors.length})
              </h2>
              <div className="mt-4 divide-y divide-[#041A29]/10 border-y border-[#041A29]/10">
                {actors.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3.5 text-xs"
                  >
                    <div>
                      <p className="font-black text-[#041A29]">{a.nombre_entidad_o_persona}</p>
                      <p className="text-[#041A29]/70">
                        {a.tipo_actor} · {a.municipio_ubicacion}
                      </p>
                    </div>
                    <span className="rounded bg-[#005F96]/12 px-2.5 py-1 font-bold uppercase text-[#005F96]">
                      {a.tipo_accion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "seguimiento" && (
          <div className="rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8">
            <h2 className="font-display text-xl font-black text-[#041A29]">
              Seguimiento de iniciativas territoriales (6 estados CRA)
            </h2>
            <div className="mt-4 divide-y divide-[#041A29]/10 border-y border-[#041A29]/10">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-4 py-4 text-xs"
                >
                  <div>
                    <p className="text-sm font-black text-[#041A29]">{p.titulo_proyecto}</p>
                    <p className="mt-0.5 text-[#041A29]/75">
                      {p.proponente} · {p.tipo_accion} ({p.hectareas} ha) · Plan:{" "}
                      {p.accion_plan_heredada} ({p.prioridad_heredada})
                    </p>
                    <p className="mt-1 font-mono font-bold text-[#16794A]">
                      Checklist Res. 1263/2018:{" "}
                      {(p.checklist_cumplimiento || []).filter(Boolean).length}/6
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-[#EDF2F6] px-3 py-1.5 font-bold text-[#005F96]">
                      {p.estado}
                    </span>
                    {p.estado !== "Cerrada" && (
                      <button
                        type="button"
                        onClick={() => advanceProposal(p)}
                        className="min-h-[38px] rounded-lg bg-[#041A29] px-3.5 font-black text-white transition hover:bg-[#005F96]"
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
          <div className="space-y-5 rounded-xl border border-[#041A29]/12 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={activeProp?.id || ""}
                onChange={(e) => setSelectedPropId(e.target.value)}
                className="min-h-[46px] rounded-lg border border-[#041A29]/20 bg-[#EDF2F6]/60 px-3.5 text-xs font-bold text-[#041A29]"
              >
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo_proyecto}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDraftMode("mga")}
                  className={`min-h-[42px] rounded-lg px-4 text-xs font-black transition ${
                    draftMode === "mga"
                      ? "bg-[#005F96] text-white"
                      : "border border-[#041A29]/15 bg-white text-[#041A29]"
                  }`}
                >
                  Metodología General Ajustada (DNP)
                </button>
                <button
                  type="button"
                  onClick={() => setDraftMode("coop")}
                  className={`min-h-[42px] rounded-lg px-4 text-xs font-black transition ${
                    draftMode === "coop"
                      ? "bg-[#005F96] text-white"
                      : "border border-[#041A29]/15 bg-white text-[#041A29]"
                  }`}
                >
                  Nota Conceptual (CO₂e)
                </button>
              </div>
            </div>

            <pre className="whitespace-pre-wrap rounded-xl bg-[#041A29] p-6 font-sans text-xs leading-relaxed text-white/90">
              {draftText}
            </pre>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(draftText);
                  setCopiedDraft(true);
                  setTimeout(() => setCopiedDraft(false), 1800);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#041A29]/20 bg-white px-4 text-xs font-black text-[#041A29] transition hover:border-[#005F96]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copiedDraft ? "Texto copiado" : "Copiar borrador"}
              </button>
              <button
                type="button"
                onClick={downloadDraftTxt}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[#005F96] px-4 text-xs font-black text-white transition hover:bg-[#041A29]"
              >
                <Download className="h-3.5 w-3.5 text-[#F8D86F]" />
                Descargar .txt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
