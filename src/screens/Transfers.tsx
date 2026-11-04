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
  marketValue,
  negotiationOutlook,
  requiredWage,
  scoutReport,
  threadOf,
} from '../game/transfers';
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
};

const chance = (v: number) =>
  v >= 85
    ? 'Muito provável'
    : v >= 60
      ? 'Provável'
      : v >= 35
        ? 'Possível'
        : v >= 15
          ? 'Improvável'
          : 'Muito improvável';

function LikelihoodMeter({ label, value }: { label: string; value: number }) {
  const tone = value >= 60 ? 'good' : value >= 35 ? 'mid' : 'bad';
  return (
    <div className={`likelihood ${tone}`}>
      <span>
        {label} <b>{chance(value)}</b>
      </span>
      <div className="likelihood-bar">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < Math.round(value / 10) ? 'on' : ''} />
        ))}
      </div>
    </div>
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
  if (m.fee !== undefined) items.push(['Taxa', money(m.fee)]);
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
  const author = (m: NegotiationMessage) =>
    m.from === 'me' ? mine.name : m.from === 'agent' ? `Agente de ${p.name}` : other.name;
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
            <span className={offer.stage === 'player' ? 'active' : ''}>2 Contrato</span>
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
              {offer.stage === 'player' ? `Agente de ${p.name}` : other.name}
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
    terms: { years: number; bonus: number },
  ) => boolean;
  onAnswer: (id: string, accept: boolean) => void;
  onRespond: (id: string, accept: boolean) => void;
  onAsk: (id: string, fee: number) => void;
  onShortlist: (id: string) => void;
  onLoan: (id: string) => void;
  onPrecontract: (id: string, wage: number) => void;
  onClause: (id: string) => void;
}) {
  const [view, setView] = useState<'market' | 'shortlist' | 'negotiations'>('market');
  const [selected, setSelected] = useState('');
  const [inside, setInside] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [step, setStep] = useState<'club' | 'player'>('club');
  const [pickExchange, setPickExchange] = useState(false);
  const [page, setPage] = useState(0);
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
    setDeal({
      player: p,
      fee: previous?.fee ?? last?.fee ?? marketValue(c, p),
      wage: previous?.wage ?? last?.wage ?? Math.round((c.players[p.id].wage * 1.15) / 1000) * 1000,
      years: previous?.years ?? last?.years ?? 3,
      bonus: previous?.bonus ?? last?.bonus ?? 0,
      exchange: previous?.exchange ?? last?.exchangePlayerId ?? '',
    });
    setStep(last?.stage === 'player' ? 'player' : 'club');
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
  const dealThread = deal ? activeThread(c, deal.player.id) : undefined;
  const clubAgreed =
    dealThread?.stage === 'player' &&
    (dealThread.status === 'countered' || dealThread.status === 'rejected');
  const pending = c.offers.filter((o) => needsAction(o) || o.status === 'pending').length;
  const shortlisted = c.shortlist
    .map((id) => world.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p) && c.players[p!.id]?.clubId !== c.clubId);
  const seasonYears = Array.from({ length: 6 }, (_, i) => c.season + i);

  const outlook =
    deal &&
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
    );
  const exchangePlayer = deal?.exchange
    ? world.players.find((p) => p.id === deal.exchange)
    : undefined;
  const totalCost = deal ? deal.fee + deal.bonus + deal.wage * 12 * deal.years : 0;
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
          <MessageSquare size={16} /> Negociações <span className="count">{pending}</span>
        </button>
      </div>
      {deal && outlook && (
        <Modal title="Sala de negociação" onClose={() => setDeal(null)} wide>
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
                {open && !c.players[deal.player.id].loanFrom && (
                  <button
                    onClick={() => {
                      onLoan(deal.player.id);
                      setDeal(null);
                    }}
                  >
                    Pedir empréstimo · 6 meses
                  </button>
                )}
              </div>
            </aside>
            <section className="deal-table">
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
                  <span>2</span> Contrato do jogador
                </button>
              </div>
              {step === 'club' && clubAgreed && (
                <div className="deal-step">
                  <div className="call-bubble">
                    <Badge club={clubById(world, c.players[deal.player.id].clubId!)} size="small" />
                    <p>
                      {`"Acordo fechado em ${money(dealThread!.fee)}. Agora é com o agente de ${deal.player.name}."`}
                    </p>
                  </div>
                  <button className="primary" onClick={() => setStep('player')}>
                    Contrato do jogador <ChevronRight size={17} />
                  </button>
                </div>
              )}
              {step === 'club' && !clubAgreed && !pickExchange && (
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
              {step === 'player' && (
                <div className="deal-step">
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
                  <dt>Salários ({deal.years}a)</dt>
                  <dd>{money(deal.wage * 12 * deal.years)}</dd>
                </div>
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
                  const sent = onOffer(
                    deal.player.id,
                    deal.fee,
                    deal.wage,
                    deal.exchange || undefined,
                    {
                      years: deal.years,
                      bonus: deal.bonus,
                    },
                  );
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
              {filtered.slice(page * 20, page * 20 + 20).map((p) => (
                <button className="market-row" key={p.id} onClick={() => startDeal(p)}>
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
        </div>
      )}
      {view === 'shortlist' && (
        <section className="panel shortlist-panel">
          <div className="panel-heading">
            <h2>Lista de observação</h2>
            <small>Abra um atleta no mercado e marque ★ para acompanhar.</small>
          </div>
          {shortlisted.length ? (
            <div className="card-scroll">
              <div className="card-grid">
                {shortlisted.map((p, i) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    career={c}
                    autoFocus={i === 0}
                    badge={<Badge club={clubById(world, c.players[p.id].clubId!)} size="small" />}
                    note={money(marketValue(c, p))}
                    onClick={() => startDeal(p)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Star size={34} />
              <h2>Nenhum alvo marcado.</h2>
              <p>Use o mercado para encontrar e observar jogadores.</p>
            </div>
          )}
        </section>
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
                          {o.incoming ? 'VENDA' : 'COMPRA'} · {other.name}
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
