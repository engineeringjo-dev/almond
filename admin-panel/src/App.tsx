import { useState } from 'react';
import { colors } from './theme';
import { isAuthed, login, logout } from './auth';
import { Button, Card, Field, TextInput } from './components/ui';
import { SpinControl } from './components/SpinControl';
import { CampaignsControl } from './components/CampaignsControl';
import { GeofenceControl } from './components/GeofenceControl';
import { VisitRewardControl } from './components/VisitRewardControl';

type Tab = 'spin' | 'campaigns' | 'geofence' | 'visit';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'spin', label: 'عجلة الحظ', emoji: '🎡' },
  { id: 'campaigns', label: 'الحملات الترويجية', emoji: '📣' },
  { id: 'geofence', label: 'إشعارات الموقع', emoji: '📍' },
  { id: 'visit', label: 'مكافأة الزيارة', emoji: '🎁' },
];

export default function App() {
  const [authed, setAuthed] = useState(isAuthed());
  const [tab, setTab] = useState<Tab>('spin');

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 240,
          background: colors.dark,
          color: colors.cream,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>☕ ألموند</div>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              textAlign: 'start',
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              background: tab === t.id ? colors.gold : 'transparent',
              color: tab === t.id ? colors.dark : colors.cream,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <Button variant="ghost" onClick={() => { logout(); setAuthed(false); }} style={{ color: colors.lightGold }}>
          تسجيل الخروج
        </Button>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, padding: 28, maxWidth: 1100 }}>
        {tab === 'spin' ? <SpinControl /> : null}
        {tab === 'campaigns' ? <CampaignsControl /> : null}
        {tab === 'geofence' ? <GeofenceControl /> : null}
        {tab === 'visit' ? <VisitRewardControl /> : null}
      </main>
    </div>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const ok = await login(username, password);
    setLoading(false);
    if (ok) onSuccess();
    else setError(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: colors.dark }}>
      <Card style={{ width: 360 }}>
        <div style={{ textAlign: 'center', fontSize: 44, marginBottom: 8 }}>☕</div>
        <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 4 }}>لوحة تحكم ألموند</h1>
        <p style={{ textAlign: 'center', color: colors.warmGray, fontSize: 13, marginTop: 0 }}>
          تسجيل دخول المسؤول
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
          <Field label="اسم المستخدم">
            <TextInput value={username} onChange={(v) => { setUsername(v); setError(false); }} placeholder="admin" />
          </Field>
          <Field label="كلمة المرور">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${colors.lightGold}`, fontSize: 14 }}
            />
          </Field>
          {error ? <span style={{ color: colors.red, fontSize: 13 }}>بيانات الدخول غير صحيحة</span> : null}
          <Button type="submit" onClick={submit} disabled={loading}>
            {loading ? 'جارٍ الدخول...' : 'دخول'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
