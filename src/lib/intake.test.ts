import { describe, it, expect } from 'vitest';
import { parseIntakeFields, collectIntake } from './intake';

describe('parseIntakeFields', () => {
  it('drops junk and defaults the type', () => {
    expect(
      parseIntakeFields([
        { label: 'Injuries?', type: 'textarea', required: true },
        { label: '  ' }, // blank label -> dropped
        { label: 'Level', type: 'weird' }, // bad type -> text
        'nope',
      ]),
    ).toEqual([
      { label: 'Injuries?', type: 'textarea', required: true },
      { label: 'Level', type: 'text', required: false },
    ]);
  });
  it('handles non-arrays', () => {
    expect(parseIntakeFields(null)).toEqual([]);
  });
});

describe('collectIntake', () => {
  const fields = parseIntakeFields([
    { label: 'Injuries?', type: 'text', required: true },
    { label: 'Waiver', type: 'checkbox', required: true },
    { label: 'Notes', type: 'textarea', required: false },
  ]);

  it('collects answers and skips blank optionals', () => {
    const f = new FormData();
    f.set('intake:Injuries?', 'none');
    f.set('intake:Waiver', 'on');
    const { answers, error } = collectIntake(fields, f);
    expect(error).toBe('');
    expect(answers).toEqual({ 'Injuries?': 'none', Waiver: true });
  });

  it('errors on a missing required text answer', () => {
    const f = new FormData();
    f.set('intake:Waiver', 'on');
    expect(collectIntake(fields, f).error).toMatch(/Injuries/);
  });

  it('errors on an unticked required checkbox', () => {
    const f = new FormData();
    f.set('intake:Injuries?', 'none');
    expect(collectIntake(fields, f).error).toMatch(/Waiver/);
  });
});
