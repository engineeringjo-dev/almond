'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { fieldClass, labelClass } from '@/components/forms/styles';
import { MenuEditor, type AdminItem } from '@/components/admin/MenuEditor';

/**
 * The back office. Three things nothing else can do, and a short overview.
 *
 * 🔴 WHAT IS DELIBERATELY ABSENT. No sales report, no margin, no discount-by-
 * branch, no staff-consumption log. All four already exist in Odoo —
 * `almond.sales.report` carries branch, product, `total_discount` and `margin`;
 * `pos_consumption` has recorded 363 employee consumptions in the last 90 days
 * with the employee named on each. Rebuilding them here would be a second
 * source of truth for numbers the finance system already owns.
 *
 * What is here is what Odoo has no concept of: which companies hold a standing
 * discount, who is on their rosters, and who actually used one.
 *
 * Every call goes to /api/admin/* on our OWN server, which holds the BFF's
 * admin key. The browser never sees it.
 */

type Company = {
  id: string; nameAr: string; nameEn: string;
  percentOff: number; active: boolean; memberCount: number;
};
type Use = {
  memberId: string; phone: string; companyId: string; name?: string;
  times: number; discountJod: number; items: Record<string, number>;
};

const jod = (n: number) => n.toFixed(3);

export function BackOffice({ menuItemCount, itemsWithoutPhoto, menuItems }: {
  menuItemCount: number;
  itemsWithoutPhoto: number;
  menuItems: AdminItem[];
}) {
  const t = useTranslations('Admin');
  const [tab, setTab] = useState<'overview' | 'companies' | 'usage' | 'menu'>('overview');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [uses, setUses] = useState<Use[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, u] = await Promise.all([
        fetch('/api/admin/companies').then((r) => r.json()),
        fetch('/api/admin/corporate/uses').then((r) => r.json()),
      ]);
      if (c.error) throw new Error(c.error);
      setCompanies(c.companies ?? []);
      setUses(u.byMember ?? []);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const people = companies.reduce((s, c) => s + c.memberCount, 0);
  const usesTotal = uses.reduce((s, u) => s + u.times, 0);
  const given = uses.reduce((s, u) => s + u.discountJod, 0);

  const tabs = [
    ['overview', t('tabOverview')],
    ['companies', t('tabCompanies')],
    ['usage', t('tabUsage')],
    ['menu', t('tabMenu')],
  ] as const;

  return (
    <div className="container-content py-xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <form action="/api/admin/session" method="post" onSubmit={async (e) => {
          e.preventDefault();
          await fetch('/api/admin/session', { method: 'DELETE' });
          window.location.reload();
        }}>
          <Button type="submit" variant="outline">{t('logout')}</Button>
        </form>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-neutral-warm" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === id
                ? 'border-primary font-bold text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="mb-6 rounded-md border border-error bg-error/10 p-4 text-sm">
          {t('loadError', { msg: error })}
        </p>
      ) : null}

      {tab === 'overview' && (
        <section className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tile k={t('companies')} v={String(companies.filter((c) => c.active).length)} />
            <Tile k={t('people')} v={String(people)} />
            <Tile k={t('usesThisMonth')} v={String(usesTotal)} />
            <Tile k={t('discountGiven')} v={jod(given)} unit="د.أ" />
            <Tile k={t('menuItems')} v={String(menuItemCount)} />
            <Tile k={t('itemsNoPhoto')} v={String(itemsWithoutPhoto)} />
          </div>
          <Note>{t('noPointsNote')}</Note>
          <Note>{t('odooNote')}</Note>
        </section>
      )}

      {tab === 'companies' && (
        <CompaniesTab companies={companies} loaded={loaded} onChanged={load} />
      )}

      {tab === 'usage' && <UsageTab uses={uses} companies={companies} />}

      {tab === 'menu' && (
        <section className="flex flex-col gap-4">
          <Note>{t('menuNote')}</Note>
          <div className="grid gap-3 sm:grid-cols-2">
            <Tile k={t('menuItems')} v={String(menuItemCount)} />
            <Tile k={t('itemsNoPhoto')} v={String(itemsWithoutPhoto)} />
          </div>
          {/* Kept, but no longer pretending: its edits live in this browser
              alone (see Admin.syncNote). Uploading a photo that everyone sees
              needs durable storage, which is the open decision. */}
          <MenuEditor items={menuItems} />
        </section>
      )}
    </div>
  );
}

function Tile({ k, v, unit }: { k: string; v: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-neutral-warm bg-card p-4">
      <div className="text-sm text-text-secondary">{k}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {v}{unit ? <span className="ms-1 text-base font-normal text-text-secondary">{unit}</span> : null}
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-neutral-warm/40 p-4 text-sm leading-relaxed text-text-secondary">
      {children}
    </p>
  );
}

function CompaniesTab({ companies, loaded, onChanged }: {
  companies: Company[]; loaded: boolean; onChanged: () => void;
}) {
  const t = useTranslations('Admin');
  const [draft, setDraft] = useState({ id: '', nameAr: '', nameEn: '', percentOff: 20, active: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async (body: typeof draft) => {
    setBusy(true); setErr('');
    const r = await fetch('/api/admin/companies', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? 'error'); return false; }
    onChanged();
    return true;
  };

  return (
    <section className="flex flex-col gap-8">
      <form
        className="flex flex-col gap-4 rounded-lg border border-neutral-warm bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save(draft)) setDraft({ id: '', nameAr: '', nameEn: '', percentOff: 20, active: true });
        }}
      >
        <h2 className="font-bold">{t('newCompany')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t('companyId')}</span>
            <input className={fieldClass} required pattern="[a-z0-9-]+" dir="ltr"
              value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('percentOff')}</span>
            <input className={fieldClass} type="number" min={1} max={100} required
              value={draft.percentOff}
              onChange={(e) => setDraft({ ...draft, percentOff: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('nameAr')}</span>
            <input className={fieldClass} value={draft.nameAr}
              onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} />
          </label>
          <label className="block">
            <span className={labelClass}>{t('nameEn')}</span>
            <input className={fieldClass} dir="ltr" value={draft.nameEn}
              onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
          </label>
        </div>
        {err ? <p className="text-sm text-error">{err}</p> : null}
        <div><Button type="submit" disabled={busy}>{busy ? t('saving') : t('save')}</Button></div>
      </form>

      {loaded && companies.length === 0 ? (
        <p className="text-text-secondary">{t('noCompanies')}</p>
      ) : null}

      <div className="flex flex-col gap-4">
        {companies.map((c) => (
          <CompanyCard key={c.id} company={c} onChanged={onChanged} onToggle={save} />
        ))}
      </div>
    </section>
  );
}

function CompanyCard({ company, onChanged, onToggle }: {
  company: Company;
  onChanged: () => void;
  onToggle: (c: { id: string; nameAr: string; nameEn: string; percentOff: number; active: boolean }) => Promise<boolean>;
}) {
  const t = useTranslations('Admin');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ before: number; after: number; rejected: { line: number; value: string; reason: string }[] } | null>(null);

  return (
    <div className="rounded-lg border border-neutral-warm bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold">
            {company.nameAr || company.nameEn}{' '}
            <span className="text-primary tabular-nums">{company.percentOff}%</span>
          </div>
          <div className="text-sm text-text-secondary">
            {t('memberCount', { n: company.memberCount })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={company.active}
            onChange={async (e) => { await onToggle({ ...company, active: e.target.checked }); }}
          />
          {t('active')}
        </label>
      </div>

      <div className="mt-4">
        <span className={labelClass}>{t('roster')}</span>
        <p className="mb-2 text-xs leading-relaxed text-text-secondary">{t('rosterHint')}</p>
        <textarea
          className="min-h-28 w-full rounded-md border border-neutral-warm bg-background p-3 font-mono text-sm outline-none focus:border-primary"
          dir="ltr"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'0791234567,أحمد\n0799876543'}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={busy || !text.trim()}
            onClick={async () => {
              setBusy(true);
              const r = await fetch(`/api/admin/companies/${company.id}/roster`, {
                method: 'PUT', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ text }),
              });
              const j = await r.json();
              setBusy(false);
              if (r.ok) { setResult(j); setText(''); onChanged(); }
            }}
          >
            {busy ? t('uploading') : t('upload')}
          </Button>
          {result ? (
            <span className="text-sm tabular-nums text-text-secondary">
              {t('rosterResult', { before: result.before, after: result.after })}
            </span>
          ) : null}
        </div>

        {/* Rejected lines are shown, never swallowed: a 200-row upload that
            silently stores 180 is how a company turns up expecting a discount
            nobody can find. */}
        {result && result.rejected.length > 0 ? (
          <div className="mt-3 rounded-md border border-error bg-error/10 p-3">
            <div className="text-sm font-bold">{t('rejected', { n: result.rejected.length })}</div>
            <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs" dir="ltr">
              {result.rejected.map((x) => (
                <li key={x.line}>line {x.line}: {x.value} — {x.reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UsageTab({ uses, companies }: { uses: Use[]; companies: Company[] }) {
  const t = useTranslations('Admin');
  const nameOf = (id: string) =>
    companies.find((c) => c.id === id)?.nameAr || companies.find((c) => c.id === id)?.nameEn || id;

  if (uses.length === 0) return <p className="text-text-secondary">{t('noUses')}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-warm">
      <table className="w-full min-w-[36rem] border-collapse bg-card text-sm">
        <thead>
          <tr className="border-b border-neutral-warm bg-neutral-warm/30 text-start">
            <th className="p-3 text-start font-bold">{t('member')}</th>
            <th className="p-3 text-start font-bold">{t('company')}</th>
            <th className="p-3 text-start font-bold">{t('times')}</th>
            <th className="p-3 text-start font-bold">{t('value')}</th>
            <th className="p-3 text-start font-bold">{t('took')}</th>
          </tr>
        </thead>
        <tbody>
          {uses.map((u) => (
            <tr key={u.memberId} className="border-b border-neutral-warm/60 last:border-0">
              <td className="p-3">
                {u.name ?? <span dir="ltr" className="font-mono text-xs">{u.phone}</span>}
              </td>
              <td className="p-3">{nameOf(u.companyId)}</td>
              <td className="p-3 tabular-nums">{u.times}</td>
              <td className="p-3 tabular-nums">{jod(u.discountJod)}</td>
              <td className="p-3 text-text-secondary">
                {Object.entries(u.items).map(([n, q]) => `${n} ×${q}`).join('، ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
