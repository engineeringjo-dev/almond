import { useState } from 'react';
import { Card, Field, TextInput, Toggle, Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { SpinEligibilityConfig } from '../types';

const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function EligibilityForm({
  value,
  onChange,
}: {
  value: SpinEligibilityConfig;
  onChange: (e: SpinEligibilityConfig) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<SpinEligibilityConfig>) => onChange({ ...value, ...patch });

  const toggleDay = (day: number) => {
    const has = value.freeSpinDays.includes(day);
    update({
      freeSpinDays: has
        ? value.freeSpinDays.filter((d) => d !== day)
        : [...value.freeSpinDays, day],
    });
  };

  const save = async () => {
    setSaving(true);
    await adminApi.updateEligibility(value);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Card>
      <SectionTitle>شروط الأهلية</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>تفعيل عجلة الحظ (المفتاح الرئيسي)</span>
          <Toggle checked={value.enabled} onChange={(v) => update({ enabled: v })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="عدد الزيارات لكل دورة">
            <TextInput
              type="number"
              value={value.visitsPerSpin}
              onChange={(v) => update({ visitsPerSpin: Math.max(1, Number(v) || 1) })}
            />
          </Field>
          <Field label="مبلغ شحن البطاقة للدورة (د.أ)">
            <TextInput
              type="number"
              value={value.topupAmount}
              onChange={(v) => update({ topupAmount: Math.max(0, Number(v) || 0) })}
            />
          </Field>
        </div>

        <Field label="أيام الدورة المجانية">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WEEKDAYS.map((label, day) => {
              const active = value.freeSpinDays.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `1.5px solid ${active ? colors.gold : colors.lightGold}`,
                    background: active ? colors.lightGold : 'transparent',
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button onClick={save} disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ الأهلية'}
          </Button>
          {saved ? <span style={{ color: colors.green, fontWeight: 700 }}>✓ تم الحفظ</span> : null}
        </div>
      </div>
    </Card>
  );
}
