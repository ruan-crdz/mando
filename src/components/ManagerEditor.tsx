import { useState } from 'react';
import { type Manager } from '../game/types';
import { OptionCycler } from './controls';
import { ManagerBirthDate } from './ManagerBirthDate';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';

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
      <ManagerBirthDate
        value={birth}
        referenceDate={referenceDate}
        onChange={(birthDate) => setDraft((current) => ({ ...current, birthDate }))}
      />
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
