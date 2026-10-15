import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Alert, Platform } from 'react-native';

import { confirmAction, notify } from '@/lib/dialog';

/**
 * DG — A QUESTION THE WEB BUILD CAN ANSWER (layout panel, 2026-10-15).
 *
 * react-native-web's Alert is `static alert() {}`. «استبدل» on the web build
 * opened nothing and redeemed nothing, and «بياناتك» refused an empty name in
 * silence. DG1 pins the web path, DG2 that the phone keeps Alert, DG3 that no
 * screen calls Alert past the helper again.
 */
type Win = { alert: ReturnType<typeof vi.fn>; confirm: ReturnType<typeof vi.fn> };
const g = globalThis as unknown as { window?: Win };
let saved: Win | undefined;
beforeEach(() => {
  saved = g.window;
  g.window = { alert: vi.fn(), confirm: vi.fn(() => true) };
});
afterEach(() => {
  g.window = saved;
  vi.restoreAllMocks();
});

describe('DG1 on the web, the browser\'s own dialogs', () => {
  it('notify shows the title and the body', () => {
    const native = vi.spyOn(Alert, 'alert');
    notify('تم', 'أضفنا القسيمة');
    expect(g.window!.alert).toHaveBeenCalledWith('تم\n\nأضفنا القسيمة');
    notify('خطأ');
    expect(g.window!.alert).toHaveBeenLastCalledWith('خطأ');
    expect(native).not.toHaveBeenCalled();
  });

  it('confirmAction runs the action on yes, and only on yes', () => {
    const onConfirm = vi.fn();
    const ask = { title: 'استبدال', body: '1.000 د.أ مقابل 100 نقطة', confirm: 'استبدل', cancel: 'إلغاء', onConfirm };
    confirmAction(ask);
    expect(g.window!.confirm).toHaveBeenCalledWith('استبدال\n\n1.000 د.أ مقابل 100 نقطة');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    g.window!.confirm.mockReturnValue(false);
    confirmAction(ask);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('DG2 on the phone, Alert as before', () => {
  const os = Platform.OS;
  beforeEach(() => { (Platform as { OS: string }).OS = 'ios'; });
  afterEach(() => { (Platform as { OS: string }).OS = os; });

  it('the cancel button first, the action on the other', () => {
    const native = vi.spyOn(Alert, 'alert');
    const onConfirm = vi.fn();
    confirmAction({ title: 'T', body: 'B', confirm: 'نعم', cancel: 'إلغاء', onConfirm });
    expect(g.window!.confirm).not.toHaveBeenCalled();
    const [title, body, buttons] = native.mock.calls[0]!;
    expect([title, body]).toEqual(['T', 'B']);
    expect(buttons).toEqual([
      { text: 'إلغاء', style: 'cancel' },
      { text: 'نعم', onPress: onConfirm },
    ]);
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

  it('the redeem button and the details form go through it', () => {
    const rewards = readFileSync(join(root, 'app/(tabs)/rewards.tsx'), 'utf8');
    expect(rewards).toMatch(/confirmAction\(\{\s*title: t\('rewards\.confirmTitle'\)/);
    expect(rewards).toMatch(/onSuccess: \(\) => notify\(t\('rewards\.redeemedTitle'\)/);
    const details = readFileSync(join(root, 'app/profile/details.tsx'), 'utf8');
    expect(details.match(/\bnotify\(/g)?.length).toBe(4);
  });
});
