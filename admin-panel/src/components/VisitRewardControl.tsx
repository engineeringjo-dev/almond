import { useEffect, useState } from 'react';
import { Card, Field, TextInput, Toggle, Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { VisitRewardConfig, VisitRewardType } from '../types';

export function VisitRewardControl() {
  const [cfg, setCfg] = useState<VisitRewardConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getVisitRewardConfig().then(setCfg);
  }, []);

  if (!cfg) return <div style={{ color: colors.warmGray }}>جارٍ التحميل...</div>;

  const update = (patch: Partial<VisitRewardConfig>) => setCfg({ ...cfg, ...patch });

  const save = async () => {
    await adminApi.updateVisitRewardConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const TypeOption = ({ type, emoji, label }: { type: VisitRewardType; emoji: string; label: string }) => (
    <button
      onClick={() => update({ type })}
      style={{
        flex: 1,
        padding: 18,
        borderRadius: 12,
        border: `2px solid ${cfg.type === type ? colors.gold : colors.lightGold}`,
        background: cfg.type === type ? colors.lightGold : colors.white,
        fontWeight: 700,
        fontSize: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <span style={{ fontSize: 28 }}>{emoji}</span>
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 26 }}>🎁 مكافأة الزيارة</h1>
      <Card>
        <SectionTitle>نوع المكافأة عند الزيارة</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>تفعيل مكافأة الزيارة</span>
            <Toggle checked={cfg.enabled} onChange={(v) => update({ enabled: v })} />
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <TypeOption type="discount" emoji="🏷️" label="خصم مؤقت" />
            <TypeOption type="spin" emoji="🎡" label="دورة بعجلة الحظ" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label={cfg.type === 'discount' ? 'قيمة الخصم (%)' : 'عدد الدورات'}>
              <TextInput type="number" value={cfg.value} onChange={(v) => update({ value: Math.max(1, Number(v) || 1) })} />
            </Field>
            <Field label="نافذة الاستخدام (ساعات)">
              <TextInput type="number" value={cfg.windowHours} onChange={(v) => update({ windowHours: Math.max(1, Number(v) || 1) })} />
            </Field>
          </div>

          <div style={{ background: colors.cream, borderRadius: 10, padding: 12, fontSize: 13, color: colors.warmGray }}>
            {cfg.type === 'discount'
              ? `خصم ${cfg.value}% صالح خلال ${cfg.windowHours} ساعات مع عدّاد تنازلي في التطبيق.`
              : `دورة مجانية بعجلة الحظ تُستخدم خلال ${cfg.windowHours} ساعات.`}
            {' '}مكافأة نشطة واحدة لكل مستخدم في كل مرة.
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button onClick={save}>حفظ</Button>
            {saved ? <span style={{ color: colors.green, fontWeight: 700 }}>✓ تم الحفظ</span> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
