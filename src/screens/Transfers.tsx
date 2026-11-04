import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Handshake,
  MessageSquare,
  Search,
  Send,
  Star,
  UserRoundX,
  Wallet,
  X,
} from 'lucide-react';
import {
  type Career,
  type NegotiationMessage,
  type Offer,
  type Player,
  positions,
  type World,
} from '../game/types';
import {
  activeThread,
  commissionOf,
  type LoanRequest,
  loanAsk,
  loanBonusAsk,
  loanOptionFor,
  loanOutlook,
  marketValue,
  negotiationOutlook,
  requiredWage,
  scoutReport,
  threadOf,
} from '../game/transfers';
import { agentOf, clubRights, formingClub, partyName, rightsPartners } from '../game/market';
import { squad } from '../game/matches';
import { addMonths, ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { transferWindow } from '../game/calendar';
import { clubById, isForeign } from '../game/npc';
import { Badge, dateLabel, Modal, money, SectionTitle } from '../components/ui';
import { ChipGroup, NumberStepper, OptionCycler } from '../components/controls';
import { byPosition, PlayerCard } from '../components/PlayerCard';
import { PlayerFace } from '../components/PlayerFace';
import { cardTier } from '../components/cardTier';

type Filters = {
  name: string;
  club: string;
  league: string;
  position: string;
  foot: string;
  contract: string;
  nationality: string;
  minAge: number | null;
  maxAge: number | null;
  minOvr: number | null;
  maxOvr: number | null;
  minPotential: number | null;
  maxValue: number | null;
  maxWage: number | null;
};
const initialFilters: Filters = {
  name: '',
  club: '',
  league: '',
  position: '',
  foot: '',
  contract: '',
  nationality: '',
  minAge: null,
  maxAge: null,
  minOvr: null,
  maxOvr: null,
  minPotential: null,
  maxValue: null,
  maxWage: null,
};

type Deal = {
  player: Player;
  fee: number;
  wage: number;
  years: number;
  bonus: number;
  exchange: string;
  mode: 'buy' | 'loan';
  rights: number;
  sellOn: number;
  months: number;
  wagePct: number;
  clause: 'none' | 'option' | 'obligation';
  option: number;
  obligationFee: number;
  obligationGames: number;
};

const ledgerLabel: Record<Career['living']['ledger'][number]['kind'], string> = {
  sellon: 'Sell-on',
  solidariedade: 'Solidariedade FIFA',
  direitos: 'Direitos econômicos',
  comissao: 'Comissão de empresário',
  emprestimo: 'Empréstimo',
  opcao: 'Opção de compra',
};

/** Fatos de mercado brasileiro: direitos, sell-on pendente, formador e empresário. */
function MarketFacts({ c, world, p }: { c: Career; world: World; p: Player }) {
  const s = c.players[p.id];
  const rights = clubRights(c, p.id);
  const partners = rightsPartners(c, world, p.id);
  const former = formingClub(c, world, p.id);
  const agent = agentOf(p.id);
  const sellOns = c.living.sellOns.filter((x) => x.playerId === p.id);
  return (
    <>
      <div>
        <dt>Direitos do clube</dt>
        <dd>
          {rights}%
          {partners.map((partner) => ` · ${partner.pct}% ${partyName(world, partner.id, p.id)}`)}
        </dd>
      </div>
      <div>
        <dt>Sell-on</dt>
        <dd>
          {sellOns.length
            ? sellOns.map((x) => `${x.pct}% ${partyName(world, x.clubId)}`).join(' · ')
            : 'Nenhum'}
        </dd>
      </div>
      <div>
        <dt>
          {c.youth.some((youth) => youth.id === p.id) ||
          c.prospects.some((prospect) => prospect.id === p.id)
            ? 'Clube formador'
            : 'Formador (simulado)'}
        </dt>
        <dd>{former ? partyName(world, former) : '—'}</dd>
      </div>
      <div>
        <dt>Empresário (simulado)</dt>
        <dd>
          {agent.name} · influência {agent.influence}/5 · {agent.commission}%
        </dd>
      </div>
      {s?.loanFrom && s.loan && (
        <div>
          <dt>Emprestado</dt>
          <dd>
            {partyName(world, s.loanFrom)} · {s.loan.wagePct}% salário
            {s.loan.option !== undefined ? ` · opção ${money(s.loan.option)}` : ''}
            {s.loan.obligation
              ? ` · obrigação ${money(s.loan.obligation.fee)} (≥${s.loan.obligation.games} jogos)`
              : ''}
          </dd>
        </div>
      )}
    </>
  );
}

const loanTermsLabel = (l: NonNullable<NegotiationMessage['loan']>) =>
  `${l.months}m · ${l.wagePct}% salário${l.option !== undefined ? ` · opção ${money(l.option)}` : ''}${
    l.obligation ? ` · obrigação ${money(l.obligation.fee)} (≥${l.obligation.games} jogos)` : ''
  }`;

const chanceLevels = [
  [85, 'Muito provável'],
  [60, 'Provável'],
  [35, 'Possível'],
  [15, 'Improvável'],
  [-Infinity, 'Muito improvável'],
] as const;
const chanceLevel = (v: number) => 5 - chanceLevels.findIndex(([min]) => v >= min);

function LikelihoodMeter({ label, value }: { label: string; value: number }) {
  const level = chanceLevel(value);
  const tone = level >= 4 ? 'good' : level === 3 ? 'mid' : 'bad';
  return (
    <div
      className={`likelihood ${tone}`}
      role="meter"
      aria-valuemin={1}
      aria-valuemax={5}
      aria-valuenow={level}
      aria-label={`${label}: ${chanceLevels[5 - level][1]}`}
    >
      <span>
        {label} <b>{chanceLevels[5 - level][1]}</b>
      </span>
      <div className="likelihood-bar">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < level ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}

function ScoutReportPanel({
  player: p,
  career: c,
  world,
  title,
  onNegotiate,
  onShortlist,
  shortlistLabel,
}: {
  player: Player | undefined;
  career: Career;
  world: World;
  title: string;
  onNegotiate: (p: Player) => void;
  onShortlist: (id: string) => void;
  shortlistLabel?: string;
}) {
  if (!p)
    return (
      <aside className="panel scout-report empty" aria-live="polite">
        <p className="eyebrow">{title}</p>
        <p className="muted">Foque um atleta para ver o relatório.</p>
      </aside>
    );
  const s = c.players[p.id];
  const club = clubById(world, s.clubId!);
  const ovr = overall(p, p.position, s);
  const watched = c.shortlist.includes(p.id);
  const precontract = s.contractEnd > c.date && s.contractEnd <= addMonths(c.date, 6);
  return (
    <aside className="panel scout-report" aria-live="polite" aria-label={`${title}: ${p.name}`}>
      <p className="eyebrow">{title}</p>
      <div className="scout-head">
        <div className={`hub-card scout-card ${cardTier(ovr)}`}>
          <span className="hub-card-top">
            <strong>{ovr}</strong>
            <span>{p.position}</span>
          </span>
          <PlayerFace key={p.id} player={p} className="hub-card-face" />
          <strong className="hub-card-name">{p.name.split(' ').at(-1)}</strong>
        </div>
        <div className="scout-identity">
          <h2>{p.name}</h2>
          <span className="scout-club">
            <Badge club={club} size="small" /> {club.name}
          </span>
          <small>
            {ageAt(p.birthDate, c.date)} anos · {p.nationality} · pé{' '}
            {p.foot === 'E' ? 'esquerdo' : p.foot === 'A' ? 'ambos' : 'direito'}
          </small>
        </div>
      </div>
      <p className="scout-line">{scoutReport(c, p)}</p>
      <dl className="scout-facts">
        <div>
          <dt>Valor de mercado</dt>
          <dd>{money(marketValue(c, p))}</dd>
        </div>
        <div>
          <dt>Salário/mês</dt>
          <dd>{money(s.wage)}</dd>
        </div>
        <div>
          <dt>Contrato até</dt>
          <dd>{dateLabel(s.contractEnd)}</dd>
        </div>
        <div>
          <dt>Divisão</dt>
          <dd>{club.league === 'A' ? 'Série A' : club.league === 'B' ? 'Série B' : 'Outra'}</dd>
        </div>
        <MarketFacts c={c} world={world} p={p} />
      </dl>
      <div className="scout-flags">
        {watched && (
          <span className="pill">
            <Star size={12} className="star-on" /> Observado
          </span>
        )}
        {s.loanFrom && <span className="pill">Emprestado</span>}
        {precontract && <span className="pill">Pré-contrato liberado</span>}
        {s.clause ? <span className="pill">Multa {money(s.clause)}</span> : null}
      </div>
      <div className="scout-actions">
        <button type="button" className="primary" onClick={() => onNegotiate(p)}>
          <Handshake size={16} /> Negociar
        </button>
        <button
          type="button"
          className={watched ? 'active' : ''}
          aria-pressed={watched}
          onClick={() => onShortlist(p.id)}
        >
          <Star size={16} /> {shortlistLabel ?? (watched ? 'Observado' : 'Observar')}
        </button>
      </div>
    </aside>
  );
}

const needsAction = (o: Offer) => (o.incoming ? o.status === 'pending' : o.status === 'countered');

function statusLabel(o: Offer) {
  if (o.status === 'pending') return o.incoming ? 'Responder' : 'Aguardando';
  if (o.status === 'countered') return 'Contraproposta';
  if (o.status === 'rejected') return 'Recusada';
  if (o.status === 'completed' || o.status === 'accepted') return 'Concluída';
  return 'Encerrada';
}

const kindLabel: Record<NegotiationMessage['kind'], string> = {
  offer: 'PROPOSTA',
  counter: 'CONTRAPROPOSTA',
  accept: 'ACEITA',
  reject: 'RECUSADA',
  info: '',
};

function Figures({ m, world }: { m: NegotiationMessage; world: World }) {
  const exchange = m.exchangePlayerId && world.players.find((p) => p.id === m.exchangePlayerId);
  const items: [string, string][] = [];
  if (m.fee !== undefined) items.push([m.loan ? 'Taxa de empréstimo' : 'Taxa', money(m.fee)]);
  if (m.rights !== undefined && m.rights < 100) items.push(['Direitos', `${m.rights}%`]);
  if (m.sellOn) items.push(['Sell-on', `${m.sellOn}%`]);
  if (m.loan) items.push(['Empréstimo', loanTermsLabel(m.loan)]);
  if (exchange) items.push(['Troca', exchange.name]);
  if (m.wage !== undefined) items.push(['Salário/mês', money(m.wage)]);
  if (m.years) items.push(['Contrato', `${m.years} ${m.years === 1 ? 'ano' : 'anos'}`]);
  if (m.bonus) items.push(['Luvas', money(m.bonus)]);
  if (!items.length) return null;
  return (
    <div className="bubble-figures">
      {items.map(([k, v]) => (
        <span key={k}>
          <small>{k}</small>
          <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

function ChatPanel({
  offer,
  career: c,
  world,
  open,
  onRespond,
  onAnswer,
  onAsk,
  onCounter,
  inside,
  onExit,
}: {
  offer: Offer;
  career: Career;
  world: World;
  open: boolean;
  onRespond: (id: string, accept: boolean) => void;
  onAnswer: (id: string, accept: boolean) => void;
  onAsk: (id: string, fee: number) => void;
  onCounter: () => void;
  inside: boolean;
  onExit: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLElement>(null);
  const thread = threadOf(offer);
  const [ask, setAsk] = useState(Math.round((offer.fee * 1.2) / 50000) * 50000);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length]);
  useEffect(() => {
    if (!inside) return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (root.current?.contains(active) && active !== document.body) return;
      const box = root.current;
      (
        box?.querySelector<HTMLElement>(
          '.chat-actions button:not(:disabled), .chat-actions input',
        ) || box?.querySelector<HTMLElement>('[data-trap-exit]')
      )?.focus();
    });
  }, [inside, offer.status]);
  const p = world.players.find((p) => p.id === offer.playerId)!;
  const other = clubById(world, offer.incoming ? offer.fromClubId : offer.toClubId);
  const mine = clubById(world, c.clubId);
  const agent = agentOf(p.id);
  const agentLabel = `${agent.name} · empresário de ${p.name}`;
  const author = (m: NegotiationMessage) =>
    m.from === 'me' ? mine.name : m.from === 'agent' ? agentLabel : other.name;
  const stillThere = c.players[p.id]?.clubId === offer.toClubId;
  const locked = offer.lockedUntil && offer.lockedUntil > c.date;
  return (
    <section
      ref={root}
      className={`panel chat-panel ${inside ? 'inside' : ''}`}
      data-focus-trap={inside ? '' : undefined}
    >
      <header className="chat-head">
        <Badge club={other} />
        <PlayerFace player={p} size="sm" />
        <span>
          <strong>{p.name}</strong>
          <small>
            {p.position} · OVR {overall(p, p.position, c.players[p.id])} · {other.name}
          </small>
        </span>
        {inside && (
          <button type="button" className="text-button chat-exit" data-trap-exit onClick={onExit}>
            <ChevronLeft size={15} /> Sair da conversa
          </button>
        )}
        {!offer.incoming && (
          <div className="chat-stages">
            <span className={offer.stage === 'player' ? 'done' : 'active'}>
              {offer.stage === 'player' ? <Check size={13} /> : '1'} Clube
            </span>
            <ChevronRight size={14} />
            <span className={offer.stage === 'player' ? 'active' : ''}>
              2 {offer.loan ? 'Atleta' : 'Contrato'}
            </span>
          </div>
        )}
      </header>
      <div className="chat-scroll" ref={scroller}>
        {thread.map((m, i) => (
          <Fragment key={i}>
            {(i === 0 || thread[i - 1].date !== m.date) && (
              <div className="chat-date">
                <span>{dateLabel(m.date)}</span>
              </div>
            )}
            {m.from === 'system' ? (
              <div className="chat-system">{m.text}</div>
            ) : (
              <div className={`bubble from-${m.from === 'me' ? 'me' : 'them'} kind-${m.kind}`}>
                <span className="bubble-author">
                  {m.from === 'agent' ? (
                    <span className="agent-avatar">AG</span>
                  ) : (
                    <Badge club={m.from === 'me' ? mine : other} size="small" />
                  )}
                  {author(m)}
                  {kindLabel[m.kind] && <i className="bubble-tag">{kindLabel[m.kind]}</i>}
                </span>
                <p>{m.text}</p>
                <Figures m={m} world={world} />
              </div>
            )}
          </Fragment>
        ))}
        {offer.status === 'pending' && !offer.incoming && (
          <div className="bubble from-them typing">
            <span className="bubble-author">
              {offer.stage === 'player' ? agentLabel : other.name}
            </span>
            <p className="typing-dots">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}
      </div>
      <footer className="chat-actions">
        {!offer.incoming && offer.status === 'countered' && (
          <>
            <button className="primary" onClick={() => onRespond(offer.id, true)} disabled={!open}>
              <Check size={16} /> Aceitar
            </button>
            <button onClick={onCounter} disabled={!open}>
              <Handshake size={16} /> Contraproposta
            </button>
            <button className="danger" onClick={() => onRespond(offer.id, false)}>
              <X size={16} /> Recusar
            </button>
          </>
        )}
        {!offer.incoming && offer.status === 'rejected' && (
          <>
            <button className="primary" onClick={onCounter} disabled={!open || !stillThere}>
              <Handshake size={16} /> Nova proposta
            </button>
            <button className="danger" onClick={() => onRespond(offer.id, false)}>
              <X size={16} /> Desistir
            </button>
          </>
        )}
        {!offer.incoming && offer.status === 'pending' && (
          <p className="chat-wait">
            <Clock3 size={16} /> Aguardando resposta até {dateLabel(offer.responseDate)}. Avance o
            dia.
          </p>
        )}
        {!offer.incoming &&
          offer.status === 'declined' &&
          (locked ? (
            <p className="chat-wait">Conversas encerradas até {dateLabel(offer.lockedUntil!)}.</p>
          ) : (
            <button onClick={onCounter} disabled={!open || !stillThere}>
              <Handshake size={16} /> Reabrir negociação
            </button>
          ))}
        {offer.incoming && offer.status === 'pending' && (
          <>
            <button className="primary" onClick={() => onAnswer(offer.id, true)}>
              <Check size={16} /> Aceitar {money(offer.fee)}
            </button>
            <div className="chat-ask">
              <NumberStepper
                label="Pedir"
                value={ask}
                min={offer.fee + 50000}
                step={250000}
                onChange={(v) => setAsk(v ?? offer.fee + 50000)}
                format={(v) => money(v)}
              />
              <button onClick={() => onAsk(offer.id, ask)}>
                <Handshake size={16} /> Contraproposta
              </button>
            </div>
            <button className="danger" onClick={() => onAnswer(offer.id, false)}>
              <X size={16} /> Recusar
            </button>
          </>
        )}
        {(offer.status === 'completed' || offer.status === 'accepted') && (
          <p className="chat-wait done">
            <Check size={16} /> Negócio concluído.
          </p>
        )}
        {offer.incoming && offer.status === 'declined' && (
          <p className="chat-wait">Conversa encerrada.</p>
        )}
      </footer>
    </section>
  );
}

export function Transfers({
  career: c,
  world,
  onOffer,
  onAnswer,
  onRespond,
  onAsk,
  onShortlist,
  onLoan,
  onExerciseOption,
  onPrecontract,
  onClause,
}: {
  career: Career;
  world: World;
  onOffer: (
    id: string,
    fee: number,
    wage: number,
    exchange: string | undefined,
    terms: { years: number; bonus: number; rights?: number; sellOn?: number },
  ) => boolean;
  onAnswer: (id: string, accept: boolean) => void;
  onRespond: (id: string, accept: boolean) => void;
  onAsk: (id: string, fee: number) => void;
  onShortlist: (id: string) => void;
  onLoan: (id: string, terms: LoanRequest) => boolean;
  onExerciseOption: (id: string) => void;
  onPrecontract: (id: string, wage: number) => void;
  onClause: (id: string) => void;
}) {
  const [view, setView] = useState<'market' | 'shortlist' | 'negotiations' | 'accounts'>(
    'market',
  );
  const [selected, setSelected] = useState('');
  const [inside, setInside] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [step, setStep] = useState<'club' | 'player'>('club');
  const [pickExchange, setPickExchange] = useState(false);
  const [page, setPage] = useState(0);
  const [marketFocus, setMarketFocus] = useState('');
  const [shortlistFocus, setShortlistFocus] = useState('');
  const finance = c.finances[c.clubId];
  const open = transferWindow(c.date);
  const clubName = (p: Player) => clubById(world, c.players[p.id].clubId!).name;
  const filtered = useMemo(
    () =>
      world.players
        .filter((p) => {
          const state = c.players[p.id];
          const club = world.clubs.find((club) => club.id === state.clubId);
          const age = ageAt(p.birthDate, c.date);
          const ovr = overall(p, p.position, state);
          return (
            state.clubId !== c.clubId &&
            state.clubId !== null &&
            !isForeign(state.clubId) &&
            p.name.toLocaleLowerCase('pt-BR').includes(filters.name.toLocaleLowerCase('pt-BR')) &&
            (!filters.club || state.clubId === filters.club) &&
            (!filters.league || club?.league === filters.league) &&
            (!filters.position || p.position === filters.position) &&
            (filters.minAge === null || age >= filters.minAge) &&
            (filters.maxAge === null || age <= filters.maxAge) &&
            (filters.minOvr === null || ovr >= filters.minOvr) &&
            (filters.maxOvr === null || ovr <= filters.maxOvr) &&
            (filters.minPotential === null || p.potential >= filters.minPotential) &&
            (filters.maxValue === null || marketValue(c, p) <= filters.maxValue) &&
            (filters.maxWage === null || state.wage <= filters.maxWage) &&
            (!filters.contract || state.contractEnd <= filters.contract) &&
            (!filters.foot || p.foot === filters.foot) &&
            p.nationality.toLocaleLowerCase().includes(filters.nationality.toLocaleLowerCase())
          );
        })
        .sort((a, b) => overall(b) - overall(a)),
    [c, world, filters],
  );
  const filter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };
  const startDeal = (p: Player, previous?: Partial<Deal>) => {
    const thread = activeThread(c, p.id);
    const last = thread && thread.status !== 'completed' ? thread : undefined;
    const mode = previous?.mode ?? (last?.loan ? 'loan' : 'buy');
    const loan = last?.loan;
    const months = previous?.months ?? loan?.months ?? 6;
    const ask = loanAsk(c, world, p, months);
    setDeal({
      player: p,
      fee:
        previous?.fee ??
        (last && Boolean(last.loan) === (mode === 'loan') ? last.fee : undefined) ??
        (mode === 'loan' ? ask.fee : marketValue(c, p)),
      wage: previous?.wage ?? (last?.loan ? undefined : last?.wage) ?? Math.round((c.players[p.id].wage * 1.15) / 1000) * 1000,
      years: previous?.years ?? last?.years ?? 3,
      bonus: previous?.bonus ?? last?.bonus ?? 0,
      exchange: previous?.exchange ?? last?.exchangePlayerId ?? '',
      mode,
      rights: previous?.rights ?? last?.rights ?? 100,
      sellOn: previous?.sellOn ?? last?.sellOn ?? 0,
      months,
      wagePct: previous?.wagePct ?? loan?.wagePct ?? ask.wagePct,
      clause:
        previous?.clause ?? (loan?.obligation ? 'obligation' : loan?.option !== undefined ? 'option' : 'none'),
      option: previous?.option ?? loan?.option ?? ask.option,
      obligationFee: previous?.obligationFee ?? loan?.obligation?.fee ?? ask.obligation,
      obligationGames: previous?.obligationGames ?? loan?.obligation?.games ?? 15,
    });
    setStep(
      last && Boolean(last.loan) === (mode === 'loan') && last.stage === 'player'
        ? 'player'
        : 'club',
    );
    setPickExchange(false);
  };
  const openCounter = (o: Offer) => {
    const p = world.players.find((p) => p.id === o.playerId);
    if (p) startDeal(p);
  };
  const threads = [...c.offers].sort((a, b) => {
    const la = threadOf(a);
    const lb = threadOf(b);
    return (
      Number(needsAction(b)) - Number(needsAction(a)) ||
      lb[lb.length - 1].date.localeCompare(la[la.length - 1].date) ||
      c.offers.indexOf(b) - c.offers.indexOf(a)
    );
  });
  const current =
    threads.find((o) => o.id === selected || (!o.incoming && o.playerId === selected)) ||
    threads[0];
  const anyThread = deal ? activeThread(c, deal.player.id) : undefined;
  const dealThread =
    anyThread && Boolean(anyThread.loan) === (deal?.mode === 'loan') ? anyThread : undefined;
  const clubAgreed =
    dealThread?.stage === 'player' &&
    (dealThread.status === 'countered' || dealThread.status === 'rejected');
  const pending = c.offers.filter((o) => needsAction(o) || o.status === 'pending').length;
  const actionCount = c.offers.filter(needsAction).length;
  const shortlisted = c.shortlist
    .map((id) => world.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p) && c.players[p!.id]?.clubId !== c.clubId);
  const pageRows = filtered.slice(page * 20, page * 20 + 20);
  const marketPlayer = pageRows.find((p) => p.id === marketFocus) ?? pageRows[0];
  const shortlistPlayer = shortlisted.find((p) => p.id === shortlistFocus) ?? shortlisted[0];
  const seasonYears = Array.from({ length: 6 }, (_, i) => c.season + i);

  const loanReq: LoanRequest | undefined =
    deal && deal.mode === 'loan'
      ? {
          months: deal.months,
          wagePct: deal.wagePct,
          fee: deal.fee,
          bonus: deal.bonus,
          ...(deal.clause === 'option' ? { option: deal.option } : {}),
          ...(deal.clause === 'obligation'
            ? { obligation: { fee: deal.obligationFee, games: deal.obligationGames } }
            : {}),
        }
      : undefined;
  const loanAssessment =
    deal && loanReq
      ? loanOutlook(c, world, deal.player, deal.fee, loanReq, deal.bonus, dealThread?.ask)
      : undefined;
  const outlook =
    deal &&
    (loanAssessment ??
      negotiationOutlook(
          c,
          world,
          deal.player,
          deal.fee,
          deal.wage,
          deal.exchange || undefined,
          deal.years,
          deal.bonus,
          dealThread?.ask,
          deal.rights,
          deal.sellOn,
        ));
  const loanBase = deal && loanReq ? loanAsk(c, world, deal.player, deal.months) : undefined;
  const commission = deal ? commissionOf(deal.player.id, deal.fee) : 0;
  const dealAgent = deal ? agentOf(deal.player.id) : undefined;
  const loanWages = deal ? (deal.wagePct / 100) * c.players[deal.player.id].wage * deal.months : 0;
  const exchangePlayer = deal?.exchange
    ? world.players.find((p) => p.id === deal.exchange)
    : undefined;
  const totalCost = deal
    ? deal.fee +
      deal.bonus +
      commission +
      (deal.mode === 'loan' ? loanWages : deal.wage * 12 * deal.years)
    : 0;
  const purchaseOptions = world.players.flatMap((player) => {
    const option = loanOptionFor(c, player.id);
    return option ? [{ player, option }] : [];
  });
  const relevantSellOns = c.living.sellOns.filter(
    (claim) => claim.clubId === c.clubId || c.players[claim.playerId]?.clubId === c.clubId,
  );
  const update = (patch: Partial<Deal>) => setDeal((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="screen-enter transfers-screen">
      <SectionTitle
        kicker="TRANSFERÊNCIAS / O MERCADO SE MOVE"
        title="A próxima peça do seu plano."
      >
        <span className={`status-pill ${open ? 'open' : ''}`}>
          {open ? 'JANELA ABERTA' : 'JANELA FECHADA'} · {money(finance.transferBudget)} disponíveis
        </span>
      </SectionTitle>
      <div className="segmented">
        <button className={view === 'market' ? 'active' : ''} onClick={() => setView('market')}>
          <Search size={16} /> Mercado
        </button>
        <button
          className={view === 'shortlist' ? 'active' : ''}
          onClick={() => setView('shortlist')}
        >
          <Star size={16} /> Observados <span className="count">{shortlisted.length}</span>
        </button>
        <button
          className={view === 'negotiations' ? 'active' : ''}
          onClick={() => {
            setView('negotiations');
            setInside(false);
          }}
        >
          <MessageSquare size={16} /> Negociações{' '}
          <span
            className={`count ${actionCount ? 'attention' : ''}`}
            aria-label={`${pending} em andamento${actionCount ? `, ${actionCount} exigem resposta` : ''}`}
          >
            {pending}
            {actionCount ? ` · ${actionCount} !` : ''}
          </span>
        </button>
        <button
          className={view === 'accounts' ? 'active' : ''}
          onClick={() => setView('accounts')}
        >
          <Wallet size={16} /> Contas
        </button>
      </div>
      {deal && outlook && (
        <Modal
          title={`Mesa de negociação · ${deal.player.name}`}
          onClose={() => setDeal(null)}
          wide
          className="deal-desk"
        >
          <div className="deal-room">
            <aside className="deal-target">
              <div
                className={`deal-card pos-${deal.player.position} ${cardTier(overall(deal.player, deal.player.position, c.players[deal.player.id]))}`}
              >
                <span className="deal-ovr">
                  {overall(deal.player, deal.player.position, c.players[deal.player.id])}
                </span>
                <span className="deal-pos">{deal.player.position}</span>
                <Badge club={clubById(world, c.players[deal.player.id].clubId!)} />
                <PlayerFace player={deal.player} size="lg" className="deal-face" />
                <strong>{deal.player.name}</strong>
                <small>
                  {ageAt(deal.player.birthDate, c.date)} anos · {deal.player.nationality}
                </small>
              </div>
              <dl className="deal-facts">
                <div>
                  <dt>Clube</dt>
                  <dd>{clubName(deal.player)}</dd>
                </div>
                <div>
                  <dt>Valor de mercado</dt>
                  <dd>{money(marketValue(c, deal.player))}</dd>
                </div>
                <div>
                  <dt>Salário atual</dt>
                  <dd>{money(c.players[deal.player.id].wage)}</dd>
                </div>
                <div>
                  <dt>Contrato até</dt>
                  <dd>{dateLabel(c.players[deal.player.id].contractEnd)}</dd>
                </div>
                <div>
                  <dt>Scouting</dt>
                  <dd>{scoutReport(c, deal.player)}</dd>
                </div>
                <MarketFacts c={c} world={world} p={deal.player} />
              </dl>
              <button
                className={c.shortlist.includes(deal.player.id) ? 'active' : ''}
                onClick={() => onShortlist(deal.player.id)}
              >
                <Star size={16} />
                {c.shortlist.includes(deal.player.id) ? 'Observado' : 'Observar'}
              </button>
              <div className="button-row">
                {c.players[deal.player.id].contractEnd > c.date &&
                  c.players[deal.player.id].contractEnd <= addMonths(c.date, 6) && (
                  <button
                    onClick={() => {
                      onPrecontract(deal.player.id, requiredWage(c, deal.player));
                      setDeal(null);
                    }}
                  >
                    Assinar pré-contrato · {money(requiredWage(c, deal.player))}/mês
                  </button>
                )}
                {open && c.players[deal.player.id].clause && !c.players[deal.player.id].loanFrom && (
                  <button
                    onClick={() => {
                      onClause(deal.player.id);
                      setDeal(null);
                    }}
                  >
                    Acionar multa · {money(c.players[deal.player.id].clause!)}
                  </button>
                )}
              </div>
            </aside>
            <section className="deal-table">
              <div className="segmented compact deal-mode" role="group" aria-label="Tipo de operação">
                <button
                  className={deal.mode === 'buy' ? 'active' : ''}
                  aria-pressed={deal.mode === 'buy'}
                  onClick={() => {
                    startDeal(deal.player, { mode: 'buy', fee: marketValue(c, deal.player) });
                  }}
                >
                  Compra
                </button>
                <button
                  className={deal.mode === 'loan' ? 'active' : ''}
                  aria-pressed={deal.mode === 'loan'}
                  disabled={Boolean(c.players[deal.player.id].loanFrom)}
                  onClick={() => {
                    startDeal(deal.player, {
                      mode: 'loan',
                      fee: loanAsk(c, world, deal.player, deal.months).fee,
                      bonus: 0,
                    });
                  }}
                >
                  Empréstimo
                </button>
              </div>
              <div className="deal-steps" role="tablist">
                <button
                  role="tab"
                  aria-selected={step === 'club'}
                  className={step === 'club' ? 'active' : ''}
                  onClick={() => {
                    setStep('club');
                    setPickExchange(false);
                  }}
                >
                  <span>1</span> Acordo com o clube
                </button>
                <ChevronRight size={18} />
                <button
                  role="tab"
                  aria-selected={step === 'player'}
                  className={step === 'player' ? 'active' : ''}
                  onClick={() => {
                    setStep('player');
                    setPickExchange(false);
                  }}
                >
                  <span>2</span> {deal.mode === 'loan' ? 'Aceite do atleta' : 'Contrato do jogador'}
                </button>
              </div>
              {step === 'club' && clubAgreed && (
                <div className="deal-step">
                  <div className="call-bubble">
                    <Badge club={clubById(world, c.players[deal.player.id].clubId!)} size="small" />
                    <p>
                      {`"Acordo fechado em ${money(dealThread!.fee)}. Agora é com ${dealAgent!.name}, empresário de ${deal.player.name}."`}
                    </p>
                  </div>
                  <button className="primary" onClick={() => setStep('player')}>
                    Contrato do jogador <ChevronRight size={17} />
                  </button>
                </div>
              )}
              {step === 'club' && !clubAgreed && deal.mode === 'loan' && loanBase && (
                <div className="deal-step">
                  <div className="call-bubble">
                    <Badge club={clubById(world, c.players[deal.player.id].clubId!)} size="small" />
                    <p>
                      {loanAssessment?.blocked
                        ? `"${loanAssessment.blocked}"`
                        : dealThread?.status === 'countered' && dealThread.counter?.fee !== undefined
                          ? `"Para emprestar: ${money(dealThread.counter.fee)} de taxa${dealThread.counter.loan ? ` · ${loanTermsLabel(dealThread.counter.loan)}` : ''}."`
                          : `"Emprestamos se pagarem ao menos ${loanBase.wagePct}% do salário e uma taxa justa."`}
                    </p>
                  </div>
                  <ChipGroup
                    label="Duração"
                    value={String(deal.months)}
                    options={[3, 6, 12].map((m) => ({ value: String(m), label: `${m} meses` }))}
                    onChange={(v) => update({ months: Number(v) })}
                  />
                  <NumberStepper
                    label="Taxa de empréstimo"
                    value={deal.fee}
                    min={0}
                    max={finance.transferBudget}
                    step={50000}
                    onChange={(v) => update({ fee: v ?? 0 })}
                    format={(v) => money(v)}
                  />
                  <ChipGroup
                    label="Salário pago por nós"
                    value={String(deal.wagePct)}
                    options={[0, 25, 50, 60, 75, 100].map((v) => ({ value: String(v), label: `${v}%` }))}
                    onChange={(v) => update({ wagePct: Number(v) })}
                  />
                  <ChipGroup
                    label="Compra ao fim"
                    value={deal.clause}
                    options={[
                      { value: 'none', label: 'Sem cláusula' },
                      { value: 'option', label: 'Opção' },
                      { value: 'obligation', label: 'Obrigação' },
                    ]}
                    onChange={(v) => update({ clause: v as Deal['clause'] })}
                  />
                  {deal.clause === 'option' && (
                    <NumberStepper
                      label={`Valor da opção (pedida ${money(loanBase.option)})`}
                      value={deal.option}
                      min={0}
                      step={100000}
                      onChange={(v) => update({ option: v ?? 0 })}
                      format={(v) => money(v)}
                    />
                  )}
                  {deal.clause === 'obligation' && (
                    <>
                      <NumberStepper
                        label={`Valor da obrigação (pedida ${money(loanBase.obligation)})`}
                        value={deal.obligationFee}
                        min={0}
                        step={100000}
                        onChange={(v) => update({ obligationFee: v ?? 0 })}
                        format={(v) => money(v)}
                      />
                      <NumberStepper
                        label="Jogos para a obrigação"
                        value={deal.obligationGames}
                        min={1}
                        max={40}
                        onChange={(v) => update({ obligationGames: v ?? 15 })}
                      />
                    </>
                  )}
                  <LikelihoodMeter label="Clube" value={outlook.club} />
                  <button className="primary" onClick={() => setStep('player')}>
                    Próximo: aceite do atleta <ChevronRight size={17} />
                  </button>
                </div>
              )}
              {step === 'club' && !clubAgreed && deal.mode === 'buy' && !pickExchange && (
                <div className="deal-step">
                  <div className="call-bubble">
                    <Badge club={clubById(world, c.players[deal.player.id].clubId!)} size="small" />
                    <p>
                      {dealThread?.status === 'countered' && dealThread.counter?.fee !== undefined
                        ? `"Nosso pedido continua: ${money(dealThread.counter.fee)}. Melhore e conversamos."`
                        : c.difficulty === 'Profissional'
                          ? `"${deal.player.name} é peça importante aqui. Traga um número sério."`
                          : `"Por menos de ${money(outlook.minimum)}${deal.exchange ? ' (somando a troca)' : ''} não liberamos ${deal.player.name}."`}
                    </p>
                  </div>
                  <NumberStepper
                    label="Taxa de transferência"
                    value={deal.fee}
                    min={0}
                    max={finance.transferBudget}
                    onChange={(v) => update({ fee: v ?? 0 })}
                    format={(v) => money(v)}
                  />
                  <div className="quick-chips">
                    {[
                      ['Valor de mercado', marketValue(c, deal.player)],
                      ['−10%', deal.fee * 0.9],
                      ['+10%', deal.fee * 1.1],
                      ['Orçamento total', finance.transferBudget],
                    ].map(([label, value]) => (
                      <button
                        key={label as string}
                        onClick={() =>
                          update({
                            fee: Math.min(
                              finance.transferBudget,
                              Math.round((value as number) / 10000) * 10000,
                            ),
                          })
                        }
                      >
                        {label as string}
                      </button>
                    ))}
                  </div>
                  <div className="exchange-slot">
                    <span className="control-label">Jogador na troca</span>
                    <button onClick={() => setPickExchange(true)}>
                      <ArrowLeftRight size={16} />
                      {exchangePlayer
                        ? `${exchangePlayer.name} · ${money(marketValue(c, exchangePlayer))}`
                        : 'Incluir atleta do elenco'}
                    </button>
                    {exchangePlayer && (
                      <button className="text-button" onClick={() => update({ exchange: '' })}>
                        <UserRoundX size={15} /> Remover
                      </button>
                    )}
                  </div>
                  <ChipGroup
                    label="Direitos econômicos comprados"
                    value={String(deal.rights)}
                    options={[50, 60, 70, 80, 90, 100].map((v) => ({
                      value: String(v),
                      label: `${v}%`,
                    }))}
                    onChange={(v) => update({ rights: Number(v) })}
                  />
                  <ChipGroup
                    label="Sell-on ao vendedor (% da futura venda)"
                    value={String(deal.sellOn)}
                    options={[0, 5, 10, 15, 20, 30].map((v) => ({
                      value: String(v),
                      label: `${v}%`,
                    }))}
                    onChange={(v) => update({ sellOn: Number(v) })}
                  />
                  <LikelihoodMeter label="Clube" value={outlook.club} />
                  <button className="primary" onClick={() => setStep('player')}>
                    Próximo: contrato do jogador <ChevronRight size={17} />
                  </button>
                </div>
              )}
              {step === 'club' && pickExchange && (
                <div className="deal-step exchange-picker">
                  <div className="card-scroll">
                    <div className="card-grid">
                      <button
                        type="button"
                        className="player-card empty"
                        data-autofocus=""
                        onClick={() => {
                          update({ exchange: '' });
                          setPickExchange(false);
                        }}
                      >
                        <UserRoundX size={28} />
                        <strong className="pc-name">Sem troca</strong>
                      </button>
                      {squad(c, world)
                        .sort(byPosition(c))
                        .map((p) => (
                          <PlayerCard
                            key={p.id}
                            player={p}
                            career={c}
                            active={deal.exchange === p.id}
                            note={money(marketValue(c, p))}
                            onClick={() => {
                              update({ exchange: p.id });
                              setPickExchange(false);
                            }}
                          />
                        ))}
                    </div>
                  </div>
                </div>
              )}
              {step === 'player' && deal.mode === 'loan' && (
                <div className="deal-step">
                  <div className="call-bubble agent">
                    <span className="agent-avatar">AG</span>
                    <p>
                      {dealThread?.status === 'countered' && dealThread.counter?.bonus !== undefined
                        ? `"${deal.player.name} só vai com luvas de ${money(dealThread.counter.bonus)}."`
                        : `"Sou ${dealAgent!.name} (influência ${dealAgent!.influence}/5). Comissão de ${dealAgent!.commission}% sobre a taxa: ${money(commission)}. Se não houver minutos, ele pede luvas de ${money(loanBonusAsk(c, deal.player))}."`}
                    </p>
                  </div>
                  <NumberStepper
                    label="Luvas (bônus de empréstimo)"
                    value={deal.bonus}
                    min={0}
                    max={Math.max(0, finance.cash - deal.fee)}
                    onChange={(v) => update({ bonus: v ?? 0 })}
                    format={(v) => money(v)}
                  />
                  <LikelihoodMeter label="Jogador" value={outlook.player} />
                </div>
              )}
              {step === 'player' && deal.mode === 'buy' && (
                <div className="deal-step">
                  <p className="muted agent-line">
                    Empresário: {dealAgent!.name} · influência {dealAgent!.influence}/5 · comissão{' '}
                    {dealAgent!.commission}% ({money(commission)})
                  </p>
                  <div className="call-bubble agent">
                    <span className="agent-avatar">AG</span>
                    <p>
                      {dealThread?.status === 'countered' && dealThread.counter?.wage !== undefined
                        ? `"Fechamos com ${money(dealThread.counter.wage)} por mês. Luvas também contam."`
                        : c.difficulty === 'Profissional'
                          ? '"Meu cliente quer ser valorizado. Salário e luvas contam."'
                          : `"Para sair, ele quer pelo menos ${money(requiredWage(c, deal.player))} por mês — luvas ajudam."`}
                    </p>
                  </div>
                  <NumberStepper
                    label="Salário mensal"
                    value={deal.wage}
                    min={1000}
                    onChange={(v) => update({ wage: v ?? 1000 })}
                    format={(v) => money(v)}
                  />
                  <ChipGroup
                    label="Duração do contrato"
                    value={String(deal.years)}
                    options={[1, 2, 3, 4, 5].map((y) => ({
                      value: String(y),
                      label: `${y} ${y === 1 ? 'ano' : 'anos'}`,
                    }))}
                    onChange={(v) => update({ years: Number(v) })}
                  />
                  <NumberStepper
                    label="Luvas (bônus de assinatura)"
                    value={deal.bonus}
                    min={0}
                    max={Math.max(0, finance.cash - deal.fee)}
                    onChange={(v) => update({ bonus: v ?? 0 })}
                    format={(v) => money(v)}
                  />
                  <LikelihoodMeter label="Jogador" value={outlook.player} />
                </div>
              )}
            </section>
            <aside className="deal-summary">
              <p className="eyebrow">RESUMO FINANCEIRO</p>
              <dl>
                <div>
                  <dt>Orçamento</dt>
                  <dd>{money(finance.transferBudget)}</dd>
                </div>
                <div>
                  <dt>Caixa</dt>
                  <dd>{money(finance.cash)}</dd>
                </div>
                <div>
                  <dt>Taxa</dt>
                  <dd>{money(deal.fee)}</dd>
                </div>
                <div>
                  <dt>Luvas</dt>
                  <dd>{money(deal.bonus)}</dd>
                </div>
                <div>
                  <dt>Comissão ({dealAgent!.commission}%)</dt>
                  <dd>{money(commission)}</dd>
                </div>
                {deal.mode === 'loan' ? (
                  <div>
                    <dt>
                      Salários ({deal.months}m · {deal.wagePct}%)
                    </dt>
                    <dd>{money(loanWages)}</dd>
                  </div>
                ) : (
                  <>
                    <div>
                      <dt>Direitos / sell-on</dt>
                      <dd>
                        {deal.rights}% / {deal.sellOn}%
                      </dd>
                    </div>
                    <div>
                      <dt>Salários ({deal.years}a)</dt>
                      <dd>{money(deal.wage * 12 * deal.years)}</dd>
                    </div>
                  </>
                )}
                <div className="total">
                  <dt>Custo total</dt>
                  <dd>{money(totalCost)}</dd>
                </div>
                <div className={finance.transferBudget - deal.fee < 0 ? 'negative' : ''}>
                  <dt>Saldo p/ contratar</dt>
                  <dd>{money(finance.transferBudget - deal.fee)}</dd>
                </div>
              </dl>
              <LikelihoodMeter label="Clube" value={outlook.club} />
              <LikelihoodMeter label="Jogador" value={outlook.player} />
              <button
                className="primary send-offer"
                disabled={!open}
                onClick={() => {
                  const sent = loanReq
                    ? onLoan(deal.player.id, loanReq)
                    : onOffer(deal.player.id, deal.fee, deal.wage, deal.exchange || undefined, {
                        years: deal.years,
                        bonus: deal.bonus,
                        rights: deal.rights,
                        sellOn: deal.sellOn,
                      });
                  if (sent) {
                    setDeal(null);
                    setSelected(deal.player.id);
                    setView('negotiations');
                  }
                }}
              >
                <Send size={17} />{' '}
                {!open
                  ? 'Janela fechada'
                  : dealThread
                    ? 'Enviar contraproposta'
                    : deal.mode === 'loan'
                      ? 'Pedir empréstimo'
                      : 'Enviar proposta'}
              </button>
              <small className="muted">Resposta amanhã. B fecha a sala.</small>
            </aside>
          </div>
        </Modal>
      )}
      {view === 'market' && (
        <div className="market-layout">
          <aside className="panel filter-panel">
            <h2>Foco de recrutamento</h2>
            <div className="filter-scroll">
              <label>
                Nome
                <input
                  placeholder="Quem você procura?"
                  value={filters.name}
                  onChange={(e) => filter('name', e.target.value)}
                />
              </label>
              <OptionCycler
                label="Clube"
                value={filters.club}
                options={[
                  { value: '', label: 'Todos os clubes' },
                  ...[...world.clubs]
                    .filter((club) => club.id !== c.clubId)
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                    .map((club) => ({ value: club.id, label: club.name })),
                ]}
                onChange={(v) => filter('club', v)}
              />
              <ChipGroup
                label="Divisão"
                value={filters.league}
                options={[
                  { value: '', label: 'Todas' },
                  { value: 'A', label: 'Série A' },
                  { value: 'B', label: 'Série B' },
                ]}
                onChange={(v) => filter('league', v)}
              />
              <OptionCycler
                label="Posição"
                value={filters.position}
                options={[
                  { value: '', label: 'Todas as posições' },
                  ...positions.map((p) => ({ value: p as string, label: p })),
                ]}
                onChange={(v) => filter('position', v)}
              />
              <div className="filter-pairs">
                <NumberStepper
                  label="Idade mín."
                  optional
                  min={15}
                  max={45}
                  step={1}
                  value={filters.minAge}
                  onChange={(v) => filter('minAge', v)}
                />
                <NumberStepper
                  label="Idade máx."
                  optional
                  min={15}
                  max={45}
                  step={1}
                  value={filters.maxAge}
                  onChange={(v) => filter('maxAge', v)}
                />
                <NumberStepper
                  label="OVR mín."
                  optional
                  min={1}
                  max={99}
                  step={1}
                  value={filters.minOvr}
                  onChange={(v) => filter('minOvr', v)}
                />
                <NumberStepper
                  label="OVR máx."
                  optional
                  min={1}
                  max={99}
                  step={1}
                  value={filters.maxOvr}
                  onChange={(v) => filter('maxOvr', v)}
                />
                <NumberStepper
                  label="Potencial mín."
                  optional
                  min={1}
                  max={99}
                  step={1}
                  value={filters.minPotential}
                  onChange={(v) => filter('minPotential', v)}
                />
                <NumberStepper
                  label="Valor máx."
                  optional
                  min={0}
                  step={500000}
                  value={filters.maxValue}
                  onChange={(v) => filter('maxValue', v)}
                  format={(v) => money(v)}
                />
                <NumberStepper
                  label="Salário máx."
                  optional
                  min={0}
                  step={10000}
                  value={filters.maxWage}
                  onChange={(v) => filter('maxWage', v)}
                  format={(v) => money(v)}
                />
              </div>
              <ChipGroup
                label="Pé"
                value={filters.foot}
                options={[
                  { value: '', label: 'Todos' },
                  { value: 'D', label: 'Direito' },
                  { value: 'E', label: 'Esquerdo' },
                  { value: 'A', label: 'Ambos' },
                ]}
                onChange={(v) => filter('foot', v)}
              />
              <OptionCycler
                label="Contrato termina até"
                value={filters.contract}
                options={[
                  { value: '', label: 'Qualquer data' },
                  ...seasonYears.map((y) => ({ value: `${y}-12-31`, label: `Dez/${y}` })),
                ]}
                onChange={(v) => filter('contract', v)}
              />
              <label>
                Nacionalidade
                <input
                  placeholder="Ex.: Argentina"
                  value={filters.nationality}
                  onChange={(e) => filter('nationality', e.target.value)}
                />
              </label>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setFilters(initialFilters);
                setPage(0);
              }}
            >
              Limpar filtros
            </button>
          </aside>
          <section className="panel market-results">
            <div className="panel-heading">
              <h2>{filtered.length} jogadores encontrados</h2>
              <small>Valor de mercado ≠ preço pedido · ★ observado</small>
            </div>
            <div className="market-table">
              <div className="market-table-head">
                <span>JOGADOR</span>
                <span>SCOUTING</span>
                <span>VALOR</span>
                <span>SALÁRIO/MÊS</span>
              </div>
              {pageRows.map((p) => (
                <button
                  className={`market-row ${marketPlayer?.id === p.id ? 'focused' : ''}`}
                  key={p.id}
                  data-market-player={p.id}
                  aria-current={marketPlayer?.id === p.id ? 'true' : undefined}
                  onFocus={() => setMarketFocus(p.id)}
                  onMouseEnter={() => setMarketFocus(p.id)}
                  onClick={() => startDeal(p)}
                >
                  <span>
                    <span className="position-tag">{p.position}</span>
                    <PlayerFace
                      player={p}
                      size="sm"
                      className={`face-tier ${cardTier(overall(p, p.position, c.players[p.id]))}`}
                    />
                    <span>
                      <strong>
                        {c.shortlist.includes(p.id) && <Star size={13} className="star-on" />}{' '}
                        {p.name}
                      </strong>
                      <small>
                        {clubName(p)} · {ageAt(p.birthDate, c.date)} anos · OVR{' '}
                        {overall(p, p.position, c.players[p.id])}
                      </small>
                    </span>
                  </span>
                  <span className="scouting-label">{scoutReport(c, p)}</span>
                  <strong>{money(marketValue(c, p))}</strong>
                  <span>{money(c.players[p.id].wage)}</span>
                </button>
              ))}
            </div>
            {!filtered.length && (
              <p className="empty-state">
                Nenhum atleta atende a todos os critérios. Ajuste os filtros.
              </p>
            )}
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}
              </span>
              <button
                disabled={(page + 1) * 20 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </button>
            </div>
          </section>
          <ScoutReportPanel
            player={marketPlayer}
            career={c}
            world={world}
            title="RELATÓRIO DO OLHEIRO"
            onNegotiate={(p) => startDeal(p)}
            onShortlist={onShortlist}
          />
        </div>
      )}
      {view === 'shortlist' && (
        <div className="shortlist-layout">
          <section className="panel shortlist-panel">
            <div className="panel-heading">
              <h2>Lista de observação</h2>
              <small>Abra um atleta no mercado e marque ★ para acompanhar.</small>
            </div>
            {shortlisted.length ? (
              <div className="card-scroll">
                <div className="card-grid">
                  {shortlisted.map((p, i) => (
                    <div
                      key={p.id}
                      className={`shortlist-slot ${shortlistPlayer?.id === p.id ? 'focused' : ''}`}
                      onFocus={() => setShortlistFocus(p.id)}
                      onMouseEnter={() => setShortlistFocus(p.id)}
                    >
                      <PlayerCard
                        player={p}
                        career={c}
                        autoFocus={i === 0}
                        badge={<Badge club={clubById(world, c.players[p.id].clubId!)} size="small" />}
                        accessibilityNote={`${clubName(p)}, valor ${money(marketValue(c, p))}. Negociar`}
                        onClick={() => startDeal(p)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <Star size={34} />
                <h2>Nenhum alvo marcado.</h2>
                <p>Use o mercado para encontrar e observar jogadores.</p>
                <button type="button" className="primary" onClick={() => setView('market')}>
                  <Search size={16} /> Ir ao Mercado
                </button>
              </div>
            )}
          </section>
          {shortlisted.length > 0 && (
            <ScoutReportPanel
              player={shortlistPlayer}
              career={c}
              world={world}
              title="ALVO OBSERVADO"
              onNegotiate={(p) => startDeal(p)}
              onShortlist={(id) => {
                const index = shortlisted.findIndex((p) => p.id === id);
                const next = shortlisted[index + 1] ?? shortlisted[index - 1];
                onShortlist(id);
                setShortlistFocus(next?.id ?? '');
                requestAnimationFrame(() =>
                  (next
                    ? document.querySelector<HTMLElement>(
                        `.shortlist-slot [data-player="${next.id}"]`,
                      )
                    : null
                  )?.focus(),
                );
              }}
              shortlistLabel="Remover dos observados"
            />
          )}
        </div>
      )}
      {view === 'accounts' && (
        <div className="market-accounts">
          <section className="panel">
            <h2>Opções de compra</h2>
            <p className="muted small">
              Atletas emprestados com opção podem ser comprados pelo valor acordado.
            </p>
            {purchaseOptions.length ? (
              <div className="market-account-list">
                {purchaseOptions.map(({ player, option }) => (
                  <div className="market-account-row" key={player.id}>
                    <span>
                      <strong>{player.name}</strong>
                      <small>
                        {partyName(world, option.owner)} · {money(option.fee)}
                        {option.expires ? ` · até ${dateLabel(option.expires)}` : ''}
                      </small>
                    </span>
                    <button onClick={() => onExerciseOption(player.id)}>Exercer opção</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhuma opção de compra disponível.</p>
            )}
          </section>
          <section className="panel">
            <h2>Cláusulas de futura venda</h2>
            <p className="muted small">
              Percentuais que nosso clube receberá ou deverá repassar quando houver uma venda.
            </p>
            {relevantSellOns.length ? (
              <div className="market-account-list">
                {relevantSellOns.map((claim, index) => (
                  <div className="market-account-row" key={`${claim.playerId}-${claim.clubId}-${index}`}>
                    <span>
                      <strong>{world.players.find((player) => player.id === claim.playerId)?.name ?? claim.playerId}</strong>
                      <small>
                        {claim.clubId === c.clubId
                          ? 'A receber na próxima venda'
                          : `A repassar a ${partyName(world, claim.clubId)}`}
                      </small>
                    </span>
                    <strong>{claim.pct}%</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhuma cláusula pendente.</p>
            )}
          </section>
          <section className="panel market-ledger">
            <h2>Repasses do mercado</h2>
            <p className="muted small">
              Histórico de solidariedade, direitos, comissões e empréstimos do clube.
            </p>
            {c.living.ledger.length ? (
              <div className="market-account-list">
                {[...c.living.ledger].reverse().map((entry, index) => (
                  <div className="market-account-row" key={`${entry.date}-${entry.playerId}-${index}`}>
                    <span>
                      <strong>{ledgerLabel[entry.kind]} · {world.players.find((player) => player.id === entry.playerId)?.name ?? entry.playerId}</strong>
                      <small>
                        {dateLabel(entry.date)} · {partyName(world, entry.from)} → {partyName(world, entry.to)}
                      </small>
                    </span>
                    <strong>{entry.to === c.clubId ? '+' : '−'} {money(entry.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Nenhum repasse registrado.</p>
            )}
          </section>
        </div>
      )}
      {view === 'negotiations' &&
        (current ? (
          <div className="negotiations-layout">
            <aside className="panel thread-list">
              <h2>Conversas</h2>
              <div className="thread-scroll">
                {threads.map((o, i) => {
                  const p = world.players.find((p) => p.id === o.playerId)!;
                  const other = clubById(world, o.incoming ? o.fromClubId : o.toClubId);
                  const thread = threadOf(o);
                  return (
                    <button
                      key={o.id}
                      className={`thread-item ${o.id === current.id ? 'active' : ''} ${needsAction(o) ? 'attention' : ''}`}
                      data-autofocus={i === 0 ? '' : undefined}
                      data-thread={o.id}
                      onClick={() => {
                        setSelected(o.id);
                        setInside(true);
                      }}
                    >
                      <Badge club={other} size="small" />
                      <PlayerFace player={p} size="sm" />
                      <span className="thread-text">
                        <strong>{p.name}</strong>
                        <small>
                          {o.incoming ? 'VENDA' : o.loan ? 'EMPRÉSTIMO' : 'COMPRA'} · {other.name}
                        </small>
                        <em>{thread[thread.length - 1].text}</em>
                      </span>
                      <span className={`thread-status s-${o.status}`}>{statusLabel(o)}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <ChatPanel
              key={current.id}
              offer={current}
              career={c}
              world={world}
              open={open}
              onRespond={onRespond}
              onAnswer={onAnswer}
              onAsk={onAsk}
              onCounter={() => openCounter(current)}
              inside={inside}
              onExit={() => {
                setInside(false);
                requestAnimationFrame(() =>
                  document.querySelector<HTMLElement>(`[data-thread="${current.id}"]`)?.focus(),
                );
              }}
            />
          </div>
        ) : (
          <section className="panel empty-state">
            <ArrowLeftRight size={35} />
            <h2>O mercado ainda está em silêncio.</h2>
            <p>Faça uma proposta ou avance os dias durante a janela.</p>
          </section>
        ))}
    </div>
  );
}
