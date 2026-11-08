import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import {
  useCancelEdit,
  useGamepad,
  useStepper,
  useToggleEdit,
} from '../controller/GamepadProvider';

export type Option<T extends string> = { value: T; label: string };

/**
 * Substitui o `<select>`. Navegar passa por ele sem alterar nada;
 * A (✕) edita e confirma; B descarta o rascunho.
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
  const { helpOpen } = useGamepad();
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [draft, setDraft] = useState<number | null>(null);
  const editing = draft !== null;
  const shown = draft ?? index;
  const step = (dir: number) => {
    const next = (((shown + dir) % options.length) + options.length) % options.length;
    if (editing) setDraft(next);
    else onChange(options[next].value);
  };
  const ref = useStepper<HTMLButtonElement>(step);
  useCancelEdit(ref, () => {
    setDraft(null);
    return true;
  });
  return (
    <div className={`option-cycler ${editing ? 'editing' : ''} ${className}`}>
      {label && <span className="control-label">{label}</span>}
      <button
        ref={ref}
        type="button"
        data-stepper={editing ? '' : undefined}
        data-toggle-edit=""
        aria-pressed={editing}
        aria-label={`${label ? `${label}: ` : ''}${options[shown]?.label}. ${editing ? 'Esquerda e direita trocam, confirmar salva, voltar cancela' : 'Confirme para editar'}`}
        onClick={() => {
          if (!editing) setDraft(index);
          else {
            onChange(options[shown].value);
            setDraft(null);
          }
        }}
        onBlur={() => {
          if (!helpOpen) setDraft(null);
        }}
      >
        <ChevronLeft
          size={18}
          className="cycler-arrow"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
        />
        <span className="cycler-value">{options[shown]?.label}</span>
        <span className="cycler-dots" aria-hidden="true">
          {options.length <= 12 &&
            options.map((o, i) => <i key={o.value} className={i === shown ? 'on' : ''} />)}
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
 * B descarta o rascunho sem alterar o plano.
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
  const { helpOpen } = useGamepad();
  const [draft, setDraft] = useState<number | null>(null);
  const editing = draft !== null;
  const shown = draft ?? value;
  const ref = useStepper<HTMLButtonElement>((dir) => {
    setDraft(Math.max(min, Math.min(max, shown + dir)));
  });
  useCancelEdit(ref, () => {
    setDraft(null);
    return true;
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
      aria-label={`${label}: ${shown} de ${max}. ${editing ? 'Esquerda e direita ajustam, confirmar salva, voltar cancela' : 'Confirme para editar'}`}
      onClick={() => {
        if (!editing) setDraft(value);
        else {
          onChange(shown);
          setDraft(null);
        }
      }}
      onBlur={() => {
        if (!helpOpen) setDraft(null);
      }}
    >
      <span className="ts-head">
        <span className="ts-label">{label}</span>
        <span className="ts-value">
          {editing && <ChevronLeft size={16} />}
          {shown} / {max}
          {editing && <ChevronRight size={16} />}
        </span>
      </span>
      <span className="ts-track" aria-hidden="true">
        {steps.map((s) => (
          <i
            key={s}
            className={s <= shown ? 'on' : ''}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(s);
            }}
          />
        ))}
      </span>
      <span className="ts-hint">
        {editing ? (
          <>
            ← → ajustar · <ControllerButtonHint action="confirm" label="Concluir" /> ·{' '}
            <ControllerButtonHint action="back" label="Cancelar" />
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
 * A edita/confirma, B cancela; Y abre o teclado numérico durante a edição.
 * Setas ajustam; L1/R1 ou LB/RB multiplicam o passo por dez.
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
  const { helpOpen } = useGamepad();
  const [draft, setDraft] = useState<string | null>(null);
  const clampValue = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const bump = (dir: number) => {
    const base = draft !== null && draft !== '' ? Number(draft) : (value ?? min);
    const next = clampValue(base + dir * (step ?? niceStep(base)));
    if (editing) setDraft(String(next));
    else onChange(next);
  };
  const [editing, setEditing] = useState(false);
  const ref = useStepper<HTMLInputElement>(bump);
  const confirm = () => {
    if (editing) {
      onChange(!draft && optional ? null : clampValue(Number(draft ?? value ?? min)));
      setDraft(null);
      setEditing(false);
    } else {
      setDraft(value === null ? '' : String(value));
      setEditing(true);
    }
  };
  useToggleEdit(ref, confirm);
  useCancelEdit(ref, () => {
    setDraft(null);
    setEditing(false);
    return true;
  });
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
          data-keyboard-option=""
          aria-pressed={editing}
          aria-label={label}
          placeholder={placeholder ?? (optional ? 'Qualquer' : String(min))}
          value={shown}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            setDraft(digits);
            if (!editing) {
              if (!digits) onChange(optional ? null : clampValue(min));
              else onChange(Math.min(max, Number(digits)));
            }
          }}
          onBlur={() => {
            if (helpOpen) return;
            setEditing(false);
            setDraft(null);
            if (value !== null && value < min) onChange(min);
          }}
        />
        <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => bump(1)}>
          <Plus size={15} />
        </button>
      </div>
      {format && shown !== '' && <small className="stepper-format">{format(Number(shown))}</small>}
      <small className="stepper-hint">
        {editing
          ? '← → ajustar · L1/R1 ou LB/RB ×10 · confirmar salva · voltar cancela · △/Y digitar'
          : 'Confirmar para ajustar ou digitar'}
      </small>
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
  const { helpOpen } = useGamepad();
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
        onBlur={() => {
          if (!helpOpen) setDraft(null);
        }}
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
