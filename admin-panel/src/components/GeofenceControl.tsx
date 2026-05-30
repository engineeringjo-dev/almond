import { useEffect, useState } from 'react';
import { Card, Field, TextInput, Toggle, Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { GeofenceConfig } from '../types';

export function GeofenceControl() {
  const [cfg, setCfg] = useState<GeofenceConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.getGeofenceConfig().then(setCfg);
  }, []);

  if (!cfg) return <div style={{ color: colors.warmGray }}>جارٍ التحميل...</div>;

  const update = (patch: Partial<GeofenceConfig>) => setCfg({ ...cfg, ...patch });

  const save = async () => {
    await adminApi.updateGeofenceConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 26 }}>📍 الإشعارات حسب الموقع</h1>
      <Card>
        <SectionTitle>إعدادات السياج الجغرافي</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>تفعيل إشعارات الموقع</span>
            <Toggle checked={cfg.enabled} onChange={(v) => update({ enabled: v })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field label="نطاق التنبيه (متر)" hint="الافتراضي 1000 متر">
              <TextInput type="number" value={cfg.radiusMeters} onChange={(v) => update({ radiusMeters: Math.max(50, Number(v) || 0) })} />
            </Field>
            <Field label="الحد الأقصى يوميًا لكل مستخدم" hint="الافتراضي 1">
              <TextInput type="number" value={cfg.dailyCap} onChange={(v) => update({ dailyCap: Math.max(1, Number(v) || 1) })} />
            </Field>
            <Field label="بداية الساعات الهادئة">
              <TextInput type="time" value={cfg.quietStart} onChange={(v) => update({ quietStart: v })} />
            </Field>
            <Field label="نهاية الساعات الهادئة">
              <TextInput type="time" value={cfg.quietEnd} onChange={(v) => update({ quietEnd: v })} />
            </Field>
          </div>

          <div style={{ background: colors.cream, borderRadius: 10, padding: 12, fontSize: 13, color: colors.warmGray }}>
            عند اقتراب المستخدم من أي فرع ضمن النطاق، يُرسل النظام إشعارًا برصيد نقاطه — مرة واحدة يوميًا كحد أقصى، مع احترام الساعات الهادئة.
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button onClick={save}>حفظ الإعدادات</Button>
            {saved ? <span style={{ color: colors.green, fontWeight: 700 }}>✓ تم الحفظ</span> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
