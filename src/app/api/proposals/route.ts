import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("citizen_proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ proposals: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("citizen_proposals")
      .insert({
        actor_id: body.actor_id || null,
        proponente: String(body.proponente || "Comunidad"),
        titulo_proyecto: String(body.titulo_proyecto || "").trim(),
        tipo_accion: String(body.tipo_accion || "Siembra"),
        hectareas: Number(body.hectareas || 1),
        sector_id: Number(body.sector_id || 1),
        ubicacion_objetivo: String(body.ubicacion_objetivo || "Atlántico"),
        latitud: body.latitud != null ? Number(body.latitud) : null,
        longitud: body.longitud != null ? Number(body.longitud) : null,
        accion_plan_heredada: String(body.accion_plan_heredada || "Restauración"),
        prioridad_heredada: String(body.prioridad_heredada || "Alta"),
        resumen_objetivo: String(body.resumen_objetivo || ""),
        checklist_cumplimiento: Array.isArray(body.checklist_cumplimiento)
          ? body.checklist_cumplimiento
          : [0, 0, 0, 0, 0, 0],
        estado: "Propuesta",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ proposal: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error creando propuesta" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, estado, checklist_cumplimiento, monitoreo } = body as {
      id: string;
      estado?: string;
      checklist_cumplimiento?: number[];
      monitoreo?: { fecha: string; sup: number; alt: number; fotos: number };
    };
    if (!id) {
      return NextResponse.json({ error: "Falta id de propuesta." }, { status: 400 });
    }
    const supabase = createServerSupabase();
    const { data: current, error: fErr } = await supabase
      .from("citizen_proposals")
      .select("*")
      .eq("id", id)
      .single();
    if (fErr || !current) {
      return NextResponse.json({ error: "Propuesta no encontrada." }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (estado) updates.estado = estado;
    if (checklist_cumplimiento) updates.checklist_cumplimiento = checklist_cumplimiento;
    if (monitoreo) {
      const existing = Array.isArray(current.monitoreos) ? current.monitoreos : [];
      updates.monitoreos = [...existing, monitoreo];
    }

    const { data, error } = await supabase
      .from("citizen_proposals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ proposal: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error actualizando propuesta" },
      { status: 500 }
    );
  }
}
