import { useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  ClipboardList,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { available, bestLineup, squad } from '../game/matches';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import {
  formations,
  roleNames,
  type Career,
  type Formation,
  type Player,
  type Tactic,
  type World,
} from '../game/types';
import { Metric, Modal, money, SectionTitle } from '../components/ui';

const attributeLabels: Record<string, string> = {
  pace: 'Velocidade',
  acceleration: 'Aceleração',
  finishing: 'Finalização',
  shortPass: 'Passe curto',
  longPass: 'Passe longo',
  vision: 'Visão',
  dribbling: 'Drible',
  control: 'Controle',
  strength: 'Força',
  stamina: 'Resistência',
  positioning: 'Posicionamento',
  marking: 'Marcação',
  tackling: 'Desarme',
  interception: 'Interceptação',
  heading: 'Cabeceio',
  composure: 'Compostura',
  reflexes: 'Reflexos',
  handling: 'Segurança',
  diving: 'Elasticidade',
};

export function Squad({
  career: c,
  world,
  onChange,
  onRenew,
  onError,
  detail,
  setDetail,
}: {
  career: Career;
  world: World;
  onChange: (c: Career) => void;
  onRenew: (id: string) => void;
  onError: (s: string) => void;
  detail: Player | null;
  setDetail: (p: Player | null) => void;
}) {
  const [view, setView] = useState<'lineup' | 'tactics' | 'roles'>('lineup');
  const [slot, setSlot] = useState<number | null>(null);
  const players = squad(c, world);
  const updateTactic = (change: Partial<Tactic>) => {
    const next = { ...c, tactic: { ...c.tactic, ...change } };
    if (change.formation) next.lineup = bestLineup(next, world);
    if (next.lineup.length !== 11) {
      onError('Não há atletas disponíveis para esta formação.');
      return;
    }
    onChange(next);
  };
  const changeSlot = (index: number, id: string) => {
    if (!available(c, id)) {
      onError('Atleta indisponível.');
      return;
    }
    if (index === 0 && world.players.find((p) => p.id === id)?.position !== 'GK') {
      onError('A posição exige um goleiro.');
      return;
    }
    const lineup = [...c.lineup];
    const existing = lineup.indexOf(id);
    if (existing >= 0) lineup[existing] = lineup[index];
    lineup[index] = id;
    onChange({ ...c, lineup });
    setSlot(null);
  };
  const rolePositions = formations[c.tactic.formation];
  const coordinates = rolePositions.map((role, i) => {
    if (i === 0) return { x: 50, y: 87 };
    const category =
      ['LB', 'CB', 'RB'].includes(role) && i < 6
        ? 0
        : ['DM', 'CM', 'LM', 'RM'].includes(role)
          ? 1
          : ['AM', 'LW', 'RW'].includes(role)
            ? 2
            : 3;
    const group = rolePositions
      .map((r, j) => ({ r, j }))
      .filter(
        ({ r, j }) =>
          j > 0 &&
          (['LB', 'CB', 'RB'].includes(r) && j < 6
            ? 0
            : ['DM', 'CM', 'LM', 'RM'].includes(r)
              ? 1
              : ['AM', 'LW', 'RW'].includes(r)
                ? 2
                : 3) === category,
      );
    return {
      x: ((group.findIndex(({ j }) => j === i) + 1) * 100) / (group.length + 1),
      y: [68, 49, 30, 12][category],
    };
  });
  return (
    <div className="screen-enter">
      <SectionTitle kicker="TIME / GESTÃO DO ELENCO" title="Onze nomes. Uma ideia.">
        <button
          onClick={() => {
            const lineup = bestLineup(c, world);
            if (lineup.length !== 11) onError('Não há onze atletas disponíveis.');
            else onChange({ ...c, lineup });
          }}
        >
          <Sparkles size={17} /> Autoescalar
        </button>
      </SectionTitle>
      <div className="segmented">
        <button className={view === 'lineup' ? 'active' : ''} onClick={() => setView('lineup')}>
          <Shield size={16} /> Escalação
        </button>
        <button className={view === 'tactics' ? 'active' : ''} onClick={() => setView('tactics')}>
          <SlidersHorizontal size={16} /> Tática
        </button>
        <button className={view === 'roles' ? 'active' : ''} onClick={() => setView('roles')}>
          <ClipboardList size={16} /> Responsabilidades
        </button>
      </div>
      <div className="squad-layout">
        <section className="panel pitch-panel">
          <div className="panel-heading">
            <h2>{c.tactic.formation}</h2>
            <span className="pill">{c.tactic.mentality}</span>
          </div>
          <div className="football-pitch">
            <div className="pitch-center" />
            <div className="penalty top" />
            <div className="penalty bottom" />
            {c.lineup.map((id, i) => {
              const p = world.players.find((p) => p.id === id)!;
              const s = c.players[id];
              return (
                <button
                  key={`${i}-${id}`}
                  className={`pitch-player ${!available(c, id) ? 'unavailable' : ''}`}
                  style={{ left: `${coordinates[i].x}%`, top: `${coordinates[i].y}%` }}
                  onClick={() => setSlot(i)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.getData('text/plain');
                    if (players.some((p) => p.id === dropped)) changeSlot(i, dropped);
                  }}
                  aria-label={`${rolePositions[i]} ${p.name}, overall ${overall(p, rolePositions[i], s)}. Trocar atleta`}
                >
                  <span className="shirt-number">{overall(p, rolePositions[i], s)}</span>
                  <strong>{p.name.split(' ').at(-1)}</strong>
                  <small>
                    {rolePositions[i]} · {Math.round(s.fitness)}%
                  </small>
                </button>
              );
            })}
          </div>
          <p className="muted small">
            Selecione uma posição para trocar. No mouse, também é possível arrastar.
          </p>
        </section>
        <section className="panel squad-controls">
          {view === 'tactics' ? (
            <>
              <p className="eyebrow">IDENTIDADE EM CAMPO</p>
              <h2>Como vamos jogar?</h2>
              <div className="tactic-form">
                <label>
                  Formação
                  <select
                    value={c.tactic.formation}
                    onChange={(e) => updateTactic({ formation: e.target.value as Formation })}
                  >
                    {Object.keys(formations).map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Mentalidade
                  <select
                    value={c.tactic.mentality}
                    onChange={(e) =>
                      updateTactic({ mentality: e.target.value as Tactic['mentality'] })
                    }
                  >
                    {['Defensiva', 'Equilibrada', 'Ofensiva'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                {(
                  [
                    ['pressure', 'Pressão'],
                    ['width', 'Largura'],
                    ['tempo', 'Velocidade de construção'],
                    ['line', 'Linha defensiva'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <span className="range-value">{c.tactic[key]} / 5</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={c.tactic[key]}
                      onChange={(e) => updateTactic({ [key]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
              <p className="muted small">
                Pressão alta gasta mais energia e aumenta o risco de cartões. Linha e mentalidade
                alteram o equilíbrio entre ataque e defesa.
              </p>
            </>
          ) : view === 'roles' ? (
            <>
              <p className="eyebrow">LIDERANÇA E BOLA PARADA</p>
              <h2>Quem chama a responsabilidade?</h2>
              <div className="form-grid">
                {roleNames.map((role) => (
                  <label key={role}>
                    {role}
                    <select
                      value={c.roles[role] || ''}
                      onChange={(e) =>
                        onChange({ ...c, roles: { ...c.roles, [role]: e.target.value } })
                      }
                    >
                      <option value="">Não definido</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <p className="muted small">
                Responsabilidades ficam salvas no clube. Cobranças específicas de bola parada ainda
                não são diferenciadas na simulação.
              </p>
            </>
          ) : (
            <>
              <div className="panel-heading">
                <h2>Elenco principal</h2>
                <span>{players.length} atletas</span>
              </div>
              <div className="roster-list">
                {players
                  .sort((a, b) => overall(b) - overall(a))
                  .map((p) => {
                    const s = c.players[p.id];
                    return (
                      <button
                        key={p.id}
                        className="roster-row"
                        onClick={() => setDetail(p)}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                      >
                        <span className="position-tag">{p.position}</span>
                        <span className="roster-name">
                          <strong>{p.name}</strong>
                          <small>
                            {s.injuryDays
                              ? `Lesão: ${s.injuryDays} dias`
                              : s.suspension
                                ? `Suspenso: ${s.suspension} jogo(s)`
                                : `${ageAt(p.birthDate, c.date)} anos · ${c.lineup.includes(p.id) ? 'Titular' : 'Reserva'}`}
                          </small>
                        </span>
                        <span className="condition">
                          <Activity size={12} />
                          {Math.round(s.fitness)}
                        </span>
                        <span className="ovr">{overall(p, p.position, s)}</span>
                      </button>
                    );
                  })}
              </div>
            </>
          )}
        </section>
      </div>
      {slot !== null && (
        <Modal title={`Escolher atleta · ${rolePositions[slot]}`} onClose={() => setSlot(null)}>
          <p className="muted">Selecione o jogador. Titulares trocam de posição entre si.</p>
          <div className="picker-grid">
            {players
              .filter((p) => available(c, p.id) && (slot !== 0 || p.position === 'GK'))
              .map((p) => (
                <button key={p.id} onClick={() => changeSlot(slot, p.id)}>
                  <span className="ovr">{overall(p, rolePositions[slot], c.players[p.id])}</span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.position} · Condição {Math.round(c.players[p.id].fitness)}%
                    </small>
                  </span>
                  <ArrowLeftRight size={15} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="detail-metrics">
            <Metric label="POSIÇÃO" value={detail.position} />
            <Metric
              label="OVERALL"
              value={overall(detail, detail.position, c.players[detail.id])}
            />
            <Metric
              label="POTENCIAL"
              value={`${detail.potential - detail.uncertainty}–${Math.min(99, detail.potential + detail.uncertainty)}`}
            />
            <Metric label="IDADE" value={ageAt(detail.birthDate, c.date)} />
          </div>
          <div className="attribute-grid">
            {Object.entries(detail.attributes).map(([k, v]) => (
              <div key={k}>
                <span>{attributeLabels[k]}</span>
                <strong>{v}</strong>
                <meter min={0} max={99} value={v} />
              </div>
            ))}
          </div>
          <div className="contract-info">
            <p>
              Salário mensal: <strong>{money(c.players[detail.id].wage)}</strong> · Contrato até{' '}
              <strong>{c.players[detail.id].contractEnd}</strong>
            </p>
            <p>
              Moral {Math.round(c.players[detail.id].morale)} · Relação{' '}
              {Math.round(c.players[detail.id].relationship)} · {c.players[detail.id].goals} gols ·{' '}
              {c.players[detail.id].minutes} minutos
            </p>
            <button className="primary" onClick={() => onRenew(detail.id)}>
              Renovar por 3 anos · Luvas{' '}
              {money(
                c.players[detail.id].wage * (c.difficulty === 'Profissional' ? 1.18 : 1.1) * 2,
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
