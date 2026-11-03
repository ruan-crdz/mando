import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { useStepper } from '../controller/GamepadProvider';

export type Option<T extends string> = { value: T; label: string };

/** Substitui o `<select>`: ←/→ do controle trocam a opção, A avança. */
export function OptionCycler<T extends string>({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const step = (dir: number) =>
    onChange(options[(index + dir + options.length) % options.length].value);
  const ref = useStepper<HTMLButtonElement>(step);
  return (
    <div className={`option-cycler ${className}`}>
      {label && <span className="control-label">{label}</span>}
      <button
        ref={ref}
        type="button"
        data-stepper
        aria-label={`${label ? `${label}: ` : ''}${options[index]?.label}. Use esquerda e direita para trocar`}
        onClick={() => step(1)}
      >
        <ChevronLeft
          size={18}
          className="cycler-arrow"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
        />
        <span className="cycler-value">{options[index]?.label}</span>
        <span className="cycler-dots" aria-hidden="true">
          {options.length <= 12 &&
            options.map((o) => <i key={o.value} className={o.value === value ? 'on' : ''} />)}
        </span>
        <ChevronRight size={18} className="cycler-arrow" />
      </button>
    </div>
  );
}

/** Poucas opções lado a lado, como os botões de opção do FIFA. */
export function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="chip-group" role="radiogroup" aria-label={label}>
      {label && <span className="control-label">{label}</span>}
      <div className="chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Passo proporcional ao valor: 1.234.567 anda de 100 mil em 100 mil. */
export const niceStep = (value: number) =>
  Math.max(1, 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, Math.abs(value)))) - 1));

/**
 * Campo numérico para controle: ←/→ ajustam, A abre o teclado numérico.
 * Nunca exibe zeros à esquerda ("0123") e aceita apagar tudo.
 */
export function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step,
  format,
  placeholder,
  optional = false,
}: {
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => ReactNode;
  placeholder?: string;
  /** Quando verdadeiro, o campo vazio significa "sem filtro" (null). */
  optional?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clampValue = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const bump = (dir: number) => {
    setDraft(null);
    const base = value ?? (dir > 0 ? min : max === Number.MAX_SAFE_INTEGER ? min : max);
    onChange(clampValue(value === null ? base : base + dir * (step ?? niceStep(base))));
  };
  const ref = useStepper<HTMLInputElement>(bump);
  const shown = draft ?? (value === null ? '' : String(value));
  return (
    <div className="number-stepper">
      {label && <span className="control-label">{label}</span>}
      <div className="stepper-row">
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => bump(-1)}>
          <Minus size={15} />
        </button>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          data-stepper
          aria-label={label}
          placeholder={placeholder ?? (optional ? 'Qualquer' : String(min))}
          value={shown}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            setDraft(digits);
            if (!digits) onChange(optional ? null : clampValue(min));
            else onChange(Math.min(max, Number(digits)));
          }}
          onBlur={() => {
            setDraft(null);
            if (value !== null && value < min) onChange(min);
          }}
        />
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => bump(1)}>
          <Plus size={15} />
        </button>
      </div>
      {format && value !== null && <small className="stepper-format">{format(value)}</small>}
    </div>
  );
}
