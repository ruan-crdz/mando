import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { useCancelEdit, useStepper, useToggleEdit } from '../controller/GamepadProvider';

export type Option<T extends string> = { value: T; label: string };

/**
 * Substitui o `<select>`. Navegar passa por ele sem alterar nada;
 * A (✕) entra no modo edição, ←/→ trocam a opção e A (✕) ou B saem.
 */
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
  const [editing, setEditing] = useState(false);
  const ref = useStepper<HTMLButtonElement>(step);
  return (
    <div className={`option-cycler ${editing ? 'editing' : ''} ${className}`}>
      {label && <span className="control-label">{label}</span>}
      <button
        ref={ref}
        type="button"
        data-stepper={editing ? '' : undefined}
        data-toggle-edit=""
        aria-pressed={editing}
        aria-label={`${label ? `${label}: ` : ''}${options[index]?.label}. ${editing ? 'Esquerda e direita trocam, confirme para sair' : 'Confirme para editar'}`}
        onClick={() => setEditing((e) => !e)}
        onBlur={() => setEditing(false)}
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
        <ChevronRight
          size={18}
          className="cycler-arrow"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
        />
      </button>
    </div>
  );
}

/**
 * Slider de 1 a N para o controle: navegar passa por ele sem alterar nada.
 * A (✕) entra no modo edição, ←/→ ajustam o valor e A (✕) de novo encerra.
 * As alterações são aplicadas imediatamente.
 */
export function TacticSlider({
  label,
  value,
  min = 1,
  max = 5,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useStepper<HTMLButtonElement>((dir) => {
    const next = Math.max(min, Math.min(max, value + dir));
    if (next !== value) onChange(next);
  });
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <button
      ref={ref}
      type="button"
      className={`tactic-slider ${editing ? 'editing' : ''}`}
      data-stepper={editing ? '' : undefined}
      data-toggle-edit=""
      aria-pressed={editing}
      aria-label={`${label}: ${value} de ${max}. ${editing ? 'Esquerda e direita ajustam, confirme para sair da edição' : 'Confirme para editar'}`}
      onClick={() => setEditing((e) => !e)}
      onBlur={() => setEditing(false)}
    >
      <span className="ts-head">
        <span className="ts-label">{label}</span>
        <span className="ts-value">
          {editing && <ChevronLeft size={16} />}
          {value} / {max}
          {editing && <ChevronRight size={16} />}
        </span>
      </span>
      <span className="ts-track" aria-hidden="true">
        {steps.map((s) => (
          <i
            key={s}
            className={s <= value ? 'on' : ''}
            onClick={(e) => {
              e.stopPropagation();
              if (editing) onChange(s);
              else setEditing(true);
            }}
          />
        ))}
      </span>
      <span className="ts-hint">
        {editing ? (
          <>
            ← → ajustar · <ControllerButtonHint action="confirm" label="Concluir" /> ·{' '}
            <ControllerButtonHint action="back" label="Sair" />
          </>
        ) : (
          <ControllerButtonHint action="confirm" label="Editar" />
        )}
      </span>
    </button>
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
 * Campo numérico para controle: A abre o teclado numérico; □ entra no modo
 * ajuste (←/→ mudam o valor) e □ ou B saem. Fora do modo, as setas navegam.
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
  const [editing, setEditing] = useState(false);
  const ref = useStepper<HTMLInputElement>(bump);
  useToggleEdit(ref, () => setEditing((e) => !e));
  const shown = draft ?? (value === null ? '' : String(value));
  return (
    <div className={`number-stepper ${editing ? 'editing' : ''}`}>
      {label && <span className="control-label">{label}</span>}
      <div className="stepper-row">
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => bump(-1)}>
          <Minus size={15} />
        </button>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          data-stepper={editing ? '' : undefined}
          data-toggle-edit=""
          aria-pressed={editing}
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
            setEditing(false);
            setDraft(null);
            if (value !== null && value < min) onChange(min);
          }}
        />
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => bump(1)}>
          <Plus size={15} />
        </button>
      </div>
      {format && value !== null && <small className="stepper-format">{format(value)}</small>}
      {editing && <small className="stepper-hint">← → ajustar · □/B sair</small>}
    </div>
  );
}

/**
 * Número de camisa grande, no padrão de modo edição: A (✕) edita, ←/→ trocam,
 * A (✕) salva e B cancela.
 */
export function ShirtNumberDial({
  value,
  onSave,
  conflict,
}: {
  value: number;
  onSave: (value: number) => void;
  conflict?: (value: number) => string | undefined;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const editing = draft !== null;
  const ref = useStepper<HTMLButtonElement>((dir) =>
    setDraft((d) => (((d ?? value) - 1 + dir + 99) % 99) + 1),
  );
  useCancelEdit(ref, () => {
    setDraft(null);
    return true;
  });
  const shown = draft ?? value;
  const note = editing && draft !== value ? conflict?.(draft) : undefined;
  return (
    <div className={`shirt-dial ${editing ? 'editing' : ''}`}>
      <button
        ref={ref}
        type="button"
        data-stepper={editing ? '' : undefined}
        data-toggle-edit=""
        aria-pressed={editing}
        aria-label={`Número da camisa ${shown}. ${editing ? 'Esquerda e direita trocam, confirme para salvar, voltar cancela' : 'Confirme para editar'}`}
        onClick={() => {
          if (!editing) setDraft(value);
          else {
            if (draft !== value) onSave(draft);
            setDraft(null);
          }
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && editing) {
            e.stopPropagation();
            setDraft(null);
          }
        }}
      >
        {editing && <ChevronLeft size={26} className="dial-arrow" />}
        <span className="dial-number">{shown}</span>
        {editing && <ChevronRight size={26} className="dial-arrow" />}
      </button>
      <small className="dial-hint">
        {editing ? '← → trocar · X/✕ salvar · B cancelar' : 'X/✕ editar número'}
      </small>
      {note && <small className="dial-note">{note}</small>}
    </div>
  );
}
