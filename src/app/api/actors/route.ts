import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("public_actors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ actors: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("registered_actors")
      .insert({
        nombre_entidad_o_persona: String(body.nombre_entidad_o_persona || "").trim(),
        tipo_actor: String(body.tipo_actor || "Comunidad u organización de base"),
        tipo_accion: String(body.tipo_accion || "monitoreo"),
        sector_id: body.sector_id ? Number(body.sector_id) : 1,
        municipio_ubicacion: String(body.municipio_ubicacion || "Atlántico"),
        papel: Array.isArray(body.papel) && body.papel.length ? body.papel : ["Monitorear y reportar"],
        periodo_inicio: body.periodo_inicio || null,
        periodo_fin: body.periodo_fin || null,
        contacto_privado: body.contacto_privado ? String(body.contacto_privado) : null,
        acepta_ley_1581: Boolean(body.acepta_ley_1581 ?? true),
      })
      .select("id, nombre_entidad_o_persona, tipo_actor, tipo_accion, sector_id, municipio_ubicacion, papel, periodo_inicio, periodo_fin, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ actor: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error registrando actor" },
      { status: 500 }
    );
  }
}
