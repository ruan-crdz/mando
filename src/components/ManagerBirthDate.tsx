import { useState } from 'react';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { useStepper } from '../controller/GamepadProvider';
import { addDays, addMonths } from '../game/random';

function BirthDatePart({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const step = (direction: number) => {
    const next = Math.max(min, Math.min(max, value + direction));
    if (next !== value) onChange(next);
  };
  const ref = useStepper<HTMLButtonElement>(step);
  return (
    <div className={`manager-date-part ${editing ? 'editing' : ''}`}>
      <span className="control-label">{label}</span>
      <button
        ref={ref}
        type="button"
        data-stepper={editing ? '' : undefined}
        data-toggle-edit=""
        aria-pressed={editing}
        aria-label={`${label}: ${value}. ${
          editing
            ? 'Esquerda e direita alteram, confirme para concluir'
            : 'Confirme para alterar'
        }`}
        onClick={() => setEditing((current) => !current)}
        onBlur={() => setEditing(false)}
      >
        <span
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            step(-1);
          }}
        >
          ‹
        </span>
        <strong>{String(value).padStart(2, '0')}</strong>
        <span
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            step(1);
          }}
        >
          ›
        </span>
      </button>
      <small>
        {editing ? (
          '← → alterar · confirmar concluir'
        ) : (
          <ControllerButtonHint action="confirm" label="Alterar" />
        )}
      </small>
    </div>
  );
}

export function ManagerBirthDate({
  value,
  referenceDate,
  onChange,
  className = '',
}: {
  value: string;
  referenceDate: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const earliest = addDays(addMonths(referenceDate, -86 * 12), 1);
  const latest = addMonths(referenceDate, -18 * 12);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const daysInMonth = (nextYear: number, nextMonth: number) =>
    new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  const update = (part: 'year' | 'month' | 'day', next: number) => {
    const nextYear = part === 'year' ? next : year;
    const nextMonth = part === 'month' ? next : month;
    const nextDay = Math.min(part === 'day' ? next : day, daysInMonth(nextYear, nextMonth));
    const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
    onChange(date < earliest ? earliest : date > latest ? latest : date);
  };
  return (
    <div className={`manager-birth-date-control ${className}`}>
      <span className="control-label">Data de nascimento</span>
      <div className="manager-birth-date" role="group" aria-label="Data de nascimento">
        <BirthDatePart
          label="Dia de nascimento"
          value={day}
          min={1}
          max={daysInMonth(year, month)}
          onChange={(next) => update('day', next)}
        />
        <BirthDatePart
          label="Mês de nascimento"
          value={month}
          min={1}
          max={12}
          onChange={(next) => update('month', next)}
        />
        <BirthDatePart
          label="Ano de nascimento"
          value={year}
          min={Number(earliest.slice(0, 4))}
          max={Number(latest.slice(0, 4))}
          onChange={(next) => update('year', next)}
        />
      </div>
      <small className="manager-date-hint">O manager deve ter entre 18 e 85 anos.</small>
    </div>
  );
}
