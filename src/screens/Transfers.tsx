import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  Handshake,
  MessageSquare,
  Search,
  Send,
  Star,
  UserRoundX,
  X,
} from 'lucide-react';
import { type Career, type Player, positions, type World } from '../game/types';
import {
  askingPrice,
  marketValue,
  negotiationOutlook,
  requiredWage,
  scoutReport,
} from '../game/transfers';
import { squad } from '../game/matches';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { transferWindow } from '../game/calendar';
import { clubById } from '../game/npc';
import { Badge, dateLabel, Modal, money, SectionTitle } from '../components/ui';
import { ChipGroup, NumberStepper, OptionCycler } from '../components/controls';
import { byPosition, PlayerCard } from '../components/PlayerCard';

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

export function Transfers({
  career: c,
  world,
  onOffer,
  onAnswer,
  onShortlist,
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
  onShortlist: (id: string) => void;
}) {
  const [view, setView] = useState<'market' | 'shortlist' | 'negotiations'>('market');
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
    setDeal({
      player: p,
      fee: previous?.fee ?? marketValue(c, p),
      wage: previous?.wage ?? Math.round((c.players[p.id].wage * 1.15) / 1000) * 1000,
      years: previous?.years ?? 3,
      bonus: previous?.bonus ?? 0,
      exchange: previous?.exchange ?? '',
    });
    setStep('club');
    setPickExchange(false);
  };
  const pending = c.offers.filter((o) => o.status === 'pending').length;
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
    );
  const exchangePlayer = deal?.exchange ? world.players.find((p) => p.id === deal.exchange) : undefined;
  const totalCost = deal ? deal.fee + deal.bonus + deal.wage * 12 * deal.years : 0;
  const update = (patch: Partial<Deal>) => setDeal((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="screen-enter transfers-screen">
      <SectionTitle kicker="TRANSFERÊNCIAS / O MERCADO SE MOVE" title="A próxima peça do seu plano.">
        <span className={`status-pill ${open ? 'open' : ''}`}>
          {open ? 'JANELA ABERTA' : 'JANELA FECHADA'} · {money(finance.transferBudget)} disponíveis
        </span>
      </SectionTitle>
      <div className="segmented">
        <button className={view === 'market' ? 'active' : ''} onClick={() => setView('market')}>
          <Search size={16} /> Mercado
        </button>
        <button className={view === 'shortlist' ? 'active' : ''} onClick={() => setView('shortlist')}>
          <Star size={16} /> Observados <span className="count">{shortlisted.length}</span>
        </button>
        <button
          className={view === 'negotiations' ? 'active' : ''}
          onClick={() => setView('negotiations')}
        >
          <MessageSquare size={16} /> Negociações <span className="count">{pending}</span>
        </button>
      </div>
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
                <NumberStepper label="Idade mín." optional min={15} max={45} step={1} value={filters.minAge} onChange={(v) => filter('minAge', v)} />
                <NumberStepper label="Idade máx." optional min={15} max={45} step={1} value={filters.maxAge} onChange={(v) => filter('maxAge', v)} />
                <NumberStepper label="OVR mín." optional min={1} max={99} step={1} value={filters.minOvr} onChange={(v) => filter('minOvr', v)} />
                <NumberStepper label="OVR máx." optional min={1} max={99} step={1} value={filters.maxOvr} onChange={(v) => filter('maxOvr', v)} />
                <NumberStepper label="Potencial mín." optional min={1} max={99} step={1} value={filters.minPotential} onChange={(v) => filter('minPotential', v)} />
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
                    <span>
                      <strong>
                        {c.shortlist.includes(p.id) && <Star size={13} className="star-on" />} {p.name}
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
              <p className="empty-state">Nenhum atleta atende a todos os critérios. Ajuste os filtros.</p>
            )}
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span>
                {page + 1} / {Math.max(1, Math.ceil(filtered.length / 20))}
              </span>
              <button disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(page + 1)}>
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
      {view === 'negotiations' && (
        <div className="negotiations-grid">
          {!c.offers.length && (
            <section className="panel empty-state">
              <ArrowLeftRight size={35} />
              <h2>O mercado ainda está em silêncio.</h2>
              <p>Faça uma proposta ou avance os dias durante a janela.</p>
            </section>
          )}
          {[...c.offers].reverse().map((offer) => {
            const p = world.players.find((p) => p.id === offer.playerId)!;
            const other = clubById(world, offer.incoming ? offer.fromClubId : offer.toClubId);
            return (
              <section className={`panel negotiation status-${offer.status}`} key={offer.id}>
                <div className="panel-heading">
                  <Badge club={other} />
                  <span>
                    <strong>{other.name}</strong>
                    <small>
                      {dateLabel(offer.date)} · {offer.incoming ? 'RECEBIDA' : 'ENVIADA'}
                    </small>
                  </span>
                  <span className={`pill ${offer.status === 'completed' ? 'success' : ''}`}>
                    {
                      {
                        pending: 'Aguardando',
                        accepted: 'Aceita',
                        rejected: 'Recusada',
                        completed: 'Concluída',
                        declined: 'Encerrada',
                      }[offer.status]
                    }
                  </span>
                </div>
                <div className="deal-line">
                  <span className="position-tag">{p.position}</span>
                  <strong>{p.name}</strong>
                </div>
                <div className="deal-figures">
                  <span>
                    <small>TAXA</small>
                    <b>{money(offer.fee)}</b>
                  </span>
                  <span>
                    <small>SALÁRIO</small>
                    <b>{money(offer.wage)}</b>
                  </span>
                  {!offer.incoming && (
                    <span>
                      <small>CONTRATO</small>
                      <b>{offer.years || 3} anos</b>
                    </span>
                  )}
                  {offer.bonus ? (
                    <span>
                      <small>LUVAS</small>
                      <b>{money(offer.bonus)}</b>
                    </span>
                  ) : null}
                </div>
                {offer.exchangePlayerId && (
                  <p className="muted small">
                    + {world.players.find((p) => p.id === offer.exchangePlayerId)?.name} na troca
                  </p>
                )}
                {offer.status === 'pending' && offer.incoming && (
                  <div className="button-row">
                    <button className="primary" onClick={() => onAnswer(offer.id, true)}>
                      <Check size={16} /> Aceitar
                    </button>
                    <button onClick={() => onAnswer(offer.id, false)}>
                      <X size={16} /> Recusar
                    </button>
                  </div>
                )}
                {!offer.incoming && offer.status === 'rejected' && (
                  <button
                    onClick={() =>
                      startDeal(p, {
                        fee: offer.fee,
                        wage: offer.wage,
                        years: offer.years || 3,
                        bonus: offer.bonus || 0,
                        exchange: offer.exchangePlayerId || '',
                      })
                    }
                  >
                    <Handshake size={16} /> Contraproposta
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}
      {deal && outlook && (
        <Modal title="Sala de negociação" onClose={() => setDeal(null)} wide>
          <div className="deal-room">
            <aside className="deal-target">
              <div className={`deal-card pos-${deal.player.position}`}>
                <span className="deal-ovr">{overall(deal.player, deal.player.position, c.players[deal.player.id])}</span>
                <span className="deal-pos">{deal.player.position}</span>
                <Badge club={clubById(world, c.players[deal.player.id].clubId!)} />
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
              {step === 'club' && !pickExchange && (
                <div className="deal-step">
                  <div className="call-bubble">
                    <Badge club={clubById(world, c.players[deal.player.id].clubId!)} size="small" />
                    <p>
                      {c.difficulty === 'Profissional'
                        ? `"${deal.player.name} é peça importante aqui. Traga um número sério."`
                        : `"Abaixo de ${money(askingPrice(c, world, deal.player))} nem conversamos."`}
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
                      {c.difficulty === 'Profissional'
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
                  const sent = onOffer(deal.player.id, deal.fee, deal.wage, deal.exchange || undefined, {
                    years: deal.years,
                    bonus: deal.bonus,
                  });
                  if (sent) setDeal(null);
                }}
              >
                <Send size={17} /> {open ? 'Enviar proposta' : 'Janela fechada'}
              </button>
              <small className="muted">Resposta em 2 dias. B encerra a conversa.</small>
            </aside>
          </div>
        </Modal>
      )}
    </div>
  );
}
