import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Hash,
  ClipboardList,
  Crown,
  Shield,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UserX,
} from 'lucide-react';
import { available, bestLineup, squad } from '../game/matches';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { pitchCoordinates } from '../game/pitch';
import { setShirtNumber, shirtNumbers } from '../game/numbers';
import { marketValue, releaseCost, renewalOptions, renewalTerms } from '../game/transfers';
import { useStickX } from '../controller/GamepadProvider';
import {
  LEARNED,
  TRAIN_CAP,
  familiarity,
  familiarityLabel,
  knownPositions,
  positionNames,
  setMainPosition,
  setTraining,
} from '../game/positions';
import { HeatMap } from '../components/HeatMap';
import { PlayerFace } from '../components/PlayerFace';
import {
  formations,
  positions,
  roleNames,
  type Career,
  type Formation,
  type Player,
  type Position,
  type Tactic,
  type World,
} from '../game/types';
import { dateLabel, Modal, money, SectionTitle } from '../components/ui';
import {
  ChipGroup,
  NumberStepper,
  OptionCycler,
  ShirtNumberDial,
  TacticSlider,
} from '../components/controls';
import {
  byPosition,
  PlayerCard,
  PlayerPicker,
  roleFits,
  shortName,
} from '../components/PlayerCard';

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
    overall(p) +
    Math.min(34, ageAt(p.birthDate, c.date)) * 0.8 +
    c.players[p.id].relationship * 0.2,
  'Vice-capitão': (p, c) =>
    overall(p) +
    Math.min(34, ageAt(p.birthDate, c.date)) * 0.8 +
    c.players[p.id].relationship * 0.2,
  Pênaltis: (p) => p.attributes.finishing + p.attributes.composure,
  'Faltas curtas': (p) =>
    p.attributes.shortPass + p.attributes.vision + p.attributes.finishing * 0.5,
  'Faltas longas': (p) => p.attributes.longPass + p.attributes.vision,
  'Escanteio esquerdo': (p) =>
    p.attributes.longPass + p.attributes.vision + (p.foot === 'E' || p.foot === 'A' ? 8 : 0),
  'Escanteio direito': (p) =>
    p.attributes.longPass + p.attributes.vision + (p.foot === 'D' || p.foot === 'A' ? 8 : 0),
  'Lateral esquerdo': (p) =>
    p.attributes.strength + p.attributes.longPass + (p.position === 'LB' ? 12 : 0),
  'Lateral direito': (p) =>
    p.attributes.strength + p.attributes.longPass + (p.position === 'RB' ? 12 : 0),
};

type Picking = { kind: 'slot'; index: number } | { kind: 'role'; role: string } | null;

type PlayerAction = 'summary' | 'number' | 'sale' | 'loan' | 'renew' | 'talk' | 'develop' | 'release';
const playerActions: { id: PlayerAction; label: string }[] = [
  { id: 'summary', label: 'Visão geral' },
  { id: 'number', label: 'Número da camisa' },
  { id: 'renew', label: 'Renovar contrato' },
  { id: 'sale', label: 'Lista de transferências' },
  { id: 'loan', label: 'Lista de empréstimos' },
  { id: 'talk', label: 'Conversar' },
  { id: 'develop', label: 'Evolução e função' },
  { id: 'release', label: 'Dispensar' },
];

export function Squad({
  career: c,
  world,
  onChange,
  onRenew,
  onConversation,
  onDevelopment,
  onRole,
  onSetClause,
  onLoanOut,
  onListForSale,
  onRelease,
  onError,
  detail,
  setDetail,
}: {
  career: Career;
  world: World;
  onChange: (c: Career) => void;
  onRenew: (id: string, months: number) => void;
  onConversation: (id: string, choice: 'praise' | 'challenge' | 'promise') => void;
  onDevelopment: (id: string, plan: NonNullable<Career['players'][string]['development']>) => void;
  onRole: (id: string, role: Career['players'][string]['role']) => void;
  onSetClause: (id: string, amount: number) => void;
  onLoanOut: (id: string, clubId: string) => void;
  onListForSale: (id: string, price: number | null) => void;
  onRelease: (id: string) => void;
  onError: (s: string) => void;
  detail: Player | null;
  setDetail: (p: Player | null) => void;
}) {
  const [view, setView] = useState<'lineup' | 'tactics' | 'roles' | 'kit'>('lineup');
  const [sortMode, setSortMode] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [kitId, setKitId] = useState<string | null>(null);
  const [kitPos, setKitPos] = useState<Position | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [months, setMonths] = useState(36);
  const [clauseValue, setClauseValue] = useState(0);
  const [action, setAction] = useState<PlayerAction>('summary');
  const panel = useRef<HTMLElement>(null);
  const returnFocus = useRef<string | null>(null);
  const players = useMemo(() => squad(c, world), [c, world]);
  const loanDestinations = world.clubs
    .filter((club) => club.id !== c.clubId)
    .map((club) => ({ club, count: squad(c, world, club.id).length }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 3);
  const numbers = useMemo(() => shirtNumbers(c, world), [c, world]);
  const rolePositions = formations[c.tactic.formation];
  const coordinates = pitchCoordinates(c.tactic.formation);
  const byId = (id: string) => world.players.find((p) => p.id === id)!;

  useEffect(() => {
    requestAnimationFrame(() => {
      // Ao escolher uma posição o foco fica no campinho: → vai às recomendações,
      // ou outro titular pode ser selecionado para trocar de posição.
      if (picking?.kind === 'role')
        panel.current
          ?.querySelector<HTMLElement>('.player-card:not(:disabled), .role-card')
          ?.focus();
      else if (!picking && returnFocus.current)
        document.querySelector<HTMLElement>(returnFocus.current)?.focus();
      if (!picking) returnFocus.current = null;
    });
  }, [picking]);
  useEffect(() => {
    requestAnimationFrame(() => {
      if (kitId) panel.current?.querySelector<HTMLElement>('.shirt-dial button')?.focus();
      else if (returnFocus.current) {
        document.querySelector<HTMLElement>(returnFocus.current)?.focus();
        returnFocus.current = null;
      }
    });
  }, [kitId]);

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
  const swapSlots = (from: number, to: number) => {
    const lineup = [...c.lineup];
    [lineup[from], lineup[to]] = [lineup[to], lineup[from]];
    if (byId(lineup[0]).position !== 'GK') {
      onError('A posição exige um goleiro.');
      return;
    }
    onChange({ ...c, lineup });
    returnFocus.current = `[data-slot="${to}"]`;
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
    setClauseValue(c.players[p.id]?.clause || Math.round(p.value * 2.5));
    setSalePrice(c.players[p.id]?.listed || Math.round(marketValue(c, p) / 50000) * 50000);
    setConfirmRelease(false);
    setAction('summary');
    setDetail(p);
  };
  const apply = (fn: () => Career) => {
    try {
      onChange(fn());
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const numberConflict = (playerId: string) => (n: number) => {
    const holder = Object.keys(numbers).find((id) => numbers[id] === n && id !== playerId);
    return holder ? `Em uso por ${shortName(byId(holder).name)}: os dois trocam` : undefined;
  };
  const positionsLine = (p: Player) =>
    knownPositions(p, c.players[p.id])
      .sort((a, b) => (a === p.position ? -1 : b === p.position ? 1 : 0))
      .join(' · ');

  const sortedRoster = [...players].sort(byPosition(c));
  const sortModes = [
    { label: 'OVERALL', fn: (a: Player, b: Player) => overall(b, b.position, c.players[b.id]) - overall(a, a.position, c.players[a.id]) },
    { label: 'POSIÇÃO', fn: byPosition(c) },
    { label: 'IDADE', fn: (a: Player, b: Player) => ageAt(a.birthDate, c.date) - ageAt(b.birthDate, c.date) },
    { label: 'VALOR', fn: (a: Player, b: Player) => marketValue(c, b) - marketValue(c, a) },
    { label: 'CONTRATO', fn: (a: Player, b: Player) => c.players[a.id].contractEnd.localeCompare(c.players[b.id].contractEnd) },
  ];
  const mode = sortModes[sortMode % sortModes.length];
  const listRoster = [...players].sort(mode.fn);
  const cycleSort = (dir: number) =>
    setSortMode((m) => (m + dir + sortModes.length) % sortModes.length);
  useStickX(cycleSort, view === 'kit' && !kitId && !detail);
  let pickerContent = null;
  if (picking?.kind === 'slot') {
    const role = rolePositions[picking.index];
    const currentId = c.lineup[picking.index];
    const pool = players.filter(
      (p) => p.id !== currentId && (picking.index !== 0 || p.position === 'GK'),
    );
    const fit = roleFits[role] || [role];
    // Recomendados: quem é da posição ou já é apto nela (secundária/treinada), pelo OVR na função.
    const recommended = pool
      .filter(
        (p) =>
          available(c, p.id) &&
          (fit[0] === p.position || familiarity(p, role, c.players[p.id]) >= LEARNED),
      )
      .sort((a, b) => overall(b, role, c.players[b.id]) - overall(a, role, c.players[a.id]))
      .slice(0, 5);
    if (recommended.length < 5)
      recommended.push(
        ...pool
          .filter((p) => !recommended.includes(p) && fit.includes(p.position) && available(c, p.id))
          .sort((a, b) => overall(b, role, c.players[b.id]) - overall(a, role, c.players[a.id]))
          .slice(0, 5 - recommended.length),
      );
    const others = pool.filter((p) => !recommended.includes(p)).sort(byPosition(c));
    const current = byId(currentId);
    pickerContent = (
      <>
        <div className="panel-heading picker-heading">
          <button
            className="text-button"
            data-back-action
            onClick={() => {
              returnFocus.current = `[data-slot="${picking.index}"]`;
              setPicking(null);
            }}
          >
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
    const pool = players.filter(
      (p) =>
        picking.role.startsWith('Capit') || picking.role.startsWith('Vice') || p.position !== 'GK',
    );
    const recommended = [...pool].sort((a, b) => score(b, c) - score(a, c)).slice(0, 5);
    const others = players.filter((p) => !recommended.includes(p)).sort(byPosition(c));
    pickerContent = (
      <>
        <div className="panel-heading picker-heading">
          <button
            className="text-button"
            data-back-action
            onClick={() => {
              returnFocus.current = `[data-role="${picking.role}"]`;
              setPicking(null);
            }}
          >
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
              <button
                type="button"
                className="player-card empty"
                onClick={() => setRole(picking.role, null)}
              >
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
  const kit = kitId && c.players[kitId]?.clubId === c.clubId ? byId(kitId) : null;
  const ks = kit ? c.players[kit.id] : null;
  const kitRole = kitPos ?? kit?.position ?? 'ST';
  const closeKit = () => {
    if (kitId) returnFocus.current = `[data-player="${kitId}"]`;
    setKitId(null);
    setKitPos(null);
  };

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
        <button
          className={view === 'kit' ? 'active' : ''}
          onClick={() => {
            setView('kit');
            setPicking(null);
            setKitId(null);
          }}
        >
          <Hash size={16} /> Jogadores
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
              const fam = familiarity(p, rolePositions[i], s);
              const swapping = picking?.kind === 'slot' && !selected;
              return (
                <button
                  key={`${i}-${id}`}
                  data-slot={i}
                  className={`pitch-player ${!available(c, id) ? 'unavailable' : ''} ${selected ? 'selected' : ''} ${swapping ? 'swap-target' : ''} ${fam < LEARNED ? 'out-of-position' : ''}`}
                  style={{ left: `${coordinates[i].x}%`, top: `${coordinates[i].y}%` }}
                  onClick={() => {
                    setView('lineup');
                    if (picking?.kind === 'slot' && !selected) swapSlots(picking.index, i);
                    else {
                      returnFocus.current = `[data-slot="${i}"]`;
                      setPicking(selected ? null : { kind: 'slot', index: i });
                    }
                  }}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.getData('text/plain');
                    if (players.some((p) => p.id === dropped)) changeSlot(i, dropped);
                  }}
                  aria-label={`${rolePositions[i]} ${p.name}, camisa ${numbers[id]}, overall ${overall(p, rolePositions[i], s)}${fam < LEARNED ? `, improvisado (${familiarityLabel(fam).toLowerCase()})` : ''}. Trocar atleta`}
                >
                  <PlayerFace player={p} size="md" className="pitch-face" />
                  <span className="pitch-ovr">
                    <b>{overall(p, rolePositions[i], s)}</b>
                    {rolePositions[i]}
                  </span>
                  <strong>
                    {fam < LEARNED && <TriangleAlert size={11} className="oop-icon" />}
                    {shortName(p.name)}
                  </strong>
                  <i className="pitch-fitness" style={{ width: `${Math.round(s.fitness)}%` }} />
                </button>
              );
            })}
          </div>
          <p className="muted small">
            {picking?.kind === 'slot'
              ? `Escolha outro titular para trocar de posição com ${shortName(byId(c.lineup[picking.index]).name)}, ou vá → para as recomendações.`
              : 'Selecione uma posição: o painel ao lado mostra as opções recomendadas.'}
          </p>
        </section>
        <section ref={panel} className="panel squad-controls" data-focus-region="panel">
          {pickerContent ||
            (view === 'kit' ? (
              kit && ks ? (
                <>
                  <div className="panel-heading picker-heading">
                    <button className="text-button" data-back-action onClick={closeKit}>
                      <ChevronLeft size={16} /> Elenco
                    </button>
                    <h2>{kit.name}</h2>
                    <span className="pill">{positionsLine(kit)}</span>
                  </div>
                  <div className="kit-editor">
                    <div className="kit-side">
                      <ShirtNumberDial
                        value={numbers[kit.id] ?? 1}
                        conflict={numberConflict(kit.id)}
                        onSave={(n) => apply(() => setShirtNumber(c, world, kit.id, n))}
                      />
                      <HeatMap player={kit} position={kitRole} state={ks} />
                    </div>
                    <div className="kit-main">
                      <p className="eyebrow">POSIÇÕES · ESCOLHA UMA PARA VER O MAPA DE CALOR</p>
                      <div className="position-grid">
                        {positions.map((pos) => {
                          const f = familiarity(kit, pos, ks);
                          return (
                            <button
                              key={pos}
                              type="button"
                              className={`position-chip ${pos === kitRole ? 'active' : ''} ${f >= 100 ? 'main' : f >= LEARNED ? 'known' : f >= 60 ? 'ok' : 'bad'} ${ks.training === pos ? 'training' : ''}`}
                              aria-pressed={pos === kitRole}
                              aria-label={`${positionNames[pos]}: ${familiarityLabel(f)}, ${Math.round(f)}%, overall ${overall(kit, pos, ks)}`}
                              onClick={() => setKitPos(pos)}
                            >
                              <strong>{pos}</strong>
                              <span>{overall(kit, pos, ks)}</span>
                              <i>
                                <b style={{ width: `${f}%` }} />
                              </i>
                              {ks.training === pos && <Dumbbell size={12} className="chip-train" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="kit-status">
                        <strong>{positionNames[kitRole]}</strong>
                        <span>
                          {familiarityLabel(familiarity(kit, kitRole, ks))} ·{' '}
                          {Math.round(familiarity(kit, kitRole, ks))}% · OVR{' '}
                          {overall(kit, kitRole, ks)}
                        </span>
                        {ks.training && (
                          <small>
                            Treinando {positionNames[ks.training].toLowerCase()} ·{' '}
                            {Math.round(familiarity(kit, ks.training, ks))}% (apto a partir de{' '}
                            {LEARNED}%)
                          </small>
                        )}
                      </div>
                      <div className="kit-actions">
                        {ks.training === kitRole ? (
                          <button onClick={() => apply(() => setTraining(c, kit, null))}>
                            <Dumbbell size={16} /> Parar treino
                          </button>
                        ) : (
                          <button
                            disabled={
                              kitRole === kit.position ||
                              familiarity(kit, kitRole, ks) >= TRAIN_CAP ||
                              (kitRole === 'GK') !== (kit.position === 'GK')
                            }
                            onClick={() => apply(() => setTraining(c, kit, kitRole))}
                          >
                            <Dumbbell size={16} /> Treinar como {kitRole}
                          </button>
                        )}
                        <button
                          className="primary"
                          disabled={
                            kitRole === kit.position || familiarity(kit, kitRole, ks) < LEARNED
                          }
                          onClick={() => apply(() => setMainPosition(c, kit, kitRole))}
                        >
                          <Crown size={16} /> Tornar posição principal
                        </button>
                      </div>
                      <p className="muted small">
                        O treino evolui um pouco por dia (mais rápido em jovens). Fora de posição o
                        OVR cai e o mapa de calor se espalha.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="panel-heading">
                    <h2>Jogadores</h2>
                    <button
                      type="button"
                      className="sort-pill"
                      onClick={() => cycleSort(1)}
                      aria-label={`Ordenando por ${mode.label.toLowerCase()}. Trocar ordenação`}
                    >
                      ◀ ▶ Ordenando por <strong>{mode.label}</strong>
                    </button>
                  </div>
                  <div className="card-scroll">
                    <div className="roster-list">
                      {listRoster.map((p) => {
                        const s = c.players[p.id];
                        return (
                          <button
                            type="button"
                            key={p.id}
                            data-player={p.id}
                            className={`market-row roster-row ${c.lineup.includes(p.id) ? 'starter' : ''}`}
                            onClick={() => openDetail(p)}
                          >
                            <span>
                              <span className="position-tag">{s.position ?? p.position}</span>
                              <PlayerFace player={p} size="md" />
                              <span>
                                <strong>{p.name}</strong>
                                <small>
                                  {ageAt(p.birthDate, c.date)} anos · {money(s.wage)}/mês · até{' '}
                                  {s.contractEnd.slice(0, 4)}
                                  {s.listed ? ' · À VENDA' : ''}
                                  {s.injuryDays ? ' · Lesionado' : ''}
                                </small>
                              </span>
                            </span>
                            <b className="roster-ovr">{overall(p, p.position, s)}</b>
                            <strong>{money(marketValue(c, p))}</strong>
                            <span>{c.lineup.includes(p.id) ? 'Titular' : 'Reserva'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )
            ) : view === 'tactics' ? (
              <>
                <p className="eyebrow">IDENTIDADE EM CAMPO</p>
                <h2>Como vamos jogar?</h2>
                <div className="tactic-form">
                  <ChipGroup
                    label="Formação"
                    value={c.tactic.formation}
                    options={Object.keys(formations).map((f) => ({
                      value: f as Formation,
                      label: f,
                    }))}
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
                    <TacticSlider
                      key={key}
                      label={label}
                      value={c.tactic[key]}
                      onChange={(v) => updateTactic({ [key]: v })}
                    />
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
                    const p = c.roles[role]
                      ? world.players.find((pl) => pl.id === c.roles[role])
                      : undefined;
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
          <div className="player-hub">
            <div className="hub-card-col">
              <div className="hub-card">
                <span className="hub-card-top">
                  <strong>{overall(d, d.position, ds)}</strong>
                  <span>{d.position}</span>
                </span>
                <PlayerFace player={d} className="hub-card-face" />
                <strong className="hub-card-name">{shortName(d.name)}</strong>
              </div>
              <div className="hub-facts">
                <span>
                  Idade <strong>{ageAt(d.birthDate, c.date)}</strong>
                </span>
                <span>
                  Camisa <strong>{numbers[d.id] ?? '—'}</strong>
                </span>
                <span>
                  Potencial{' '}
                  <strong>
                    {Math.max(1, Math.round(d.potential + ds.potentialDelta - d.uncertainty))}–
                    {Math.min(99, Math.round(d.potential + ds.potentialDelta + d.uncertainty))}
                  </strong>
                </span>
                <span>
                  Moral <strong>{Math.round(ds.morale)}</strong>
                </span>
                <span>
                  Salário <strong>{money(ds.wage)}</strong>
                </span>
                <span>
                  Contrato <strong>{dateLabel(ds.contractEnd)}</strong>
                </span>
              </div>
              {ds.listed ? <p className="pill hub-flag">À VENDA · {money(ds.listed)}</p> : null}
            </div>
            <nav className="hub-actions" aria-label="Ações do jogador">
              {playerActions
                .filter((a) => a.id === 'summary' || ds.clubId === c.clubId)
                .map((a) => (
                  <button
                    key={a.id}
                    className={`hub-action ${action === a.id ? 'active' : ''} ${a.id === 'release' ? 'danger-text' : ''}`}
                    aria-pressed={action === a.id}
                    data-autofocus={action === a.id || undefined}
                    onClick={() => {
                      setAction(a.id);
                      setConfirmRelease(false);
                    }}
                  >
                    {a.label}
                    <ChevronRight size={16} />
                  </button>
                ))}
            </nav>
            <div className="hub-panel">
              {action === 'summary' && (
                <>
                  <p className="eyebrow">
                    {positionsLine(d) || d.position} · RITMO {Math.round(ds.sharpness)}% ·{' '}
                    {ds.goals} GOLS · {ds.minutes} MIN
                  </p>
                  <div className="hub-summary">
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
                    <HeatMap player={d} position={d.position} state={ds} compact />
                  </div>
                </>
              )}
              {action === 'number' && (
                <>
                  <p className="eyebrow">
                    NÚMERO DA CAMISA · ATUAL {numbers[d.id] ?? '—'}
                  </p>
                  <p className="muted small">
                    Escolha um número livre ou um ocupado para trocar com o companheiro.
                  </p>
                  <div className="number-grid" role="listbox" aria-label="Números da camisa">
                    {Array.from({ length: 99 }, (_, i) => i + 1).map((n) => {
                      const holder = Object.keys(numbers).find((id) => numbers[id] === n);
                      const mine = holder === d.id;
                      const holderPlayer = holder && !mine ? byId(holder) : null;
                      return (
                        <button
                          key={n}
                          role="option"
                          aria-selected={mine}
                          className={`number-cell ${mine ? 'mine' : holderPlayer ? 'taken' : ''}`}
                          title={holderPlayer ? `Trocar com ${holderPlayer.name}` : `Usar a ${n}`}
                          onClick={() => !mine && apply(() => setShirtNumber(c, world, d.id, n))}
                        >
                          <strong>{n}</strong>
                          {holderPlayer && <small>{shortName(holderPlayer.name)}</small>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {action === 'sale' && (
                <>
                  <p className="eyebrow">
                    LISTA DE TRANSFERÊNCIAS{ds.listed ? ` · À VENDA POR ${money(ds.listed)}` : ''}
                  </p>
                  <p className="muted small">
                    Valor de mercado estimado: <strong>{money(marketValue(c, d))}</strong>. Com o
                    atleta listado, clubes da IA enviam propostas que você negocia em Transferências ›
                    Negociações.
                  </p>
                  <NumberStepper
                    label="Preço pedido"
                    value={salePrice}
                    min={50000}
                    step={250000}
                    onChange={(value) => setSalePrice(value ?? 0)}
                    format={money}
                  />
                  <div className="button-row">
                    <button className="primary" onClick={() => onListForSale(d.id, salePrice)}>
                      {ds.listed ? 'Atualizar preço' : 'Colocar à venda'}
                    </button>
                    {ds.listed ? (
                      <button onClick={() => onListForSale(d.id, null)}>Tirar da lista</button>
                    ) : null}
                  </div>
                  <p className="eyebrow">MULTA RESCISÓRIA</p>
                  <NumberStepper
                    label="Valor da multa"
                    value={clauseValue}
                    min={0}
                    step={100000}
                    onChange={(value) => setClauseValue(value ?? 0)}
                    format={money}
                  />
                  <button onClick={() => onSetClause(d.id, clauseValue)}>Definir multa</button>
                </>
              )}
              {action === 'loan' && (
                <>
                  <p className="eyebrow">LISTA DE EMPRÉSTIMOS · 6 MESES</p>
                  <p className="muted small">
                    O clube de destino paga o salário e o atleta ganha ritmo de jogo.
                  </p>
                  <div className="hub-list">
                    {loanDestinations.map(({ club }) => (
                      <button key={club.id} onClick={() => onLoanOut(d.id, club.id)}>
                        <strong>{club.short}</strong> {club.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {action === 'renew' && (
                <>
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
                </>
              )}
              {action === 'talk' && (
                <>
                  <p className="eyebrow">
                    CONVERSA · {ds.personality.toUpperCase()} · RELAÇÃO {Math.round(ds.relationship)}
                  </p>
                  <div className="hub-list">
                    <button onClick={() => onConversation(d.id, 'praise')}>
                      <strong>Elogiar</strong> Reconhece o bom momento e aumenta a moral.
                    </button>
                    <button onClick={() => onConversation(d.id, 'challenge')}>
                      <strong>Cobrar</strong> Exige mais rendimento; a reação depende da personalidade.
                    </button>
                    <button onClick={() => onConversation(d.id, 'promise')}>
                      <strong>Prometer minutos</strong> Garante oportunidades nos próximos 30 dias.
                    </button>
                  </div>
                </>
              )}
              {action === 'develop' && (
                <>
                  <p className="eyebrow">PLANO DE EVOLUÇÃO</p>
                  <ChipGroup
                    value={ds.development}
                    options={(['Equilibrado', 'Ataque', 'Criação', 'Defesa', 'Físico'] as const).map(
                      (plan) => ({ value: plan, label: plan }),
                    )}
                    onChange={(plan) => onDevelopment(d.id, plan as typeof ds.development)}
                  />
                  <OptionCycler
                    label="Função em campo"
                    value={ds.role}
                    options={(
                      [
                        'Padrão',
                        'Finalizador',
                        'Armador',
                        'Pivô',
                        'Volante',
                        'Zagueiro construtor',
                        'Lateral ofensivo',
                      ] as const
                    ).map((role) => ({ value: role, label: role }))}
                    onChange={(role) => onRole(d.id, role)}
                  />
                  <p className="muted small">
                    O plano acelera a evolução individual. Ritmo de jogo, moral e minutos também
                    influenciam o rendimento e o potencial.
                  </p>
                  <button
                    onClick={() => {
                      setDetail(null);
                      setView('kit');
                      setKitId(d.id);
                      setKitPos(d.position);
                    }}
                  >
                    <Dumbbell size={16} /> Posições e treino de posição
                  </button>
                </>
              )}
              {action === 'release' && (
                <>
                  <p className="eyebrow">DISPENSAR JOGADOR</p>
                  <p className="muted small">
                    A rescisão custa metade dos salários restantes do contrato (mínimo de 3
                    salários). O atleta sai do elenco imediatamente.
                  </p>
                  {confirmRelease ? (
                    <div className="button-row">
                      <button className="danger" onClick={() => onRelease(d.id)}>
                        Confirmar rescisão · {money(releaseCost(c, d.id))}
                      </button>
                      <button onClick={() => setConfirmRelease(false)}>Cancelar</button>
                    </div>
                  ) : (
                    <button className="danger" onClick={() => setConfirmRelease(true)}>
                      <UserX size={16} /> Dispensar · multa {money(releaseCost(c, d.id))}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
