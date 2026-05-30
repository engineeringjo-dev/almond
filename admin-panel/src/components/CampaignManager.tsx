import { useState } from 'react';
import { Card, Field, TextInput, Select, Toggle, Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { SpinCampaign, SpinCondition } from '../types';

const CONDITIONS = [
  { value: 'per-order-min', label: 'لكل طلب يتجاوز قيمة' },
  { value: 'per-visit', label: 'لكل زيارة' },
  { value: 'per-topup', label: 'لكل شحن رصيد' },
];

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  campaigns: SpinCampaign[];
  setCampaigns: (c: SpinCampaign[]) => void;
}

export function CampaignManager({ campaigns, setCampaigns }: Props) {
  const [draft, setDraft] = useState<Omit<SpinCampaign, 'id'>>({
    name: '',
    condition: 'per-order-min',
    value: 10,
    startDate: today(),
    endDate: today(),
    active: true,
  });

  const isActiveNow = (c: SpinCampaign) => {
    const t = today();
    return c.active && c.startDate <= t && c.endDate >= t;
  };

  const add = async () => {
    if (!draft.name.trim() || draft.endDate < draft.startDate) return;
    const created = await adminApi.addCampaign(draft);
    setCampaigns([...campaigns, created]);
    setDraft({ ...draft, name: '' });
  };

  const toggle = (c: SpinCampaign) => {
    setCampaigns(campaigns.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
    adminApi.updateCampaign(c.id, { active: !c.active });
  };

  const remove = (id: string) => {
    setCampaigns(campaigns.filter((x) => x.id !== id));
    adminApi.deleteCampaign(id);
  };

  return (
    <Card>
      <SectionTitle>الحملات المجدولة</SectionTitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {campaigns.length === 0 ? (
          <span style={{ color: colors.warmGray, fontSize: 13 }}>لا توجد حملات بعد.</span>
        ) : (
          campaigns.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: `1px solid ${colors.lightGold}`,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {c.name}{' '}
                  {isActiveNow(c) ? (
                    <span style={{ color: colors.green, fontSize: 12 }}>● نشطة الآن</span>
                  ) : (
                    <span style={{ color: colors.warmGray, fontSize: 12 }}>○ غير نشطة</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: colors.warmGray }}>
                  {CONDITIONS.find((x) => x.value === c.condition)?.label} ({c.value}) ·{' '}
                  {c.startDate} ← {c.endDate}
                </div>
              </div>
              <Toggle checked={c.active} onChange={() => toggle(c)} />
              <Button variant="danger" onClick={() => remove(c.id)}>حذف</Button>
            </div>
          ))
        )}
      </div>

      <div style={{ borderTop: `1px solid ${colors.cream}`, paddingTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <Field label="اسم الحملة">
            <TextInput value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="مثال: رمضان" />
          </Field>
          <Field label="الشرط">
            <Select
              value={draft.condition}
              onChange={(v) => setDraft({ ...draft, condition: v as SpinCondition })}
              options={CONDITIONS}
            />
          </Field>
          <Field label="القيمة">
            <TextInput type="number" value={draft.value} onChange={(v) => setDraft({ ...draft, value: Number(v) || 0 })} />
          </Field>
          <Field label="تاريخ البدء">
            <TextInput type="date" value={draft.startDate} onChange={(v) => setDraft({ ...draft, startDate: v })} />
          </Field>
          <Field label="تاريخ الانتهاء">
            <TextInput type="date" value={draft.endDate} onChange={(v) => setDraft({ ...draft, endDate: v })} />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Button onClick={add} disabled={!draft.name.trim() || draft.endDate < draft.startDate}>
            ＋ إضافة حملة
          </Button>
          {draft.endDate < draft.startDate ? (
            <span style={{ color: colors.red, fontSize: 12, marginInlineStart: 12 }}>
              تاريخ الانتهاء قبل البدء
            </span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
