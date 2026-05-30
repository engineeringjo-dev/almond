import type { CSSProperties, ReactNode } from 'react';
import { colors } from '../theme';

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: colors.cardBg,
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 2px 10px rgba(28,18,8,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  type = 'button',
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}) {
  const variants: Record<string, CSSProperties> = {
    primary: { background: colors.gold, color: colors.dark, border: 'none' },
    outline: { background: 'transparent', color: colors.brown, border: `1.5px solid ${colors.gold}` },
    danger: { background: 'transparent', color: colors.red, border: `1.5px solid ${colors.red}` },
    ghost: { background: 'transparent', color: colors.warmGray, border: 'none' },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 18px',
        borderRadius: 10,
        fontWeight: 700,
        fontSize: 14,
        opacity: disabled ? 0.5 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, color: colors.warmGray, fontWeight: 700 }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, color: colors.warmGray }}>{hint}</span> : null}
    </label>
  );
}

const inputStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${colors.lightGold}`,
  background: colors.white,
  fontSize: 14,
  color: colors.dark,
  width: '100%',
};

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      style={inputStyle}
      value={value}
      type={type}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 52,
        height: 30,
        borderRadius: 999,
        border: 'none',
        background: checked ? colors.green : colors.warmGray,
        position: 'relative',
        transition: 'background 0.2s',
      }}
      aria-pressed={checked}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          insetInlineStart: checked ? 25 : 3,
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: colors.white,
          transition: 'inset-inline-start 0.2s',
        }}
      />
    </button>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 20, marginBottom: 16, color: colors.dark }}>{children}</h2>;
}
