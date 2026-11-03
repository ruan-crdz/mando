import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronLeft,
  ClipboardList,
  Crown,
  Shield,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  UserX,
} from 'lucide-react';
import { available, bestLineup, squad } from '../game/matches';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { pitchCoordinates } from '../game/pitch';
import { setShirtNumber, shirtNumbers } from '../game/numbers';
import { renewalOptions, renewalTerms } from '../game/transfers';
import {
  formations,
  roleNames,
  type Career,
  type Formation,
  type Player,
  type Tactic,
  type World,
} from '../game/types';
import { dateLabel, Metric, Modal, money, SectionTitle } from '../components/ui';
import { ChipGroup, NumberStepper } from '../components/controls';
import { byPosition, PlayerCard, PlayerPicker, roleFits, shortName } from '../components/PlayerCard';

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

const roleScore: Record<string, (p: Player, c: Career) => number> = {
  Capitão: (p, c) =>
    overall(p) + Math.min(34, ageAt(p.birthDate, c.date)) * 0.8 + c.players[p.id].relationship * 0.2,
  'Vice-capitão': (p, c) =>
    overall(p) + Math.min(34, ageAt(p.birthDate, c.date)) * 0.8 + c.players[p.id].relationship * 0.2,
  Pênaltis: (p) => p.attributes.finishing + p.attributes.composure,
  'Faltas curtas': (p) => p.attributes.shortPass + p.attributes.vision + p.attributes.finishing * 0.5,
  'Faltas longas': (p) => p.attributes.longPass + p.attributes.vision,
  'Escanteio esquerdo': (p) =>
    p.attributes.longPass + p.attributes.vision + (p.foot === 'E' || p.foot === 'A' ? 8 : 0),
  'Escanteio direito': (p) =>
    p.attributes.longPass + p.attributes.vision + (p.foot === 'D' || p.foot === 'A' ? 8 : 0),
  'Lateral esquerdo': (p) => p.attributes.strength + p.attributes.longPass + (p.position === 'LB' ? 12 : 0),
  'Lateral direito': (p) => p.attributes.strength + p.attributes.longPass + (p.position === 'RB' ? 12 : 0),
};

type Picking = { kind: 'slot'; index: number } | { kind: 'role'; role: string } | null;

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
  onRenew: (id: string, months: number) => void;
  onError: (s: string) => void;
  detail: Player | null;
  setDetail: (p: Player | null) => void;
}) {
  const [view, setView] = useState<'lineup' | 'tactics' | 'roles'>('lineup');
  const [picking, setPicking] = useState<Picking>(null);
  const [months, setMonths] = useState(36);
  const [numberDraft, setNumberDraft] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const returnFocus = useRef<string | null>(null);
  const players = useMemo(() => squad(c, world), [c, world]);
  const numbers = useMemo(() => shirtNumbers(c, world), [c, world]);
  const rolePositions = formations[c.tactic.formation];
  const coordinates = pitchCoordinates(c.tactic.formation);
  const byId = (id: string) => world.players.find((p) => p.id === id)!;

  useEffect(() => {
    requestAnimationFrame(() => {
      if (picking)
        panel.current?.querySelector<HTMLElement>('.player-card:not(:disabled), .role-card')?.focus();
      else if (returnFocus.current)
        document.querySelector<HTMLElement>(returnFocus.current)?.focus();
      returnFocus.current = null;
    });
  }, [picking]);

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
    if (index === 0 && byId(id).position !== 'GK') {
      onError('A posição exige um goleiro.');
      return;
    }
    const lineup = [...c.lineup];
    const existing = lineup.indexOf(id);
    if (existing >= 0) lineup[existing] = lineup[index];
    lineup[index] = id;
    onChange({ ...c, lineup });
    returnFocus.current = `[data-slot="${index}"]`;
    setPicking(null);
  };
  const setRole = (role: string, id: string | null) => {
    const roles = { ...c.roles };
    if (id) roles[role] = id;
    else delete roles[role];
    onChange({ ...c, roles });
    returnFocus.current = `[data-role="${role}"]`;
    setPicking(null);
  };
  const openDetail = (p: Player) => {
    setMonths(36);
    setNumberDraft(null);
    setDetail(p);
  };

  const sortedRoster = [...players].sort(byPosition(c));
  let pickerContent = null;
  if (picking?.kind === 'slot') {
    const role = rolePositions[picking.index];
    const currentId = c.lineup[picking.index];
    const pool = players.filter((p) => p.id !== currentId && (picking.index !== 0 || p.position === 'GK'));
    const fit = roleFits[role] || [role];
    const recommended = pool
      .filter((p) => fit.includes(p.position) && available(c, p.id))
      .sort(
        (a, b) =>
          fit.indexOf(a.position) - fit.indexOf(b.position) ||
          overall(b, role, c.players[b.id]) - overall(a, role, c.players[a.id]),
      )
      .slice(0, 5);
    const others = pool.filter((p) => !recommended.includes(p)).sort(byPosition(c));
    const current = byId(currentId);
    pickerContent = (
      <>
        <div className="panel-heading picker-heading">
          <button className="text-button" data-back-action onClick={() => {
            returnFocus.current = `[data-slot="${picking.index}"]`;
            setPicking(null);
          }}>
            <ChevronLeft size={16} /> Cancelar
          </button>
          <h2>
            Trocar {role} · {shortName(current.name)}
          </h2>
          <span className="pill">OVR na função</span>
        </div>
        <PlayerPicker
          recommended={recommended}
          others={others}
          recommendedLabel={`Recomendados para ${role}`}
          othersLabel="Elenco por posição"
          render={(p) => {
            const starter = c.lineup.indexOf(p.id);
            return (
              <PlayerCard
                key={p.id}
                player={p}
                career={c}
                role={role}
                number={numbers[p.id]}
                disabled={!available(c, p.id)}
                note={starter >= 0 ? `Titular · ${rolePositions[starter]}` : 'Reserva'}
                onClick={() => changeSlot(picking.index, p.id)}
              />
            );
          }}
        />
      </>
    );
  } else if (picking?.kind === 'role') {
    const score = roleScore[picking.role];
    const pool = players.filter((p) => picking.role.startsWith('Capit') || picking.role.startsWith('Vice') || p.position !== 'GK');
    const recommended = [...pool].sort((a, b) => score(b, c) - score(a, c)).slice(0, 5);
    const others = players.filter((p) => !recommended.includes(p)).sort(byPosition(c));
    pickerContent = (
      <>
        <div className="panel-heading picker-heading">
          <button className="text-button" data-back-action onClick={() => {
            returnFocus.current = `[data-role="${picking.role}"]`;
            setPicking(null);
          }}>
            <ChevronLeft size={16} /> Cancelar
          </button>
          <h2>{picking.role}</h2>
          <span className="pill">Escolha o responsável</span>
        </div>
        <PlayerPicker
          recommended={recommended}
          others={others}
          recommendedLabel="Melhores para a função"
          othersLabel="Elenco por posição"
          extra={
            c.roles[picking.role] ? (
              <button type="button" className="player-card empty" onClick={() => setRole(picking.role, null)}>
                <UserX size={30} />
                <strong className="pc-name">Ninguém</strong>
                <span className="pc-meta">Remover</span>
              </button>
            ) : null
          }
          render={(p) => (
            <PlayerCard
              key={p.id}
              player={p}
              career={c}
              number={numbers[p.id]}
              active={c.roles[picking.role] === p.id}
              note={c.lineup.includes(p.id) ? 'Titular' : 'Reserva'}
              onClick={() => setRole(picking.role, p.id)}
            />
          )}
        />
      </>
    );
  }

  const d = detail && c.players[detail.id] ? detail : null;
  const ds = d ? c.players[d.id] : null;
  const terms = d ? renewalTerms(c, d.id, months) : null;
  const holder =
    d && numberDraft !== null
      ? Object.keys(numbers).find((id) => numbers[id] === numberDraft && id !== d.id)
      : undefined;

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
        <button
          className={view === 'lineup' ? 'active' : ''}
          onClick={() => {
            setView('lineup');
            setPicking(null);
          }}
        >
          <Shield size={16} /> Escalação
        </button>
        <button
          className={view === 'tactics' ? 'active' : ''}
          onClick={() => {
            setView('tactics');
            setPicking(null);
          }}
        >
          <SlidersHorizontal size={16} /> Tática
        </button>
        <button
          className={view === 'roles' ? 'active' : ''}
          onClick={() => {
            setView('roles');
            setPicking(null);
          }}
        >
          <ClipboardList size={16} /> Responsabilidades
        </button>
      </div>
      <div className="squad-layout">
        <section className="panel pitch-panel" data-focus-region="pitch">
          <div className="panel-heading">
            <h2>{c.tactic.formation}</h2>
            <span className="pill">{c.tactic.mentality}</span>
          </div>
          <div className="football-pitch">
            <div className="pitch-center" />
            <div className="penalty top" />
            <div className="penalty bottom" />
            {c.lineup.map((id, i) => {
              const p = byId(id);
              const s = c.players[id];
              const selected = picking?.kind === 'slot' && picking.index === i;
              return (
                <button
                  key={`${i}-${id}`}
                  data-slot={i}
                  className={`pitch-player ${!available(c, id) ? 'unavailable' : ''} ${selected ? 'selected' : ''}`}
                  style={{ left: `${coordinates[i].x}%`, top: `${coordinates[i].y}%` }}
                  onClick={() => {
                    setView('lineup');
                    setPicking(selected ? null : { kind: 'slot', index: i });
                  }}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.getData('text/plain');
                    if (players.some((p) => p.id === dropped)) changeSlot(i, dropped);
                  }}
                  aria-label={`${rolePositions[i]} ${p.name}, camisa ${numbers[id]}, overall ${overall(p, rolePositions[i], s)}. Trocar atleta`}
                >
                  <span className="shirt-number">{numbers[id]}</span>
                  <strong>{shortName(p.name)}</strong>
                  <small>
                    {rolePositions[i]} · <b>{overall(p, rolePositions[i], s)}</b>
                  </small>
                  <i className="pitch-fitness" style={{ width: `${Math.round(s.fitness)}%` }} />
                </button>
              );
            })}
          </div>
          <p className="muted small">
            Selecione uma posição: o painel ao lado mostra as opções recomendadas.
          </p>
        </section>
        <section ref={panel} className="panel squad-controls" data-focus-region="panel">
          {pickerContent ||
            (view === 'tactics' ? (
              <>
                <p className="eyebrow">IDENTIDADE EM CAMPO</p>
                <h2>Como vamos jogar?</h2>
                <div className="tactic-form">
                  <ChipGroup
                    label="Formação"
                    value={c.tactic.formation}
                    options={Object.keys(formations).map((f) => ({ value: f as Formation, label: f }))}
                    onChange={(formation) => updateTactic({ formation })}
                  />
                  <ChipGroup
                    label="Mentalidade"
                    value={c.tactic.mentality}
                    options={(['Defensiva', 'Equilibrada', 'Ofensiva'] as const).map((m) => ({
                      value: m,
                      label: m,
                    }))}
                    onChange={(mentality) => updateTactic({ mentality })}
                  />
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
                <div className="panel-heading">
                  <h2>Quem chama a responsabilidade?</h2>
                  <span>Liderança e bola parada</span>
                </div>
                <div className="role-grid">
                  {roleNames.map((role) => {
                    const p = c.roles[role] ? world.players.find((pl) => pl.id === c.roles[role]) : undefined;
                    const valid = p && c.players[p.id]?.clubId === c.clubId;
                    return (
                      <button
                        key={role}
                        type="button"
                        data-role={role}
                        className={`role-card ${valid ? '' : 'empty'}`}
                        onClick={() => setPicking({ kind: 'role', role })}
                      >
                        <span className="role-name">
                          {role.startsWith('Capit') ? <Crown size={16} /> : <Shirt size={16} />}
                          {role}
                        </span>
                        {valid ? (
                          <>
                            <span className="role-number">{numbers[p.id]}</span>
                            <strong>{shortName(p.name)}</strong>
                            <small>
                              {p.position} · OVR {overall(p, p.position, c.players[p.id])}
                            </small>
                          </>
                        ) : (
                          <>
                            <span className="role-number">?</span>
                            <strong>Não definido</strong>
                            <small>Escolher atleta</small>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="panel-heading">
                  <h2>Elenco principal</h2>
                  <span>{players.length} atletas · A abre a ficha</span>
                </div>
                <div className="card-scroll">
                  <div className="card-grid">
                    {sortedRoster.map((p) => (
                      <PlayerCard
                        key={p.id}
                        player={p}
                        career={c}
                        number={numbers[p.id]}
                        active={c.lineup.includes(p.id)}
                        note={
                          c.lineup.includes(p.id)
                            ? `Titular · ${ageAt(p.birthDate, c.date)}a`
                            : `${ageAt(p.birthDate, c.date)} anos`
                        }
                        onClick={() => openDetail(p)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ))}
        </section>
      </div>
      {d && ds && terms && (
        <Modal title={d.name} onClose={() => setDetail(null)} wide>
          <div className="player-detail">
            <div className="detail-side">
              <div className="detail-metrics">
                <Metric label="CAMISA" value={numbers[d.id] ?? '—'} />
                <Metric label="POSIÇÃO" value={d.position} />
                <Metric label="OVERALL" value={overall(d, d.position, ds)} />
                <Metric
                  label="POTENCIAL"
                  value={`${d.potential - d.uncertainty}–${Math.min(99, d.potential + d.uncertainty)}`}
                />
                <Metric label="IDADE" value={ageAt(d.birthDate, c.date)} />
              </div>
              <div className="contract-info">
                <p>
                  Salário: <strong>{money(ds.wage)}/mês</strong> · Contrato até{' '}
                  <strong>{dateLabel(ds.contractEnd)}</strong>
                </p>
                <p>
                  Moral {Math.round(ds.morale)} · Relação {Math.round(ds.relationship)} · {ds.goals}{' '}
                  gols · {ds.minutes} min
                </p>
              </div>
              {ds.clubId === c.clubId && (
                <>
                  <div className="detail-block">
                    <p className="eyebrow">NÚMERO DA CAMISA</p>
                    <div className="number-editor">
                      <NumberStepper
                        value={numberDraft ?? numbers[d.id] ?? 1}
                        min={1}
                        max={99}
                        step={1}
                        onChange={(n) => setNumberDraft(n)}
                      />
                      <button
                        disabled={numberDraft === null || numberDraft === numbers[d.id]}
                        onClick={() => {
                          try {
                            onChange(setShirtNumber(c, world, d.id, numberDraft!));
                            setNumberDraft(null);
                          } catch (e) {
                            onError(e instanceof Error ? e.message : String(e));
                          }
                        }}
                      >
                        <ArrowLeftRight size={15} /> Aplicar
                      </button>
                    </div>
                    {holder && (
                      <small className="muted">
                        Em uso por {byId(holder).name}: os dois trocam de número.
                      </small>
                    )}
                  </div>
                  <div className="detail-block">
                    <p className="eyebrow">RENOVAR CONTRATO · ESTENDER POR</p>
                    <ChipGroup
                      value={String(months)}
                      options={renewalOptions.map((m) => ({
                        value: String(m),
                        label: m < 12 ? '6 meses' : m === 12 ? '1 ano' : `${m / 12} anos`,
                      }))}
                      onChange={(m) => setMonths(Number(m))}
                    />
                    <div className="renewal-terms">
                      <span>
                        Novo salário <strong>{money(terms.wage)}/mês</strong>
                      </span>
                      <span>
                        Luvas <strong>{money(terms.bonus)}</strong>
                      </span>
                      <span>
                        Até <strong>{dateLabel(terms.contractEnd)}</strong>
                      </span>
                    </div>
                    <button className="primary" onClick={() => onRenew(d.id, months)}>
                      Renovar contrato
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="attribute-grid">
              {Object.entries(d.attributes).map(([k, v]) => (
                <div key={k} className={v >= 80 ? 'high' : v >= 65 ? 'mid' : 'low'}>
                  <span>
                    {attributeLabels[k]}: <strong>{v}</strong>
                  </span>
                  <i className="attr-bar">
                    <b style={{ width: `${v}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
