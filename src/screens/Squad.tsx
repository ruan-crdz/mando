import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  Dumbbell,
  Users,
  ClipboardList,
  Crown,
  Shield,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  UserX,
  Download,
  Upload,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { available, bestLineup, squad } from '../game/matches';
import { useGamepad } from '../controller/GamepadProvider';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { clubById } from '../game/npc';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { pitchCoordinates } from '../game/pitch';
import { setShirtNumber, shirtNumbers } from '../game/numbers';
import {
  loanOptionFor,
  marketValue,
  releaseCost,
  renewalOptions,
  renewalTerms,
  type LoanRequest,
} from '../game/transfers';
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
import {
  applySavedLineup,
  assistantArea,
  fireAssistant,
  hireAssistant,
  assistantCandidates,
  lineupExport,
  lineupImportError,
  positionTrainingEta,
  positionsForArea,
  replaceBenchPlayer,
  saveLineup,
  selectBenchPlayer,
  swapBenchPlayers,
  syncBenchWithLineup,
} from '../game/squadManagement';
import { HeatMap } from '../components/HeatMap';
import { PlayerFace } from '../components/PlayerFace';
import { PlayerStatsPanel } from '../components/PlayerStatsPanel';
import { AssistantSalaryBudget } from '../components/AssistantSalaryBudget';
import { assistantPayroll, salaryBudgets } from '../game/staff';
import {
  formations,
  positions,
  roleNames,
  assistantAreas,
  type Career,
  type AssistantArea,
  type Formation,
  type Player,
  type Position,
  type Tactic,
  type World,
} from '../game/types';
import { dateLabel, Modal, money, SectionTitle, thresholdPercent } from '../components/ui';
import { ChipGroup, NumberStepper, ShirtNumberDial, TacticSlider } from '../components/controls';
import { byPosition, shortName } from '../components/PlayerCard';
import { cardTier } from '../components/cardTier';

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

type PlayerAction = 'summary' | 'number' | 'sale' | 'loan' | 'renew' | 'release';
const playerActions: { id: PlayerAction; label: string }[] = [
  { id: 'summary', label: 'Visão geral' },
  { id: 'number', label: 'Número da camisa' },
  { id: 'renew', label: 'Renovar contrato' },
  { id: 'sale', label: 'Lista de transferências' },
  { id: 'loan', label: 'Lista de empréstimos' },
  { id: 'release', label: 'Dispensar' },
];

export function Squad({
  career: c,
  world,
  onChange,
  onRenew,
  onSetClause,
  onLoanOut,
  onExerciseOption,
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
  onSetClause: (id: string, amount: number) => void;
  onLoanOut: (id: string, clubId: string, terms: LoanRequest) => void;
  onExerciseOption: (id: string) => void;
  onListForSale: (id: string, price: number | null) => void;
  onRelease: (id: string) => void;
  onError: (s: string) => void;
  detail: Player | null;
  setDetail: (p: Player | null) => void;
}) {
  const { input } = useGamepad();
  const [view, setView] = useState<'lineup' | 'tactics' | 'roles' | 'kit' | 'staff'>('lineup');
  const [rosterCategory, setRosterCategory] = useState<'stats' | 'qualities' | 'finances'>('stats');
  const [lineupName, setLineupName] = useState('');
  const [previewLineupIndex, setPreviewLineupIndex] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [kitId, setKitId] = useState<string | null>(null);
  const [kitPos, setKitPos] = useState<Position | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [months, setMonths] = useState(36);
  const [clauseValue, setClauseValue] = useState(0);
  const [loanMonths, setLoanMonths] = useState(6);
  const [loanFee, setLoanFee] = useState(0);
  const [loanWagePct, setLoanWagePct] = useState(100);
  const [loanClause, setLoanClause] = useState<'none' | 'option' | 'obligation'>('none');
  const [loanBuyFee, setLoanBuyFee] = useState(0);
  const [loanGames, setLoanGames] = useState(15);
  const [action, setAction] = useState<PlayerAction>('summary');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [outsideId, setOutsideId] = useState<string | null>(null);
  const [benchOrderId, setBenchOrderId] = useState<string | null>(null);
  const [hiringArea, setHiringArea] = useState<AssistantArea | null>(null);
  const lastDetail = useRef<string | null>(null);
  const panel = useRef<HTMLElement>(null);
  const lineupFile = useRef<HTMLInputElement>(null);
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
  const availability = (p: Player) => {
    const state = c.players[p.id];
    if (state.injuryDays) return `Lesão · ${state.injuryDays}d`;
    if (state.suspension) return `Suspenso · ${state.suspension}j`;
    if (state.fitness < 30) return 'Condição insuficiente';
    return 'Disponível';
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      // Ao escolher uma posição, o foco fica no campo; → acessa o banco.
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
    if (change.formation && change.formation !== c.tactic.formation) {
      Object.assign(next, syncBenchWithLineup(next, bestLineup(next, world)));
    }
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
    onChange(syncBenchWithLineup(c, lineup));
    resetBenchSelection();
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
    onChange(syncBenchWithLineup(c, lineup));
    resetBenchSelection();
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
    setView('kit');
    setPicking(null);
    setKitId(null);
    setFocusId(p.id);
    setMonths(36);
    setClauseValue(c.players[p.id]?.clause || Math.round(p.value * 2.5));
    setSalePrice(c.players[p.id]?.listed || Math.round(marketValue(c, p) / 50000) * 50000);
    setLoanMonths(6);
    setLoanFee(0);
    setLoanWagePct(100);
    setLoanClause('none');
    setLoanBuyFee(Math.max(100000, Math.round(marketValue(c, p) / 100000) * 100000));
    setLoanGames(15);
    setConfirmRelease(false);
    setAction('summary');
    setDetail(p);
  };
  const apply = (fn: () => Career) => {
    try {
      onChange(fn());
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      return false;
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
  const cleanSheets = (playerId: string) =>
    c.fixtures.reduce((total, fixture) => {
      const result = fixture.result;
      if (!result) return total;
      const home = fixture.homeId === c.clubId;
      const keeperId = home ? result.homeLineup[0] : result.awayLineup[0];
      const conceded = home ? result.awayGoals : result.homeGoals;
      return total + Number(keeperId === playerId && conceded === 0);
    }, 0);
  const contractMonths = (end: string) =>
    Math.max(
      0,
      (Number(end.slice(0, 4)) - Number(c.date.slice(0, 4))) * 12 +
        Number(end.slice(5, 7)) -
        Number(c.date.slice(5, 7)),
    );
  const importLineupFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = lineupImportError(await file.text(), c, world);
      const savedLineups = [
        ...c.savedLineups.filter(
          (lineup) => lineup.name.toLowerCase() !== imported.name.toLowerCase(),
        ),
        { name: imported.name, formation: imported.formation, playerIds: imported.playerIds },
      ];
      onChange({
        ...syncBenchWithLineup(c, imported.playerIds),
        tactic: { ...c.tactic, formation: imported.formation },
        savedLineups,
      });
      setLineupName(imported.name);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };
  const exportLineup = (name: string, formation: Formation, playerIds: string[]) => {
    try {
      const blob = new Blob([lineupExport(name, formation, playerIds)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name.trim().replace(/[^a-z0-9-_]+/gi, '-') || 'escalação'}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  };

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
  const slotPicking = picking?.kind === 'slot' ? picking : null;
  const reserveRole = slotPicking ? rolePositions[slotPicking.index] : null;
  const resetBenchSelection = () => {
    setOutsideId(null);
    setBenchOrderId(null);
  };
  const focusReserve = (id: string) =>
    requestAnimationFrame(() =>
      panel.current?.querySelector<HTMLElement>(`[data-reserve-player="${id}"]`)?.focus(),
    );
  const changeBench = (incoming: string, outgoing: string) => {
    const changed = apply(() =>
      c.bench.includes(incoming)
        ? swapBenchPlayers(c, incoming, outgoing)
        : replaceBenchPlayer(c, incoming, outgoing),
    );
    if (changed) {
      resetBenchSelection();
      focusReserve(incoming);
    }
  };
  const rolePicking = picking?.kind === 'role' ? picking : null;
  const roleAllows = (player: Player) =>
    !rolePicking ||
    rolePicking.role.startsWith('Capit') ||
    rolePicking.role.startsWith('Vice') ||
    player.position !== 'GK';
  const reserveButton = (player: Player, onBench: boolean) => {
    const id = player.id;
    const state = c.players[id];
    const role = reserveRole ?? state.position ?? player.position;
    const ovr = overall(player, role, state);
    const selected = rolePicking
      ? c.roles[rolePicking.role] === id
      : !slotPicking && (onBench ? benchOrderId === id : outsideId === id);
    const eligible =
      available(c, id) && (!slotPicking || slotPicking.index !== 0 || player.position === 'GK');
    return (
      <button
        key={id}
        className={`bench-player-square ${cardTier(ovr)} ${selected ? 'selected' : ''}`}
        data-bench-player={onBench ? id : undefined}
        data-reserve-player={id}
        aria-pressed={selected}
        aria-label={`${player.name}, ${role}, overall ${ovr}, ${onBench ? 'banco' : 'fora da relação'}, ${availability(player)}`}
        disabled={rolePicking ? !roleAllows(player) : slotPicking || !onBench ? !eligible : false}
        onFocus={() => setFocusId(id)}
        onClick={() => {
          if (rolePicking) {
            setRole(rolePicking.role, id);
          } else if (slotPicking) {
            resetBenchSelection();
            changeSlot(slotPicking.index, id);
          } else if (!onBench) {
            if (benchOrderId) changeBench(id, benchOrderId);
            else {
              resetBenchSelection();
              setOutsideId(outsideId === id ? null : id);
            }
          } else if (outsideId) {
            changeBench(outsideId, id);
          } else if (benchOrderId && benchOrderId !== id) {
            changeBench(benchOrderId, id);
          } else {
            resetBenchSelection();
            setBenchOrderId(selected ? null : id);
          }
        }}
        draggable={(!slotPicking && onBench) || eligible}
        onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
        onDragOver={(event) => {
          if (onBench && !slotPicking) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const incoming = event.dataTransfer.getData('text/plain');
          if (onBench && !slotPicking && incoming !== id) changeBench(incoming, id);
        }}
      >
        <PlayerFace player={player} size="md" />
        <b>
          {ovr} · {role}
        </b>
        <strong>{shortName(player.name)}</strong>
        <small>
          {rolePicking
            ? roleAllows(player)
              ? `índice ${Math.round(roleScore[rolePicking.role](player, c))}`
              : 'Goleiro não permitido'
            : !available(c, id)
              ? availability(player)
              : slotPicking?.index === 0 && player.position !== 'GK'
                ? 'Não é goleiro'
                : `${Math.round(state.fitness)}%`}
        </small>
      </button>
    );
  };
  const reservePanel = (
    <div className="reserve-panel">
      <div className="lineup-section-heading">
        <h3>Banco · {c.bench.length}/9</h3>
        {(input === 'xbox' || input === 'playstation') && (
          <ControllerButtonHint
            action="confirm"
            label={rolePicking ? 'Escolher' : slotPicking ? 'Substituir' : 'Selecionar'}
          />
        )}
      </div>
      <p className="muted">
        {rolePicking
          ? `Escolha no campo, no banco ou fora da relação quem será ${rolePicking.role.toLowerCase()}.`
          : slotPicking
            ? 'Escolha um reserva ou atleta fora da relação para entrar em campo.'
            : outsideId
              ? 'Escolha um titular ou um reserva para trocar com ele.'
              : benchOrderId
                ? 'Escolha um titular, outro reserva ou um não relacionado para trocar com ele.'
                : 'Selecione um atleta e depois quem vai trocar com ele: titular, reserva ou não relacionado.'}
      </p>
      <div className="bench-player-grid" role="group" aria-label="Banco de reservas">
        {c.bench.map((id) => reserveButton(byId(id), true))}
      </div>
      <div className="bench-divider">
        <span>FORA DA RELAÇÃO</span>
        {!slotPicking && !rolePicking && (
          <>
            {outsideId && c.bench.length < 9 && (
              <button
                onClick={() => {
                  if (apply(() => selectBenchPlayer(c, outsideId))) {
                    focusReserve(outsideId);
                    resetBenchSelection();
                  }
                }}
              >
                ↑ Adicionar ao banco
              </button>
            )}
            {(outsideId || benchOrderId) && (
              <button data-back-action onClick={resetBenchSelection}>
                Cancelar seleção
              </button>
            )}
          </>
        )}
      </div>
      <div
        className="bench-player-grid outside-player-grid"
        role="group"
        aria-label="Atletas fora da relação"
      >
        {players
          .filter((player) => !c.lineup.includes(player.id) && !c.bench.includes(player.id))
          .sort(byPosition(c))
          .map((player) => reserveButton(player, false))}
      </div>
    </div>
  );
  let pickerContent = null;
  if (picking?.kind === 'slot') {
    const role = rolePositions[picking.index];
    const currentId = c.lineup[picking.index];
    const current = byId(currentId);
    pickerContent = (
      <>
        <div className="panel-heading picker-heading">
          <button
            className="text-button"
            data-back-action
            onClick={() => {
              returnFocus.current = `[data-slot="${picking.index}"]`;
              resetBenchSelection();
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
        {!players.some(
          (p) =>
            !c.lineup.includes(p.id) &&
            available(c, p.id) &&
            (picking.index !== 0 || p.position === 'GK'),
        ) && <p className="squad-empty">Não há atletas disponíveis para esta troca.</p>}
        <div className="lineup-management">{reservePanel}</div>
      </>
    );
  } else if (picking?.kind === 'role') {
    const score = roleScore[picking.role];
    const best = players
      .filter(roleAllows)
      .sort((a, b) => score(b, c) - score(a, c))
      .slice(0, 3);
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
          {c.roles[picking.role] ? (
            <button type="button" onClick={() => setRole(picking.role, null)}>
              <UserX size={15} /> Remover responsável
            </button>
          ) : (
            <span className="pill">Escolha o responsável</span>
          )}
        </div>
        <p className="muted small">
          Melhores índices:{' '}
          {best.map((p) => `${shortName(p.name)} (${Math.round(score(p, c))})`).join(' · ')}
        </p>
        <div className="lineup-management">{reservePanel}</div>
      </>
    );
  }

  const d = detail && c.players[detail.id] ? detail : null;
  const ds = d ? c.players[d.id] : null;
  const terms = d ? renewalTerms(c, d.id, months) : null;
  const kit = kitId && c.players[kitId]?.clubId === c.clubId ? byId(kitId) : null;
  const ks = kit ? c.players[kit.id] : null;
  const kitRole = kitPos ?? kit?.position ?? 'ST';
  const trainingEta = kit ? positionTrainingEta(kit, c, kitRole) : null;
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
                  {thresholdPercent(familiarity(kit, ks.training, ks))}% (apto a partir de {LEARNED}
                  %)
                </small>
              )}
              {trainingEta && (
                <small className="position-eta">
                  {trainingEta.learned
                    ? `${positionNames[kitRole]} já está apto.`
                    : trainingEta.weeks === null
                      ? 'Goleiros e jogadores de linha não podem trocar de grupo no treino.'
                      : `Estimativa: ${trainingEta.weeks} sem. (${trainingEta.days} dias) para ficar apto · OVR atual ${overall(kit, kitRole, ks)} · potencial ${kit.potential}.`}
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
            <p className="eyebrow">EMPRÉSTIMO</p>
            {ds.loanFrom ? (
              <>
                <p className="muted small">
                  O atleta pertence ao {clubById(world, ds.loanFrom).name} e está emprestado
                  {ds.loanUntil ? ` até ${dateLabel(ds.loanUntil)}` : ''}.
                </p>
                {loanOptionFor(c, d.id) && (
                  <button className="primary" onClick={() => onExerciseOption(d.id)}>
                    Exercer opção · {money(loanOptionFor(c, d.id)!.fee)}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="muted small">
                  Defina as condições e escolha um destino. O clube avalia a proposta antes de
                  aceitar o atleta.
                </p>
                <ChipGroup
                  label="Duração"
                  value={String(loanMonths)}
                  options={[3, 6, 12].map((value) => ({
                    value: String(value),
                    label: `${value} meses`,
                  }))}
                  onChange={(value) => setLoanMonths(Number(value))}
                />
                <NumberStepper
                  label="Taxa recebida"
                  value={loanFee}
                  min={0}
                  step={50000}
                  onChange={(value) => setLoanFee(value ?? 0)}
                  format={money}
                />
                <ChipGroup
                  label="Salário pago pelo destino"
                  value={String(loanWagePct)}
                  options={[0, 25, 50, 60, 75, 100].map((value) => ({
                    value: String(value),
                    label: `${value}%`,
                  }))}
                  onChange={(value) => setLoanWagePct(Number(value))}
                />
                <ChipGroup
                  label="Compra ao fim"
                  value={loanClause}
                  options={[
                    { value: 'none', label: 'Sem cláusula' },
                    { value: 'option', label: 'Opção' },
                    { value: 'obligation', label: 'Obrigação' },
                  ]}
                  onChange={(value) => {
                    if (value === 'none' || value === 'option' || value === 'obligation')
                      setLoanClause(value);
                  }}
                />
                {loanClause !== 'none' && (
                  <NumberStepper
                    label="Valor de compra"
                    value={loanBuyFee}
                    min={100000}
                    step={100000}
                    onChange={(value) => setLoanBuyFee(value ?? 100000)}
                    format={money}
                  />
                )}
                {loanClause === 'obligation' && (
                  <NumberStepper
                    label="Jogos para obrigação"
                    value={loanGames}
                    min={1}
                    max={40}
                    onChange={(value) => setLoanGames(value ?? 15)}
                  />
                )}
                <div className="hub-list">
                  {loanDestinations.map(({ club }) => (
                    <button
                      key={club.id}
                      onClick={() =>
                        onLoanOut(d.id, club.id, {
                          months: loanMonths,
                          fee: loanFee,
                          wagePct: loanWagePct,
                          ...(loanClause === 'option' ? { option: loanBuyFee } : {}),
                          ...(loanClause === 'obligation'
                            ? { obligation: { fee: loanBuyFee, games: loanGames } }
                            : {}),
                        })
                      }
                    >
                      <strong>{club.short}</strong> {club.name}
                    </button>
                  ))}
                </div>
              </>
            )}
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
  const statsPanel = fp ? (
    <PlayerStatsPanel player={fp} career={c} shirtNumber={numbers[fp.id] ?? null} />
  ) : null;
  return (
    <div className="screen-enter squad-screen">
      <SectionTitle kicker="TIME / GESTÃO DO ELENCO" title="Onze nomes. Uma ideia.">
        <button
          data-controller-secondary={view === 'lineup' || view === 'tactics' ? '' : undefined}
          onClick={() => {
            const lineup = bestLineup(c, world);
            if (lineup.length !== 11) onError('Não há onze atletas disponíveis.');
            else onChange(syncBenchWithLineup(c, lineup));
          }}
        >
          <Sparkles size={17} /> Autoescalar
        </button>
      </SectionTitle>
      {hiringArea && (
        <Modal title="Escolher auxiliar" onClose={() => setHiringArea(null)} wide>
          <p>
            Compare salário, conhecimento e estrelas por posição. A contratação só acontece ao
            confirmar um candidato. Cada profissional só pode trabalhar em um setor. Disponível:{' '}
            {money(salaryBudgets(c).assistants - assistantPayroll(c))}/mês.
          </p>
          <div className="assistant-candidates" data-stick-scroll>
            {assistantCandidates(c, hiringArea).map((coach) => (
              <article
                className={`assistant-card ${coach.skill <= 2 ? 'bronze' : coach.skill === 3 ? 'silver' : 'gold'}`}
                key={coach.id}
              >
                <span className="eyebrow">
                  {coach.skill <= 2 ? 'BRONZE' : coach.skill === 3 ? 'PRATA' : 'OURO'}
                </span>
                <h3>{coach.name}</h3>
                <p>
                  {coach.tacticalVision} · conhecimento {coach.skill}/5
                </p>
                <strong>
                  {money(coach.wageWeekly)}/semana · {money((coach.wageWeekly * 52) / 12)}/mês
                </strong>
                <div className="assistant-stars">
                  {positionsForArea[hiringArea].map((position) => (
                    <span key={position}>
                      {position} {'★'.repeat(coach.stars[position])}
                      {'☆'.repeat(5 - coach.stars[position])}
                    </span>
                  ))}
                </div>
                <p>
                  {(() => {
                    const stars = positionsForArea[hiringArea].map(
                      (position) => coach.stars[position],
                    );
                    const low = (coach.skill + Math.min(...stars) - 1) * 4;
                    const high = (coach.skill + Math.max(...stars) - 1) * 4;
                    return low === high
                      ? `Evolução e treino de posição: +${high}% em todas as posições do setor.`
                      : `Evolução e treino de posição: +${low}% a +${high}% conforme as estrelas.`;
                  })()}
                </p>
                <button
                  className="primary"
                  disabled={
                    assistantPayroll(c) + (coach.wageWeekly * 52) / 12 > salaryBudgets(c).assistants
                  }
                  onClick={() => {
                    const id = coach.id;
                    if (!id) {
                      onError('Candidato sem identificação.');
                      return;
                    }
                    if (apply(() => hireAssistant(c, hiringArea, id))) setHiringArea(null);
                  }}
                >
                  Contratar {coach.name}
                </button>
              </article>
            ))}
          </div>
          <p className="muted small">
            Sem empilhar bônus: vale o melhor auxiliar para cada posição. O salário é debitado
            mensalmente.
          </p>
        </Modal>
      )}
      <div className="segmented">
        <button
          className={view === 'lineup' ? 'active' : ''}
          onClick={() => {
            setView('lineup');
            resetBenchSelection();
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
          <Users size={16} /> Jogadores
        </button>
        <button
          className={view === 'staff' ? 'active' : ''}
          onClick={() => {
            setView('staff');
            setPicking(null);
            setKitId(null);
            setDetail(null);
          }}
        >
          <Users size={16} /> Comissão
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
                    className={`pitch-player ${cardTier(ovr)} ${!available(c, id) ? 'unavailable' : ''} ${selected ? 'selected' : ''} ${swapping ? 'swap-target' : ''} ${fam < LEARNED ? 'out-of-position' : ''}`}
                    style={{ left: `${coordinates[i].x}%`, top: `${coordinates[i].y}%` }}
                    onClick={() => {
                      if (rolePicking) {
                        if (roleAllows(p)) setRole(rolePicking.role, id);
                        return;
                      }
                      setView('lineup');
                      const incoming = outsideId ?? benchOrderId;
                      if (incoming) changeSlot(i, incoming);
                      else if (picking?.kind === 'slot' && !selected) swapSlots(picking.index, i);
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
                    <PlayerFace player={p} className="pitch-player-face" />
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
                ? `Escolha outro titular para trocar de posição com ${shortName(byId(c.lineup[picking.index]).name)}, ou vá → para o banco e os não relacionados.`
                : 'Selecione um titular para substituí-lo por alguém do banco ou fora da relação.'}
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
                <div
                  className="roster-category-tabs"
                  role="group"
                  aria-label="Categorias do elenco"
                >
                  {(
                    [
                      ['stats', 'PARTICIPAÇÃO'],
                      ['qualities', 'QUALIDADES'],
                      ['finances', 'FINANÇAS'],
                    ] as const
                  ).map(([category, label]) => (
                    <button
                      key={category}
                      type="button"
                      className={rosterCategory === category ? 'active' : ''}
                      aria-pressed={rosterCategory === category}
                      onClick={() => setRosterCategory(category)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="roster-columns" aria-hidden="true">
                  <span>JOGADOR</span>
                  {rosterCategory === 'stats' ? (
                    <span>JOGOS · GOLS · ASSIST. · JG. SEM SOFRER</span>
                  ) : rosterCategory === 'qualities' ? (
                    <span>IDADE · OVR · RITMO · FINAL. · PASSE · DEF. · FÍSICO</span>
                  ) : (
                    <span>VALOR · SALÁRIO/MÊS · CONTRATO RESTANTE</span>
                  )}
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
                                  {rosterCategory === 'finances'
                                    ? `${ageAt(p.birthDate, c.date)} anos · até ${s.contractEnd.slice(0, 4)}`
                                    : `${ageAt(p.birthDate, c.date)} anos · ${positionsLine(p)}`}
                                  {s.listed ? ' · À VENDA' : ''}
                                </small>
                              </span>
                            </span>
                            {rosterCategory === 'stats' ? (
                              <span className="roster-category-values">
                                <b>{s.rated ?? 0}</b>
                                <b>{s.goals}</b>
                                <b>{s.assists}</b>
                                <b>{p.position === 'GK' ? cleanSheets(p.id) : '—'}</b>
                              </span>
                            ) : rosterCategory === 'qualities' ? (
                              <span className="roster-category-values quality-values">
                                <b>{ageAt(p.birthDate, c.date)} a.</b>
                                <b className="roster-ovr">{overall(p, p.position, s)}</b>
                                <b>{p.attributes.pace}</b>
                                <b>{p.attributes.finishing}</b>
                                <b>{p.attributes.shortPass}</b>
                                <b>{p.attributes.marking}</b>
                                <b>{p.attributes.strength}</b>
                              </span>
                            ) : (
                              <span className="roster-category-values finance-values">
                                <b>{money(marketValue(c, p))}</b>
                                <b>{money(s.wage)}/mês</b>
                                <b>{contractMonths(s.contractEnd)} meses</b>
                              </span>
                            )}
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
            ) : view === 'staff' ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">COMISSÃO TÉCNICA</p>
                    <h2>Auxiliares por setor</h2>
                  </div>
                  <span>{Object.keys(c.assistantCoaches).length} auxiliares contratados</span>
                </div>
                <AssistantSalaryBudget career={c} onChange={onChange} onError={onError} />
                <p className="muted small">
                  Cada setor aceita vários auxiliares dentro do orçamento. Uma pessoa ocupa apenas
                  um setor. Para cada posição, vale o melhor auxiliar do setor responsável, sem
                  somar bônus repetidos. Não há taxa inicial.
                  {' No controle: '}
                  <ControllerButtonHint action="confirm" label="Selecionar" /> para contratar ou
                  demitir.
                </p>
                <div className="assistant-grid">
                  {assistantAreas.map((area) => {
                    const labels: Record<AssistantArea, string> = {
                      ataque: 'Ataque',
                      meio: 'Meio-campo',
                      defesa: 'Defesa',
                      goleiro: 'Goleiros',
                    };
                    const coaches = Object.entries(c.assistantCoaches).filter(
                      ([key, coach]) => assistantArea(key, coach) === area,
                    );
                    return (
                      <section className="assistant-sector" key={area} aria-label={labels[area]}>
                        <div className="panel-heading">
                          <h3>
                            {labels[area]} · {coaches.length}
                          </h3>
                          <button type="button" onClick={() => setHiringArea(area)}>
                            <UserPlus size={15} /> Contratar auxiliar
                          </button>
                        </div>
                        {!coaches.length && <p className="muted">Nenhum auxiliar neste setor.</p>}
                        {coaches.map(([id, coach]) => (
                          <article className="assistant-card" key={id}>
                            <h3>{coach.name}</h3>
                            <p>
                              Visão tática: <strong>{coach.tacticalVision}</strong>
                            </p>
                            <p>
                              Conhecimento: <strong>{coach.skill}/5</strong> ·{' '}
                              {money(coach.wageWeekly)}/semana
                            </p>
                            <p>
                              Treino por posição: até +
                              {Math.round(
                                (coach.skill +
                                  Math.max(
                                    ...positionsForArea[area].map(
                                      (position) => coach.stars[position],
                                    ),
                                  ) -
                                  1) *
                                  4,
                              )}
                              % de evolução.
                            </p>
                            <div className="assistant-stars">
                              {Object.entries(coach.stars)
                                .filter(([position]) =>
                                  positionsForArea[area].some((item) => item === position),
                                )
                                .map(([position, stars]) => (
                                  <span key={position}>
                                    {position}{' '}
                                    {Array.from({ length: 5 }, (_, i) =>
                                      i < stars ? '★' : '☆',
                                    ).join('')}
                                  </span>
                                ))}
                            </div>
                            <button
                              type="button"
                              className="danger-text"
                              onClick={() => apply(() => fireAssistant(c, id))}
                            >
                              <UserMinus size={15} /> Demitir auxiliar
                            </button>
                          </article>
                        ))}
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="panel-heading lineup-overview-heading">
                  <div>
                    <p className="eyebrow">BANCO E ELENCO</p>
                    <h2>Reservas</h2>
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
                    <Users size={15} /> Ver elenco completo
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
                <div className="lineup-management">
                  {reservePanel}
                  <div className="saved-lineups">
                    <div className="lineup-section-heading">
                      <div>
                        <p className="eyebrow">PLANOS SALVOS</p>
                        <h3>Minhas escalações</h3>
                      </div>
                    </div>
                    <div className="saved-lineup-actions">
                      <label className="lineup-name-input">
                        Nome
                        <input
                          value={lineupName}
                          maxLength={32}
                          onChange={(event) => setLineupName(event.target.value)}
                          placeholder="Ex.: Pressão alta"
                        />
                      </label>
                      <button type="button" onClick={() => apply(() => saveLineup(c, lineupName))}>
                        <Sparkles size={15} /> Salvar escalação atual
                      </button>
                      <input
                        ref={lineupFile}
                        hidden
                        type="file"
                        accept="application/json,.json"
                        aria-label="Arquivo JSON de escalação"
                        onChange={(event) => {
                          void importLineupFile(event.target.files?.[0]);
                          event.target.value = '';
                        }}
                      />
                      <button type="button" onClick={() => lineupFile.current?.click()}>
                        <Upload size={15} /> Importar JSON
                      </button>
                    </div>
                    <p className="muted small">
                      No controle, use <ControllerButtonHint action="confirm" label="Selecionar" />{' '}
                      para salvar, importar, pré-visualizar, aplicar, exportar ou excluir. Importar
                      abre o seletor de arquivos do sistema.
                    </p>
                    {c.savedLineups.map((saved, index) => (
                      <div className="saved-lineup-row" key={`${saved.name}-${index}`}>
                        <button
                          type="button"
                          className={previewLineupIndex === index ? 'active' : ''}
                          aria-pressed={previewLineupIndex === index}
                          onClick={() => setPreviewLineupIndex(index)}
                        >
                          {saved.name} · {saved.formation}
                        </button>
                        <button
                          type="button"
                          onClick={() => apply(() => applySavedLineup(c, index, world))}
                        >
                          Aplicar
                        </button>
                        <button
                          type="button"
                          aria-label={`Exportar escalação ${saved.name}`}
                          onClick={() => exportLineup(saved.name, saved.formation, saved.playerIds)}
                        >
                          <Download size={15} /> Exportar
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir escalação ${saved.name}`}
                          onClick={() => {
                            onChange({
                              ...c,
                              savedLineups: c.savedLineups.filter((_, i) => i !== index),
                            });
                            setPreviewLineupIndex(null);
                          }}
                        >
                          <UserX size={15} /> Excluir
                        </button>
                      </div>
                    ))}
                    {previewLineupIndex !== null && c.savedLineups[previewLineupIndex] && (
                      <div className="saved-lineup-preview">
                        <strong>
                          Prévia: {c.savedLineups[previewLineupIndex].name} ·{' '}
                          {c.savedLineups[previewLineupIndex].formation}
                        </strong>
                        <ol>
                          {c.savedLineups[previewLineupIndex].playerIds.map((id) => {
                            const player = players.find((candidate) => candidate.id === id);
                            return (
                              <li key={id}>
                                {player
                                  ? `${player.position} · ${player.name}`
                                  : `Atleta indisponível · ${id}`}
                              </li>
                            );
                          })}
                        </ol>
                        <button
                          type="button"
                          onClick={() => {
                            const saved = c.savedLineups[previewLineupIndex];
                            exportLineup(saved.name, saved.formation, saved.playerIds);
                          }}
                        >
                          <Download size={15} /> Exportar prévia
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ))}
        </section>
      </div>
    </div>
  );
}
