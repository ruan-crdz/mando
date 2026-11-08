import { useState } from 'react';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { useStepper } from '../controller/GamepadProvider';

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
  const earliestYear = Number(referenceDate.slice(0, 4)) - 85;
  const latestYear = Number(referenceDate.slice(0, 4)) - 18;
  const year = Number(value.slice(0, 4));
  return (
    <div className={`manager-birth-date-control ${className}`}>
      <span className="control-label">Ano de nascimento</span>
      <div className="manager-birth-date" role="group" aria-label="Data de nascimento">
        <BirthDatePart
          label="Ano de nascimento"
          value={year}
          min={earliestYear}
          max={latestYear}
          onChange={(next) => onChange(`${next}-01-01`)}
        />
      </div>
      <small className="manager-date-hint">O manager deve ter entre 18 e 85 anos.</small>
    </div>
  );
}
