// Per-service intake questions. Stored on session_types.intake_fields (jsonb
// array); answers land on bookings.intake (jsonb object keyed by label).

export interface IntakeField {
  label: string;
  type: 'text' | 'textarea' | 'checkbox';
  required: boolean;
}

const TYPES = ['text', 'textarea', 'checkbox'] as const;

export function parseIntakeFields(raw: unknown): IntakeField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f: any) => f && typeof f.label === 'string' && f.label.trim())
    .map((f: any) => ({
      label: String(f.label).trim().slice(0, 120),
      type: (TYPES as readonly string[]).includes(f.type) ? f.type : 'text',
      required: !!f.required,
    }));
}

/** Pull answers for `fields` out of a submitted form. Inputs are named `intake:<label>`. */
export function collectIntake(
  fields: IntakeField[],
  form: FormData,
): { answers: Record<string, string | boolean>; error: string } {
  const answers: Record<string, string | boolean> = {};
  for (const f of fields) {
    const raw = form.get(`intake:${f.label}`);
    if (f.type === 'checkbox') {
      const checked = raw === 'on' || raw === 'true';
      if (f.required && !checked) return { answers, error: `Please tick "${f.label}".` };
      if (checked) answers[f.label] = true;
    } else {
      const v = String(raw ?? '').trim().slice(0, 1000);
      if (f.required && !v) return { answers, error: `Please answer "${f.label}".` };
      if (v) answers[f.label] = v;
    }
  }
  return { answers, error: '' };
}
