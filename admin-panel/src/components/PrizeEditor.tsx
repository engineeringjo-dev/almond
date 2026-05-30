import { Card, Field, TextInput, Select, Toggle, Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { SpinPrize, SpinPrizeType } from '../types';

const TYPE_OPTIONS = [
  { value: 'credit', label: 'رصيد نقدي' },
  { value: 'free-item', label: 'صنف مجاني' },
  { value: 'voucher', label: 'قسيمة' },
];

interface Props {
  prizes: SpinPrize[];
  setPrizes: (p: SpinPrize[]) => void;
}

export function PrizeEditor({ prizes, setPrizes }: Props) {
  const patch = (id: string, p: Partial<SpinPrize>) => {
    setPrizes(prizes.map((x) => (x.id === id ? { ...x, ...p } : x)));
    adminApi.updatePrize(id, p);
  };

  const remove = (id: string) => {
    setPrizes(prizes.filter((x) => x.id !== id));
    adminApi.deletePrize(id);
  };

  const add = async () => {
    const created = await adminApi.addPrize({
      nameAr: 'جائزة جديدة',
      nameEn: 'New prize',
      type: 'free-item',
      weight: 1,
      enabled: true,
      expiryDays: 7,
    });
    setPrizes([...prizes, created]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...prizes];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPrizes(next);
    adminApi.reorderPrizes(next.map((p) => p.id));
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>الجوائز</SectionTitle>
        <Button variant="outline" onClick={add}>
          ＋ إضافة جائزة
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {prizes.map((prize, i) => {
          const invalidName = !prize.nameAr.trim() || !prize.nameEn.trim();
          const invalidWeight = prize.weight < 0;
          return (
            <div
              key={prize.id}
              style={{
                border: `1px solid ${colors.lightGold}`,
                borderRadius: 12,
                padding: 14,
                background: prize.enabled ? colors.white : colors.cream,
                opacity: prize.enabled ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => move(i, -1)} style={arrowStyle} disabled={i === 0}>▲</button>
                  <button onClick={() => move(i, 1)} style={arrowStyle} disabled={i === prizes.length - 1}>▼</button>
                </div>
                <span style={{ flex: 1, fontWeight: 700 }}>#{i + 1} — {prize.nameAr}</span>
                <Toggle checked={prize.enabled} onChange={(v) => patch(prize.id, { enabled: v })} />
                <Button variant="danger" onClick={() => remove(prize.id)}>حذف</Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Field label="الاسم (عربي)">
                  <TextInput value={prize.nameAr} onChange={(v) => patch(prize.id, { nameAr: v })} />
                </Field>
                <Field label="الاسم (إنجليزي)">
                  <TextInput value={prize.nameEn} onChange={(v) => patch(prize.id, { nameEn: v })} />
                </Field>
                <Field label="النوع">
                  <Select
                    value={prize.type}
                    onChange={(v) => patch(prize.id, { type: v as SpinPrizeType })}
                    options={TYPE_OPTIONS}
                  />
                </Field>
                {prize.type === 'credit' ? (
                  <Field label="قيمة الرصيد (د.أ)">
                    <TextInput
                      type="number"
                      value={prize.creditValue ?? 0}
                      onChange={(v) => patch(prize.id, { creditValue: Number(v) || 0 })}
                    />
                  </Field>
                ) : null}
                <Field label="الوزن (الاحتمالية)">
                  <TextInput
                    type="number"
                    value={prize.weight}
                    onChange={(v) => patch(prize.id, { weight: Math.max(0, Number(v) || 0) })}
                  />
                </Field>
                <Field label="انتهاء الصلاحية (أيام)">
                  <TextInput
                    type="number"
                    value={prize.expiryDays}
                    onChange={(v) => patch(prize.id, { expiryDays: Math.max(1, Number(v) || 1) })}
                  />
                </Field>
              </div>

              {(invalidName || invalidWeight) && (
                <div style={{ color: colors.red, fontSize: 12, marginTop: 8 }}>
                  {invalidName ? 'الاسم مطلوب بالعربية والإنجليزية. ' : ''}
                  {invalidWeight ? 'الوزن يجب أن يكون رقمًا موجبًا.' : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const arrowStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: colors.warmGray,
  fontSize: 10,
  padding: 2,
};
