import { useState } from 'react';
import { type Manager } from '../game/types';
import { OptionCycler } from './controls';
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
  const ref = useStepper<HTMLButtonElement>((direction) =>
    onChange(Math.max(min, Math.min(max, value + direction))),
  );
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
        <span aria-hidden="true">‹</span>
        <strong>{String(value).padStart(2, '0')}</strong>
        <span aria-hidden="true">›</span>
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

export function ManagerEditor({
  manager,
  referenceDate,
  onSave,
}: {
  manager: Manager;
  referenceDate: string;
  onSave: (manager: Manager) => void;
}) {
  const [draft, setDraft] = useState(manager);
  const referenceYear = Number(referenceDate.slice(0, 4));
  const birth = draft.birthDate ?? `${referenceYear - draft.age}-01-01`;
  const datePart = (part: 'year' | 'month' | 'day', value: number) => {
    const year = part === 'year' ? value : Number(birth.slice(0, 4));
    const month = part === 'month' ? value : Number(birth.slice(5, 7));
    const day = Math.min(
      part === 'day' ? value : Number(birth.slice(8)),
      new Date(Date.UTC(year, month, 0)).getUTCDate(),
    );
    setDraft({
      ...draft,
      birthDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  };
  return (
    <section className="manager-edit-form">
      <h3>Personalizar manager</h3>
      <div className="form-grid">
        <label>
          Nome
          <input
            value={draft.firstName}
            maxLength={35}
            onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
          />
        </label>
        <label>
          Sobrenome
          <input
            value={draft.lastName}
            maxLength={45}
            onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
          />
        </label>
        <label>
          Nacionalidade
          <input
            value={draft.nationality}
            onChange={(event) => setDraft({ ...draft, nationality: event.target.value })}
          />
        </label>
        <label>
          País/região
          <input
            value={draft.countryRegion ?? draft.nationality}
            onChange={(event) => setDraft({ ...draft, countryRegion: event.target.value })}
          />
        </label>
        <label>
          Região de nascimento
          <input
            value={draft.birthRegion ?? ''}
            onChange={(event) => setDraft({ ...draft, birthRegion: event.target.value })}
          />
        </label>
        <label>
          Aparência
          <input
            value={draft.appearance}
            maxLength={400}
            onChange={(event) => setDraft({ ...draft, appearance: event.target.value })}
          />
        </label>
      </div>
      <div className="form-grid manager-birth-date">
        <BirthDatePart
          label="Dia de nascimento"
          value={Number(birth.slice(8))}
          min={1}
          max={new Date(
            Date.UTC(Number(birth.slice(0, 4)), Number(birth.slice(5, 7)), 0),
          ).getUTCDate()}
          onChange={(value) => datePart('day', value)}
        />
        <BirthDatePart
          label="Mês de nascimento"
          value={Number(birth.slice(5, 7))}
          min={1}
          max={12}
          onChange={(value) => datePart('month', value)}
        />
        <BirthDatePart
          label="Ano de nascimento"
          value={Number(birth.slice(0, 4))}
          min={referenceYear - 85}
          max={referenceYear - 18}
          onChange={(value) => datePart('year', value)}
        />
      </div>
      <OptionCycler
        label="Gênero"
        value={draft.gender ?? 'Não informar'}
        options={(['Homem', 'Mulher', 'Não informar'] as const).map((value) => ({
          value,
          label: value,
        }))}
        onChange={(gender) => setDraft({ ...draft, gender })}
      />
      <OptionCycler
        label="Tratamento"
        value={draft.formOfAddress ?? 'Sr.'}
        options={(['Sr.', 'Sra.', 'Mx.'] as const).map((value) => ({ value, label: value }))}
        onChange={(formOfAddress) => setDraft({ ...draft, formOfAddress })}
      />
      <OptionCycler
        label="Vestuário"
        value={draft.style}
        options={(['Terno azul', 'Agasalho', 'Camisa social'] as const).map((value) => ({
          value,
          label: value,
        }))}
        onChange={(style) => setDraft({ ...draft, style })}
      />
      <button
        className="primary"
        data-controller-secondary
        onClick={() => onSave({ ...draft, avatar: manager.avatar })}
      >
        Salvar personalização <ControllerButtonHint action="secondary" label="Salvar" />
      </button>
    </section>
  );
}
