import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Alert, Platform } from 'react-native';

import { notify } from '@/lib/dialog';

/**
 * DG — A MESSAGE THE WEB BUILD SHOWS (layout panel, 2026-10-15).
 *
 * react-native-web's Alert is `static alert() {}`. «استبدل» on the web build
 * opened nothing and redeemed nothing, and «بياناتك» refused an empty name in
 * silence. DG1 pins the web path, DG2 that the phone keeps Alert, DG3 that no
 * screen calls Alert past the helper again — and that the redemption asks in
 * its sheet, which works the same on every platform.
 */
type Win = { alert: ReturnType<typeof vi.fn> };
const g = globalThis as unknown as { window?: Win };
let saved: Win | undefined;
beforeEach(() => {
  saved = g.window;
  g.window = { alert: vi.fn() };
});
afterEach(() => {
  g.window = saved;
  vi.restoreAllMocks();
});

describe('DG1 on the web, the browser\'s own alert', () => {
  it('notify shows the title and the body', () => {
    const native = vi.spyOn(Alert, 'alert');
    notify('خصمك جاهز', 'أضفنا القسيمة');
    expect(g.window!.alert).toHaveBeenCalledWith('خصمك جاهز\n\nأضفنا القسيمة');
    notify('خطأ');
    expect(g.window!.alert).toHaveBeenLastCalledWith('خطأ');
    expect(native).not.toHaveBeenCalled();
  });
});

describe('DG2 on the phone, Alert as before', () => {
  const os = Platform.OS;
  beforeEach(() => { (Platform as { OS: string }).OS = 'ios'; });
  afterEach(() => { (Platform as { OS: string }).OS = os; });

  it('the title and the body, in the platform\'s alert', () => {
    const native = vi.spyOn(Alert, 'alert');
    notify('T', 'B');
    expect(native).toHaveBeenLastCalledWith('T', 'B');
    expect(g.window!.alert).not.toHaveBeenCalled();
  });
});

describe('DG3 no screen reaches past the helper', () => {
  const root = join(__dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
    });

  it('Alert.alert appears only in lib/dialog.ts', () => {
    const offenders = ['app', 'components', 'hooks', 'lib', 'stores', 'services']
      .flatMap((d) => files(join(root, d)))
      .filter((p) => relative(root, p) !== join('lib', 'dialog.ts'))
      .filter((p) => /\bAlert\.alert\(|\bAlert\b[^'\n]*\} from 'react-native'|import \{[^}]*\bAlert\b[^}]*\} from 'react-native'/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(root, p));
    expect(offenders).toEqual([]);
  });

  it('the redeem button asks in its sheet, and the details form goes through the helper', () => {
    // The amount only opens the sheet; the sheet alone redeems, and only from
    // its «استبدال» (or «إعادة المحاولة») button — so a cancel redeems nothing.
    const rewards = readFileSync(join(root, 'app/(tabs)/rewards.tsx'), 'utf8');
    expect(rewards).toMatch(/onPress=\{\(\) => setRedeeming\(o\)\}/);
    expect(rewards).toMatch(/<RedeemSheet option=\{redeeming\} onClose=\{\(\) => setRedeeming\(null\)\} \/>/);
    expect(rewards).not.toMatch(/\.mutate\(|confirmAction|notify\(/);
    const sheet = readFileSync(join(root, 'components/loyalty/RedeemSheet.tsx'), 'utf8');
    expect(sheet.match(/\bredeem\.mutate\(/g)).toHaveLength(1);
    expect(sheet).toMatch(/const confirm = \(\) => \{\s*if \(!shown \|\| redeem\.isPending \|\| !intent\.current\) return;/);
    expect(sheet).toContain('idempotencyKey: attempt.key');
    expect(sheet.match(/onPress=\{confirm\}/g)).toHaveLength(1);
    const details = readFileSync(join(root, 'app/profile/details.tsx'), 'utf8');
    expect(details.match(/\bnotify\(/g)?.length).toBe(4);
  });
});
