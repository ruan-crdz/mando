import { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, MessageSquare, Search, Send, X } from 'lucide-react';
import { type Career, type Player, positions, type World } from '../game/types';
import { askingPrice, marketValue, scoutReport } from '../game/transfers';
import { squad } from '../game/matches';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { transferWindow } from '../game/calendar';
import { Badge, dateLabel, Modal, money, SectionTitle } from '../components/ui';

const initialFilters = {
  name: '',
  club: '',
  league: '',
  position: '',
  minAge: '',
  maxAge: '',
  minOvr: '',
  maxOvr: '',
  minPotential: '',
  maxValue: '',
  maxWage: '',
  contract: '',
  foot: '',
  nationality: '',
};
export function Transfers({
  career: c,
  world,
  onOffer,
  onAnswer,
}: {
  career: Career;
  world: World;
  onOffer: (id: string, fee: number, wage: number, exchange?: string) => void;
  onAnswer: (id: string, accept: boolean) => void;
}) {
  const [view, setView] = useState<'search' | 'negotiations'>('search');
  const [filters, setFilters] = useState(initialFilters);
  const [selected, setSelected] = useState<Player | null>(null);
  const [fee, setFee] = useState(0);
  const [wage, setWage] = useState(0);
  const [exchange, setExchange] = useState('');
  const [page, setPage] = useState(0);
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
            (!filters.minAge || age >= Number(filters.minAge)) &&
            (!filters.maxAge || age <= Number(filters.maxAge)) &&
            (!filters.minOvr || ovr >= Number(filters.minOvr)) &&
            (!filters.maxOvr || ovr <= Number(filters.maxOvr)) &&
            (!filters.minPotential || p.potential >= Number(filters.minPotential)) &&
            (!filters.maxValue || marketValue(c, p) <= Number(filters.maxValue)) &&
            (!filters.maxWage || state.wage <= Number(filters.maxWage)) &&
            (!filters.contract || state.contractEnd <= filters.contract) &&
            (!filters.foot || p.foot === filters.foot) &&
            p.nationality.toLocaleLowerCase().includes(filters.nationality.toLocaleLowerCase())
          );
        })
        .sort((a, b) => overall(b) - overall(a)),
    [c, world, filters],
  );
  const filter = (key: keyof typeof initialFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };
  const open = (p: Player) => {
    setSelected(p);
    setFee(marketValue(c, p));
    setWage(Math.round(c.players[p.id].wage * 1.15));
    setExchange('');
  };
  return (
    <div className="screen-enter">
      <SectionTitle
        kicker="TRANSFERÊNCIAS / O MERCADO SE MOVE"
        title="A próxima peça do seu plano."
      >
        <span className={`status-pill ${transferWindow(c.date) ? 'open' : ''}`}>
          {transferWindow(c.date) ? 'JANELA ABERTA' : 'JANELA FECHADA'} ·{' '}
          {money(c.finances[c.clubId].transferBudget)} disponíveis
        </span>
      </SectionTitle>
      <div className="segmented">
        <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>
          <Search size={16} /> Buscar jogador
        </button>
        <button
          className={view === 'negotiations' ? 'active' : ''}
          onClick={() => setView('negotiations')}
        >
          <MessageSquare size={16} /> Negociações{' '}
          <span className="count">{c.offers.filter((o) => o.status === 'pending').length}</span>
        </button>
      </div>
      {view === 'search' ? (
        <div className="market-layout">
          <aside className="panel filter-panel">
            <h2>Foco de recrutamento</h2>
            <label>
              Nome
              <input
                placeholder="Quem você procura?"
                value={filters.name}
                onChange={(e) => filter('name', e.target.value)}
              />
            </label>
            <label>
              Clube
              <select value={filters.club} onChange={(e) => filter('club', e.target.value)}>
                <option value="">Todos os clubes</option>
                {world.clubs.map((club) => (
                  <option value={club.id} key={club.id}>
                    {club.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                Divisão
                <select value={filters.league} onChange={(e) => filter('league', e.target.value)}>
                  <option value="">Todas</option>
                  <option>A</option>
                  <option>B</option>
                </select>
              </label>
              <label>
                Posição
                <select
                  value={filters.position}
                  onChange={(e) => filter('position', e.target.value)}
                >
                  <option value="">Todas</option>
                  {positions.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['minAge', 'Idade mínima'],
                  ['maxAge', 'Idade máxima'],
                  ['minOvr', 'OVR mínimo'],
                  ['maxOvr', 'OVR máximo'],
                  ['minPotential', 'Potencial mínimo'],
                  ['maxValue', 'Valor máximo (R$)'],
                  ['maxWage', 'Salário máximo (R$)'],
                ] as const
              ).map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    type="number"
                    min={0}
                    value={filters[key]}
                    onChange={(e) => filter(key, e.target.value)}
                  />
                </label>
              ))}
              <label>
                Pé
                <select value={filters.foot} onChange={(e) => filter('foot', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="D">Direito</option>
                  <option value="E">Esquerdo</option>
                  <option value="A">Ambos</option>
                </select>
              </label>
            </div>
            <label>
              Contrato termina até
              <input
                type="text"
                placeholder="2027-12-31"
                value={filters.contract}
                onChange={(e) => filter('contract', e.target.value)}
              />
            </label>
            <label>
              Nacionalidade
              <input
                value={filters.nationality}
                onChange={(e) => filter('nationality', e.target.value)}
              />
            </label>
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
              <small>Valor de mercado ≠ preço pedido</small>
            </div>
            <div className="market-table">
              <div className="market-table-head">
                <span>JOGADOR</span>
                <span>SCOUTING</span>
                <span>VALOR</span>
                <span>SALÁRIO/MÊS</span>
              </div>
              {filtered.slice(page * 20, page * 20 + 20).map((p) => (
                <button className="market-row" key={p.id} onClick={() => open(p)}>
                  <span>
                    <span className="position-tag">{p.position}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {world.clubs.find((club) => club.id === c.players[p.id].clubId)?.name} ·{' '}
                        {ageAt(p.birthDate, c.date)} anos
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
      ) : (
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
            const other = world.clubs.find(
              (club) => club.id === (offer.incoming ? offer.fromClubId : offer.toClubId),
            )!;
            return (
              <section className="panel negotiation" key={offer.id}>
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
                <div className="chat-bubble">
                  <p>
                    {offer.incoming
                      ? `Temos interesse em ${p.name}. Oferecemos`
                      : `Nossa proposta por ${p.name} é de`}{' '}
                    <strong>{money(offer.fee, false)}</strong>
                    {offer.exchangePlayerId
                      ? ` mais ${world.players.find((p) => p.id === offer.exchangePlayerId)!.name}`
                      : ''}
                    .
                  </p>
                  <small>Salário proposto: {money(offer.wage)}/mês</small>
                </div>
                {offer.status === 'rejected' && (
                  <p className="muted">
                    O clube ou o agente recusou as condições. Dinheiro, troca e salário são
                    avaliados pela engine.
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
                  <button onClick={() => open(p)}>Enviar contraproposta</button>
                )}
              </section>
            );
          })}
        </div>
      )}
      {selected && (
        <Modal title={`Negociar · ${selected.name}`} onClose={() => setSelected(null)}>
          <div className="negotiation-player">
            <span className="position-tag">{selected.position}</span>
            <div>
              <h2>{selected.name}</h2>
              <p>
                {scoutReport(c, selected)} · Mercado: {money(marketValue(c, selected))}
              </p>
            </div>
          </div>
          <div className="chat-bubble">
            <p>
              {c.difficulty === 'Profissional'
                ? 'A informação de mercado é limitada. Monte uma proposta que faça sentido para o clube e o jogador.'
                : `Seu diretor estima que ${money(askingPrice(c, world, selected))} é uma boa referência. O agente também exige aumento salarial.`}
            </p>
          </div>
          <div className="form-grid">
            <label>
              Dinheiro (R$)
              <input
                type="number"
                min={0}
                step={100000}
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </label>
            <label>
              Salário mensal (R$)
              <input
                type="number"
                min={1}
                step={1000}
                value={wage}
                onChange={(e) => setWage(Number(e.target.value))}
              />
            </label>
            <label className="full">
              Incluir jogador na troca
              <select value={exchange} onChange={(e) => setExchange(e.target.value)}>
                <option value="">Sem troca de jogadores</option>
                {squad(c, world).map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} · {money(marketValue(c, p))}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted small">
            A resposta chega em dois dias. Valores e disponibilidade são revalidados antes de
            concluir. Contrato de três anos.
          </p>
          <button
            className="primary"
            disabled={!transferWindow(c.date)}
            onClick={() => onOffer(selected.id, fee, wage, exchange || undefined)}
          >
            <Send size={17} /> Enviar proposta
          </button>
        </Modal>
      )}
    </div>
  );
}
