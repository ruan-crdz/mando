import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
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
import { clubById } from '../game/npc';
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
import { cardTier } from '../components/cardTier';
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
import { dateLabel, money, SectionTitle, thresholdPercent } from '../components/ui';
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

type PlayerAction =
  'summary' | 'swap' | 'number' | 'sale' | 'loan' | 'renew' | 'talk' | 'develop' | 'release';
const playerActions: { id: PlayerAction; label: string }[] = [
  { id: 'summary', label: 'Visão geral' },
  { id: 'swap', label: 'Trocar' },
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
  const [focusId, setFocusId] = useState<string | null>(null);
  const lastDetail = useRef<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const returnFocus = useRef<string | null>(null);
  const players = useMemo(() => squad(c, world), [c, world]);
  const club = clubById(world, c.clubId);
  const loanDestinations = world.clubs
    .filter((club) => club.id !== c.clubId)
    .map((club) => ({ club, count: squad(c, world, club.id).length }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 3);
  const numbers = useMemo(() => shirtNumbers(c, world), [c, world]);
  const rolePositions = formations[c.tactic.formation];
  const coordinates = pitchCoordinates(c.tactic.formation);
  const byId = (id: string) => world.players.find((p) => p.id === id)!;
  const availability = (p: Player) => {
    const state = c.players[p.id];
    if (state.injuryDays) return `Lesão · ${state.injuryDays}d`;
    if (state.suspension) return `Suspenso · ${state.suspension}j`;
    if (state.fitness < 30) return 'Condição insuficiente';
    return 'Disponível';
  };

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
  useEffect(() => {
    const id = detail?.id ?? lastDetail.current;
    lastDetail.current = detail?.id ?? null;
    if (!id) return;
    requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`.roster-row[data-player="${id}"]`);
      if (!row) return;
      if (
        !row.contains(document.activeElement) &&
        !row.parentElement?.contains(document.activeElement)
      )
        row.focus();
      row.scrollIntoView({ block: 'nearest' });
    });
  }, [detail]);

  const updateTactic = (change: Partial<Tactic>) => {
    const next = { ...c, tactic: { ...c.tactic, ...change } };
    if (change.formation && change.formation !== c.tactic.formation)
      next.lineup = bestLineup(next, world);
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
    if (existing >= 0 && !available(c, lineup[index])) {
      onError('Substitua o atleta indisponível por um reserva disponível.');
      return;
    }
    if (existing >= 0) lineup[existing] = lineup[index];
    lineup[index] = id;
    if (byId(lineup[0]).position !== 'GK') {
      onError('A posição exige um goleiro.');
      return;
    }
    onChange({ ...c, lineup });
    returnFocus.current = `[data-slot="${index}"]`;
    setPicking(null);
  };
  const swapSlots = (from: number, to: number) => {
    const lineup = [...c.lineup];
    if (!available(c, lineup[from]) || !available(c, lineup[to])) {
      onError('Atletas indisponíveis devem ser substituídos por reservas disponíveis.');
      return;
    }
    [lineup[from], lineup[to]] = [lineup[to], lineup[from]];
    if (byId(lineup[0]).position !== 'GK') {
      onError('A posição exige um goleiro.');
      return;
    }
    onChange({ ...c, lineup });
    returnFocus.current = `[data-slot="${to}"]`;
    setPicking(null);
  };
  /** Troca dois atletas: posições entre titulares, ou titular ↔ reserva. */
  const swapPlayers = (a: string, b: string) => {
    const lineup = [...c.lineup];
    const ia = lineup.indexOf(a);
    const ib = lineup.indexOf(b);
    if (ia < 0 && ib < 0) return;
    if (ia >= 0 && ib >= 0 && (!available(c, a) || !available(c, b))) {
      onError('Atletas indisponíveis devem ser substituídos por reservas disponíveis.');
      return;
    }
    const incoming = ia < 0 ? a : ib < 0 ? b : null;
    if (incoming && !available(c, incoming)) {
      onError('Atleta indisponível.');
      return;
    }
    if (ia >= 0) lineup[ia] = b;
    if (ib >= 0) lineup[ib] = a;
    if (byId(lineup[0]).position !== 'GK') {
      onError('A posição exige um goleiro.');
      return;
    }
    onChange({ ...c, lineup });
    returnFocus.current = `[data-player="${a}"]`;
    setAction('summary');
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
    setView('kit');
    setPicking(null);
    setKitId(null);
    setFocusId(p.id);
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

  const sortModes = [
    {
      label: 'OVERALL',
      fn: (a: Player, b: Player) =>
        overall(b, b.position, c.players[b.id]) - overall(a, a.position, c.players[a.id]),
    },
    { label: 'POSIÇÃO', fn: byPosition(c) },
    {
      label: 'IDADE',
      fn: (a: Player, b: Player) => ageAt(a.birthDate, c.date) - ageAt(b.birthDate, c.date),
    },
    { label: 'VALOR', fn: (a: Player, b: Player) => marketValue(c, b) - marketValue(c, a) },
    {
      label: 'CONTRATO',
      fn: (a: Player, b: Player) =>
        c.players[a.id].contractEnd.localeCompare(c.players[b.id].contractEnd),
    },
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
    const current = byId(currentId);
    const pool = players.filter(
      (p) => p.id !== currentId && (picking.index !== 0 || p.position === 'GK'),
    );
    const goalkeeperWouldLeaveGoal = (p: Player) =>
      p.id === c.lineup[0] && picking.index !== 0 && current.position !== 'GK';
    const canSelect = (p: Player) =>
      available(c, p.id) &&
      (!c.lineup.includes(p.id) || available(c, currentId)) &&
      !goalkeeperWouldLeaveGoal(p);
    const fit = roleFits[role] || [role];
    // Recomendados: quem é da posição ou já é apto nela (secundária/treinada), pelo OVR na função.
    const recommended = pool
      .filter(
        (p) =>
          canSelect(p) &&
          (fit[0] === p.position || familiarity(p, role, c.players[p.id]) >= LEARNED),
      )
      .sort((a, b) => overall(b, role, c.players[b.id]) - overall(a, role, c.players[a.id]))
      .slice(0, 5);
    if (recommended.length < 5)
      recommended.push(
        ...pool
          .filter((p) => !recommended.includes(p) && fit.includes(p.position) && canSelect(p))
          .sort((a, b) => overall(b, role, c.players[b.id]) - overall(a, role, c.players[a.id]))
          .slice(0, 5 - recommended.length),
      );
    const others = pool.filter((p) => !recommended.includes(p)).sort(byPosition(c));
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
        {!pool.some(canSelect) && (
          <p className="squad-empty">Não há atletas disponíveis para esta troca.</p>
        )}
        <PlayerPicker
          recommended={recommended}
          others={others}
          recommendedLabel={`Recomendados para ${role}`}
          othersLabel="Elenco por posição"
          render={(p) => {
            const starter = c.lineup.indexOf(p.id);
            const state = c.players[p.id];
            const fit = familiarity(p, role, state);
            const reason =
              starter >= 0 && !available(c, currentId)
                ? ' · substitua por um reserva'
                : goalkeeperWouldLeaveGoal(p)
                  ? ' · titular precisa permanecer no gol'
                  : '';
            const condition = `${availability(p)} · condição ${thresholdPercent(state.fitness)}% · ${familiarityLabel(fit)} ${thresholdPercent(fit)}%${reason}`;
            return (
              <div className="squad-candidate" key={p.id}>
                <PlayerCard
                  player={p}
                  career={c}
                  role={role}
                  number={numbers[p.id]}
                  disabled={!canSelect(p)}
                  accessibilityNote={`${starter >= 0 ? `Titular ${rolePositions[starter]}` : 'Reserva'}, ${condition}`}
                  onClick={() => changeSlot(picking.index, p.id)}
                />
                <span className={`squad-candidate-meta ${canSelect(p) ? '' : 'unavailable'}`}>
                  <b>{starter >= 0 ? `Titular · ${rolePositions[starter]}` : 'Reserva'}</b>
                  {condition}
                </span>
              </div>
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
    const others = pool.filter((p) => !recommended.includes(p)).sort(byPosition(c));
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
        {!pool.length && <p className="squad-empty">Não há atletas elegíveis para esta função.</p>}
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
          render={(p) => {
            const status = `${c.lineup.includes(p.id) ? 'Titular' : 'Reserva'} · índice ${Math.round(score(p, c))} · ${availability(p)} · condição ${thresholdPercent(c.players[p.id].fitness)}%`;
            return (
              <div className="squad-candidate" key={p.id}>
                <PlayerCard
                  player={p}
                  career={c}
                  number={numbers[p.id]}
                  active={c.roles[picking.role] === p.id}
                  accessibilityNote={status}
                  onClick={() => setRole(picking.role, p.id)}
                />
                <span className="squad-candidate-meta">{status}</span>
              </div>
            );
          }}
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

  const kitEditor =
    kit && ks ? (
      <div className="kit-inline">
        <div className="panel-heading picker-heading">
          <div>
            <p className="eyebrow">POSIÇÕES E TREINO</p>
            <h3>{kit.name}</h3>
          </div>
          <button type="button" className="text-button" data-back-action onClick={closeKit}>
            <ChevronLeft size={16} /> Fechar editor
          </button>
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
            <p className="eyebrow">ESCOLHA UMA POSIÇÃO PARA VER O MAPA DE CALOR</p>
            <div className="position-grid">
              {positions.map((pos) => {
                const f = familiarity(kit, pos, ks);
                return (
                  <button
                    key={pos}
                    type="button"
                    className={`position-chip ${pos === kitRole ? 'active' : ''} ${f >= 100 ? 'main' : f >= LEARNED ? 'known' : f >= 60 ? 'ok' : 'bad'} ${ks.training === pos ? 'training' : ''}`}
                    aria-pressed={pos === kitRole}
                    aria-label={`${positionNames[pos]}: ${familiarityLabel(f)}, ${thresholdPercent(f)}%, overall ${overall(kit, pos, ks)}`}
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
                {thresholdPercent(familiarity(kit, kitRole, ks))}% · OVR {overall(kit, kitRole, ks)}
              </span>
              {ks.training && (
                <small>
                  Treinando {positionNames[ks.training].toLowerCase()} ·{' '}
                  {thresholdPercent(familiarity(kit, ks.training, ks))}% (apto a partir de {LEARNED}%)
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
                disabled={kitRole === kit.position || familiarity(kit, kitRole, ks) < LEARNED}
                onClick={() => apply(() => setMainPosition(c, kit, kitRole))}
              >
                <Crown size={16} /> Tornar posição principal
              </button>
            </div>
            <p className="muted small">
              O treino evolui um pouco por dia (mais rápido em jovens). Fora de posição o OVR cai e
              o mapa de calor se espalha.
            </p>
          </div>
        </div>
      </div>
    ) : null;

  const actionPanel =
    d && ds && terms ? (
      <div className="hub-panel">
        {action === 'swap' && (
          <>
            <p className="eyebrow">
              TROCAR {shortName(d.name).toUpperCase()} ·{' '}
              {c.lineup.includes(d.id)
                ? `TITULAR NA POSIÇÃO ${rolePositions[c.lineup.indexOf(d.id)]}`
                : 'RESERVA'}
            </p>
            <p className="muted small">
              {c.lineup.includes(d.id)
                ? 'Escolha um titular para trocar de posição ou um reserva para entrar no lugar dele.'
                : 'Escolha o titular que vai sair para ele entrar.'}
            </p>
            <div className="hub-list">
              {players
                .filter(
                  (p) => p.id !== d.id && (c.lineup.includes(d.id) || c.lineup.includes(p.id)),
                )
                .sort(
                  (a, b) =>
                    Number(c.lineup.includes(b.id)) - Number(c.lineup.includes(a.id)) ||
                    overall(b, b.position, c.players[b.id]) -
                      overall(a, a.position, c.players[a.id]),
                )
                .map((p) => {
                  const slot = c.lineup.indexOf(p.id);
                  const sourceSlot = c.lineup.indexOf(d.id);
                  const incoming = sourceSlot < 0 ? d.id : slot < 0 ? p.id : null;
                  const unavailable = incoming
                    ? !available(c, incoming)
                    : !available(c, d.id) || !available(c, p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={unavailable}
                      onClick={() => swapPlayers(d.id, p.id)}
                    >
                      <strong>{slot >= 0 ? rolePositions[slot] : 'RES'}</strong>
                      <PlayerFace player={p} size="sm" />
                      {p.name} · {p.position} · {overall(p, p.position, c.players[p.id])}
                      {unavailable ? ' · troca indisponível' : ''}
                    </button>
                  );
                })}
            </div>
          </>
        )}
        {action === 'number' && (
          <>
            <p className="eyebrow">NÚMERO DA CAMISA · ATUAL {numbers[d.id] ?? '—'}</p>
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
              Valor de mercado estimado: <strong>{money(marketValue(c, d))}</strong>. Com o atleta
              listado, clubes da IA enviam propostas que você negocia em Transferências ›
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
                setAction('summary');
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
              A rescisão custa metade dos salários restantes do contrato (mínimo de 3 salários). O
              atleta sai do elenco imediatamente.
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
    ) : null;
  const fp =
    kit ??
    (focusId && c.players[focusId]?.clubId === c.clubId ? byId(focusId) : null) ??
    d ??
    listRoster[0];
  const fs = fp ? c.players[fp.id] : null;
  const starters = c.lineup.map((id, index) => {
    const player = byId(id);
    const state = c.players[id];
    const role = rolePositions[index];
    return {
      player,
      state,
      role,
      ovr: overall(player, role, state),
      fit: familiarity(player, role, state),
    };
  });
  const averageFitness = Math.round(
    starters.reduce((total, starter) => total + starter.state.fitness, 0) / starters.length,
  );
  const unavailableStarters = starters.filter(({ player }) => !available(c, player.id)).length;
  const statsPanel =
    fp && fs ? (
      <section className="panel player-stats">
        <div className="stats-head">
          <div className={`hub-card ${cardTier(overall(fp, fp.position, fs))}`}>
            <span className="hub-card-top">
              <strong>{overall(fp, fp.position, fs)}</strong>
              <span>{fs.position ?? fp.position}</span>
            </span>
            <PlayerFace key={fp.id} player={fp} className="hub-card-face" />
            <strong className="hub-card-name">{shortName(fp.name)}</strong>
          </div>
          <div className="stats-info">
            <h2>{fp.name}</h2>
            <p className="eyebrow">
              {positionsLine(fp) || fp.position} · {fs.role} · {fs.personality}
            </p>
            <div className="hub-facts">
              <span>
                Camisa <strong>{numbers[fp.id] ?? '—'}</strong>
              </span>
              <span>
                Idade <strong>{ageAt(fp.birthDate, c.date)}</strong>
              </span>
              <span>
                Overall <strong>{overall(fp, fp.position, fs)}</strong>
              </span>
              <span>
                Potencial{' '}
                <strong>
                  {Math.max(1, Math.round(fp.potential + fs.potentialDelta - fp.uncertainty))}–
                  {Math.min(99, Math.round(fp.potential + fs.potentialDelta + fp.uncertainty))}
                </strong>
              </span>
              <span>
                Moral <strong>{Math.round(fs.morale)}</strong>
              </span>
              <span>
                Ritmo <strong>{Math.round(fs.sharpness)}%</strong>
              </span>
              <span>
                Valor <strong>{money(marketValue(c, fp))}</strong>
              </span>
              <span>
                Salário <strong>{money(fs.wage)}</strong>
              </span>
              <span>
                Contrato <strong>{dateLabel(fs.contractEnd)}</strong>
              </span>
              <span>
                Temporada{' '}
                <strong>
                  {fs.goals} gols · {fs.minutes} min
                </strong>
              </span>
            </div>
            {fs.listed ? <p className="pill hub-flag">À VENDA · {money(fs.listed)}</p> : null}
          </div>
        </div>
        <div className="hub-summary">
          <div className="attribute-grid">
            {Object.entries(fp.attributes).map(([k, v]) => (
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
          <HeatMap player={fp} position={fs.position ?? fp.position} state={fs} compact />
        </div>
      </section>
    ) : null;
  return (
    <div className="screen-enter squad-screen">
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
        {view === 'kit' && statsPanel ? (
          statsPanel
        ) : (
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
                const ovr = overall(p, rolePositions[i], s);
                return (
                  <button
                    key={`${i}-${id}`}
                    type="button"
                    data-slot={i}
                    data-autofocus={i === 0 ? '' : undefined}
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
                    aria-label={`${rolePositions[i]}, ${p.name}, camisa ${numbers[id] ?? 'não definida'}, overall ${ovr}, condição ${thresholdPercent(s.fitness)}%, ${availability(p)}, ${familiarityLabel(fam)} ${thresholdPercent(fam)}%. Trocar atleta`}
                  >
                    <svg className="squad-shirt" viewBox="0 0 64 68" aria-hidden="true">
                      <path
                        d="M21 5 10 9 2 21l10 8 5-6v37h30V23l5 6 10-8-8-12-11-4c-2 4-5 6-11 6s-9-2-11-6Z"
                        fill={i === 0 ? '#d9a83b' : club.color}
                        stroke="#e8f4f4"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <text x="32" y="46" textAnchor="middle">
                        {numbers[id] ?? '–'}
                      </text>
                    </svg>
                    <span className="pitch-ovr">
                      <b>{ovr}</b>
                      <span>{rolePositions[i]}</span>
                    </span>
                    {!available(c, id) && (
                      <span className="pitch-alert" aria-hidden="true">
                        <TriangleAlert size={12} />
                      </span>
                    )}
                    <strong>
                      {fam < LEARNED && <TriangleAlert size={11} className="oop-icon" />}
                      {shortName(p.name)}
                    </strong>
                    <span className="pitch-condition" aria-hidden="true">
                      <i style={{ width: `${s.fitness}%` }} />
                    </span>
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
        )}
        <section ref={panel} className="panel squad-controls" data-focus-region="panel">
          {pickerContent ||
            (view === 'kit' ? (
                <>
                  <div className="panel-heading">
                    <h2>Jogadores</h2>
                    <button
                      type="button"
                      className="sort-pill"
                      disabled={!!d || !!kitId}
                      title={d || kitId ? 'Feche a linha aberta para mudar a ordenação' : undefined}
                      onClick={() => cycleSort(1)}
                      aria-label={`Ordenando por ${mode.label.toLowerCase()}. ${d || kitId ? 'Feche a linha aberta para mudar a ordenação' : 'Trocar ordenação'}`}
                    >
                      ◀ ▶ Ordenando por <strong>{mode.label}</strong>
                    </button>
                  </div>
                  <div className="card-scroll">
                    <div className="roster-list">
                      {listRoster.map((p) => {
                        const s = c.players[p.id];
                        const open = d?.id === p.id;
                        return (
                          <div key={p.id} className={`roster-item ${open ? 'open' : ''}`}>
                            <button
                              type="button"
                              data-player={p.id}
                              aria-expanded={open}
                              className={`market-row roster-row ${c.lineup.includes(p.id) ? 'starter' : ''} ${focusId === p.id ? 'focused' : ''}`}
                              onFocus={() => setFocusId(p.id)}
                              onMouseEnter={() => setFocusId(p.id)}
                              onClick={() => {
                                if (open) {
                                  setKitId(null);
                                  setKitPos(null);
                                  setDetail(null);
                                } else openDetail(p);
                              }}
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
                                  </small>
                                </span>
                              </span>
                              <b className="roster-ovr">{overall(p, p.position, s)}</b>
                              <strong>{money(marketValue(c, p))}</strong>
                              <span className={available(c, p.id) ? '' : 'roster-status-alert'}>
                                {c.lineup.includes(p.id) ? 'Titular' : 'Reserva'}
                                {available(c, p.id) ? '' : ` · ${availability(p)}`}
                              </span>
                            </button>
                            {open && ds && (
                              <div className="roster-expand">
                                <div
                                  className="roster-actions"
                                  role="toolbar"
                                  aria-label={`Ações de ${p.name}`}
                                >
                                  {playerActions
                                    .filter((a) => a.id !== 'summary')
                                    .map((a) => (
                                      <button
                                        key={a.id}
                                        type="button"
                                        className={`roster-action ${action === a.id ? 'active' : ''} ${a.id === 'release' ? 'danger-text' : ''}`}
                                        aria-pressed={action === a.id}
                                        onClick={() => {
                                          setKitId(null);
                                          setKitPos(null);
                                          setAction(action === a.id ? 'summary' : a.id);
                                          setConfirmRelease(false);
                                        }}
                                      >
                                        {a.label}
                                      </button>
                                    ))}
                                  <button
                                    type="button"
                                    className={`roster-action ${kitId === p.id ? 'active' : ''}`}
                                    aria-pressed={kitId === p.id}
                                    onClick={() => {
                                      setAction('summary');
                                      setConfirmRelease(false);
                                      setKitId(kitId === p.id ? null : p.id);
                                      setKitPos(kitId === p.id ? null : p.position);
                                    }}
                                  >
                                    <Dumbbell size={14} /> Posições e treino
                                  </button>
                                </div>
                                {kitId === p.id ? kitEditor : action !== 'summary' && actionPanel}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
            ) : view === 'tactics' ? (
              <>
                <p className="eyebrow">IDENTIDADE EM CAMPO</p>
                <h2>Como vamos jogar?</h2>
                <div className="tactic-form">
                  <div className="formation-setting">
                    <ChipGroup
                      label="Formação"
                      value={c.tactic.formation}
                      options={Object.keys(formations).map((f) => ({
                        value: f as Formation,
                        label: f,
                      }))}
                      onChange={(formation) => updateTactic({ formation })}
                    />
                    <p className="formation-warning">
                      <TriangleAlert size={14} /> Trocar a formação refaz a escalação
                      automaticamente.
                    </p>
                  </div>
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
                    const goalkeeperNotAllowed =
                      valid &&
                      p.position === 'GK' &&
                      !role.startsWith('Capit') &&
                      !role.startsWith('Vice');
                    return (
                      <button
                        key={role}
                        type="button"
                        data-role={role}
                        className={`role-card ${valid ? '' : 'empty'}`}
                        onClick={() => setPicking({ kind: 'role', role })}
                      >
                        <span className="role-name">
                          {role.startsWith('Capit') || role.startsWith('Vice') ? (
                            <Crown size={16} />
                          ) : (
                            <Shirt size={16} />
                          )}
                          {role}
                        </span>
                        {valid ? (
                          <>
                            <span className="role-number">{numbers[p.id]}</span>
                            <strong>{shortName(p.name)}</strong>
                            <small>
                              {p.position} · OVR {overall(p, p.position, c.players[p.id])} · índice{' '}
                              {Math.round(roleScore[role](p, c))}
                            </small>
                            <span
                              className={`role-condition ${goalkeeperNotAllowed || !available(c, p.id) ? 'unavailable' : ''}`}
                            >
                              {goalkeeperNotAllowed
                                ? 'Goleiro não permitido nesta função'
                                : `${availability(p)} · condição ${thresholdPercent(c.players[p.id].fitness)}%`}
                            </span>
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
                <div className="panel-heading lineup-overview-heading">
                  <div>
                    <p className="eyebrow">O TIME QUE ENTRA EM CAMPO</p>
                    <h2>Onze inicial</h2>
                  </div>
                  <button
                    type="button"
                    className="lineup-roster-link"
                    onClick={() => {
                      setView('kit');
                      setPicking(null);
                      setKitId(null);
                      setDetail(null);
                      setFocusId(null);
                      requestAnimationFrame(() =>
                        panel.current?.querySelector<HTMLElement>('.roster-row')?.focus(),
                      );
                    }}
                  >
                    <Hash size={15} /> Ver elenco completo
                  </button>
                </div>
                <div className="lineup-metrics">
                  <span>
                    Formação <strong>{c.tactic.formation}</strong>
                  </span>
                  <span>
                    Condição média <strong>{averageFitness}%</strong>
                  </span>
                  <span>
                    Indisponíveis <strong>{unavailableStarters}</strong>
                  </span>
                  <span>
                    Reservas <strong>{Math.max(0, players.length - starters.length)}</strong>
                  </span>
                </div>
                <div className="lineup-list-heading">
                  <span>TITULARES</span>
                  <span>OVR NA FUNÇÃO · CONDIÇÃO</span>
                </div>
                <div className="lineup-list">
                  {starters.map(({ player, state, role, ovr, fit }) => (
                    <button
                      type="button"
                      key={player.id}
                      className={`lineup-list-row ${available(c, player.id) ? '' : 'unavailable'}`}
                      onClick={() => openDetail(player)}
                      aria-label={`${player.name}, ${role}, overall ${ovr}, condição ${thresholdPercent(state.fitness)}%, ${availability(player)}, ${familiarityLabel(fit)} ${thresholdPercent(fit)}%. Abrir ficha`}
                    >
                      <span className="lineup-position">{role}</span>
                      <span className="lineup-name">
                        <strong>{player.name}</strong>
                        <small>
                          {availability(player)}
                          {fit < LEARNED ? ` · ${familiarityLabel(fit)}` : ''}
                        </small>
                      </span>
                      <b className="lineup-ovr">{ovr}</b>
                      <span className="lineup-condition">{thresholdPercent(state.fitness)}%</span>
                    </button>
                  ))}
                </div>
              </>
            ))}
        </section>
      </div>
    </div>
  );
}
