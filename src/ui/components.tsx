import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled,
  className,
  title,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const variants = {
    default: 'bg-ink-700 hover:bg-ink-600 text-ink-100 border border-white/8',
    primary:
      'bg-gradient-to-r from-brand-500 to-hot-500 text-white border border-white/10 hover:brightness-110 shadow-lg shadow-brand-500/20',
    ghost: 'bg-transparent hover:bg-white/6 text-ink-200 border border-transparent',
    outline: 'bg-transparent hover:bg-white/6 text-ink-100 border border-white/14',
    danger: 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30',
  };
  const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-150 active:scale-[0.98]',
        'disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold transition-all border',
        active
          ? 'bg-brand-500/20 text-white border-brand-500/60'
          : 'bg-white/4 text-ink-300 border-white/8 hover:text-ink-100 hover:border-white/20',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('panel', className)}>{children}</div>;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div
        className={cn(
          'panel relative z-10 w-full overflow-hidden animate-fade-up',
          wide ? 'max-w-5xl' : 'max-w-2xl',
        )}
      >
        <div className="flex items-start justify-between gap-6 border-b border-white/8 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink-300">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-300 transition hover:bg-white/8 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">{label}</span>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 py-2.5 text-sm text-white',
        'placeholder:text-ink-400 outline-none transition focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/20',
        className,
      )}
    />
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn('w-full cursor-pointer', className)}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-ink-200"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full border transition-colors',
          checked ? 'border-brand-500 bg-brand-500/70' : 'border-white/12 bg-ink-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4.5 left-0.5' : 'translate-x-0 left-0.5',
          )}
        />
      </span>
      {label}
    </button>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/8', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-hot-500 transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  suffix,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div
        className={cn(
          'mt-0.5 text-xl font-bold tabular-nums',
          tone === 'good' && 'text-mint-500',
          tone === 'warn' && 'text-amber-500',
          tone === 'default' && 'text-white',
        )}
      >
        {value}
        {suffix && <span className="ml-0.5 text-xs font-semibold text-ink-400">{suffix}</span>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
      <div className="text-ink-400">{icon}</div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <div className="max-w-sm text-sm text-ink-300">{children}</div>
    </div>
  );
}
