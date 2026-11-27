import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";
import { computeReliabilityScore } from "@/lib/reliability";
import type { AttentionStatus, ValidationStatus } from "@/lib/cra-domain";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      reportId,
      validatorRole,
      validatorName,
      decision,
      technicalLabel,
      notes,
      attentionStatus,
    } = body as {
      reportId: string;
      validatorRole: "mentor_comunitario" | "mentor_academico" | "cra_oficial";
      validatorName: string;
      decision: "aprobado" | "observado" | "descartado" | "alerta_oficial" | "seguimiento_operativo";
      technicalLabel?: string;
      notes?: string;
      attentionStatus?: AttentionStatus;
    };

    if (!reportId || !validatorRole || !decision) {
      return NextResponse.json({ error: "Faltan campos requeridos." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: report, error: fetchErr } = await supabase
      .from("citizen_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Reporte no encontrado." }, { status: 404 });
    }

    const { error: valErr } = await supabase.from("report_validations").insert({
      report_id: reportId,
      validator_role: validatorRole,
      validator_name: validatorName || validatorRole,
      decision,
      technical_label: technicalLabel || null,
      notes: notes || null,
    });

    if (valErr) {
      return NextResponse.json({ error: valErr.message }, { status: 500 });
    }

    let nextValidationState: ValidationStatus = report.estado_validacion as ValidationStatus;
    let nextAttentionState: AttentionStatus =
      attentionStatus || (report.attention_status as AttentionStatus);

    if (decision === "descartado") {
      nextValidationState = "descartado";
      nextAttentionState = "atendido";
    } else if (decision === "alerta_oficial") {
      nextValidationState = "alerta_oficial_cra";
      nextAttentionState = attentionStatus || "operativo_en_curso";
    } else if (decision === "aprobado") {
      if (validatorRole === "mentor_comunitario" && nextValidationState === "nuevo") {
        nextValidationState = "validado_comunitario";
      } else if (validatorRole === "mentor_academico") {
        nextValidationState = "validado_academico";
      } else if (validatorRole === "cra_oficial") {
        nextValidationState = "alerta_oficial_cra";
      }
    }

    const gt = report.ground_truth_match as { dist_m?: number } | null;
    const rel = computeReliabilityScore({
      hasPhoto: Boolean(report.evidencia_foto_url),
      precisionGpsM: report.precision_gps_m,
      inCoastalZone: true,
      isSimulatedGps: report.is_simulated_gps,
      timestampCaptura: report.timestamp_captura,
      nearGroundTruthM: gt?.dist_m ?? null,
      estadoValidacion: nextValidationState,
    });

    const { data: updated, error: upErr } = await supabase
      .from("citizen_reports")
      .update({
        estado_validacion: nextValidationState,
        attention_status: nextAttentionState,
        clasificacion_tecnica: technicalLabel || report.clasificacion_tecnica,
        puntaje_confiabilidad: rel.score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ report: updated, reliability: rel });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error registrando validación" },
      { status: 500 }
    );
  }
}
