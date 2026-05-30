import { useEffect, useState } from 'react';
import { Card, Field, TextInput, Select, Button, SectionTitle } from './ui';
import { colors } from '../theme';
import { adminApi } from '../services/adminApi';
import type { PushCampaign, NotifAudience } from '../types';

const AUDIENCES = [
  { value: 'all', label: 'كل المستخدمين' },
  { value: 'tier', label: 'حسب الفئة' },
  { value: 'inactive', label: 'غير النشطين' },
];

const DEEP_LINKS = [
  { value: '/(tabs)/menu', label: 'القائمة' },
  { value: '/spin', label: 'عجلة الحظ' },
  { value: '/loyalty', label: 'المكافآت' },
];

// Mock audience-size estimate (section 14.5).
const AUDIENCE_SIZE: Record<NotifAudience, number> = { all: 12480, tier: 3200, inactive: 1750 };

const emptyDraft: Omit<PushCampaign, 'id' | 'sent'> = {
  titleAr: '', titleEn: '', bodyAr: '', bodyEn: '',
  deepLink: '/(tabs)/menu', audience: 'all', sendAt: '',
};

export function CampaignsControl() {
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [draft, setDraft] = useState(emptyDraft);

  useEffect(() => {
    adminApi.getPushCampaigns().then(setCampaigns);
  }, []);

  const valid = draft.titleAr.trim() && draft.bodyAr.trim();

  const create = async () => {
    if (!valid) return;
    const created = await adminApi.addPushCampaign(draft);
    setCampaigns([created, ...campaigns]);
    setDraft(emptyDraft);
  };

  const send = async (id: string) => {
    await adminApi.markPushSent(id);
    setCampaigns(campaigns.map((c) => (c.id === id ? { ...c, sent: true } : c)));
  };

  const remove = async (id: string) => {
    await adminApi.deletePushCampaign(id);
    setCampaigns(campaigns.filter((c) => c.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ fontSize: 26 }}>📣 الحملات الترويجية</h1>

      <Card>
        <SectionTitle>إنشاء حملة جديدة</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="العنوان (عربي)">
            <TextInput value={draft.titleAr} onChange={(v) => setDraft({ ...draft, titleAr: v })} />
          </Field>
          <Field label="العنوان (إنجليزي)">
            <TextInput value={draft.titleEn} onChange={(v) => setDraft({ ...draft, titleEn: v })} />
          </Field>
          <Field label="النص (عربي)">
            <TextInput value={draft.bodyAr} onChange={(v) => setDraft({ ...draft, bodyAr: v })} />
          </Field>
          <Field label="النص (إنجليزي)">
            <TextInput value={draft.bodyEn} onChange={(v) => setDraft({ ...draft, bodyEn: v })} />
          </Field>
          <Field label="الوجهة (رابط داخلي)">
            <Select value={draft.deepLink} onChange={(v) => setDraft({ ...draft, deepLink: v })} options={DEEP_LINKS} />
          </Field>
          <Field label="الجمهور" hint={`الحجم التقريبي: ${AUDIENCE_SIZE[draft.audience].toLocaleString('ar')}`}>
            <Select
              value={draft.audience}
              onChange={(v) => setDraft({ ...draft, audience: v as NotifAudience })}
              options={AUDIENCES}
            />
          </Field>
          <Field label="الجدولة (فارغ = الآن)">
            <TextInput type="datetime-local" value={draft.sendAt} onChange={(v) => setDraft({ ...draft, sendAt: v })} />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Button onClick={create} disabled={!valid}>
            {draft.sendAt ? '📅 جدولة الحملة' : '📤 إرسال الآن'}
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>الحملات</SectionTitle>
        {campaigns.length === 0 ? (
          <span style={{ color: colors.warmGray, fontSize: 13 }}>لا توجد حملات.</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {campaigns.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px solid ${colors.lightGold}`, borderRadius: 12, padding: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{c.titleAr}</div>
                  <div style={{ fontSize: 12, color: colors.warmGray }}>
                    {c.bodyAr} · {AUDIENCES.find((a) => a.value === c.audience)?.label}
                    {c.sendAt ? ` · ${c.sendAt.replace('T', ' ')}` : ''}
                  </div>
                </div>
                {c.sent ? (
                  <span style={{ color: colors.green, fontWeight: 700, fontSize: 13 }}>✓ أُرسلت</span>
                ) : (
                  <Button variant="outline" onClick={() => send(c.id)}>إرسال</Button>
                )}
                <Button variant="danger" onClick={() => remove(c.id)}>حذف</Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
