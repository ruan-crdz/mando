import { useState } from 'react';
import {
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronRight,
  HeartPulse,
  Landmark,
  MapPinned,
  MessageSquare,
  Radar,
  Settings2,
  Square,
  Target,
  TrendingUp,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
  Voicemail,
  Volume2,
} from 'lucide-react';
import { type Career, type FacilityKind, type Living, type Message, type World } from '../game/types';
import { ClubPanel } from '../components/LivingPanels';
import { FacilitiesPanel, SponsorPanel, StadiumPanel } from '../components/FinancePanels';
import { economyOf, upkeep } from '../game/economy';
import {
  playVoice,
  stopVoice,
  useVoice,
  voiceAvailable,
  type VoiceItem,
  type VoiceRole,
} from '../components/voice';
import { squad } from '../game/matches';
import { standings } from '../game/engine';
import { competitionName } from '../game/calendar';
import { PortraitCamera } from '../components/PortraitCamera';
import { dateLabel, ManagerPortrait, Metric, Modal, money, SectionTitle } from '../components/ui';

const scoutRegions = ['Brasil', 'América do Sul', 'Europa'] as const;

const messageVoice: Record<Message['kind'], VoiceRole> = {
  board: 'president',
  finance: 'president',
  staff: 'staff',
  market: 'staff',
  player: 'player',
  news: 'narrator',
};

const messageKindLabel: Record<Message['kind'], string> = {
  board: 'DIRETORIA',
  finance: 'FINANÇAS',
  staff: 'COMISSÃO',
  market: 'MERCADO',
  player: 'ELENCO',
  news: 'NOTÍCIAS',
};

export function Office({
  career: c,
  world,
  onMessage,
  onRead,
  onAvatar,
  onApplyPlan,
  onHireScout,
  onFireScout,
  onReassignScout,
  onSignProspect,
  onAcceptJob,
  onDeclineJob,
  onLiving,
  onUpgradeAnalyst,
  onPrices,
  onSponsor,
  onWork,
  aiAvailable,
  busy,
}: {
  career: Career;
  world: World;
  onMessage: (id: string, choice: 'support' | 'firm') => void;
  onRead: (id: string) => void;
  onAvatar: (photo?: string) => void;
  onApplyPlan: (id: string) => void;
  onHireScout: (region: string) => void;
  onFireScout: (id: string) => void;
  onReassignScout: (id: string, region: string) => void;
  onSignProspect: (id: string) => void;
  onAcceptJob: (id: string) => void;
  onDeclineJob: (id: string) => void;
  onLiving: (patch: Partial<Living>) => void;
  onUpgradeAnalyst: () => void;
  onPrices: (patch: { ticket?: number; fee?: number }) => void;
  onSponsor: (index: number) => void;
  onWork: (kind: FacilityKind) => void;
  aiAvailable: boolean;
  busy: boolean;
}) {
  const [camera, setCamera] = useState(false);
  const [financeView, setFinanceView] = useState<'overview' | 'stadium' | 'sponsor' | 'facilities'>(
    'overview',
  );
  const [view, setView] = useState<'inbox' | 'finances' | 'board' | 'staff' | 'scouts' | 'club'>(
    c.sacked ? 'board' : 'inbox',
  );
  const [selectedId, setSelected] = useState(
    c.messages.find((m) => m.important && !m.resolved)?.id || c.messages[0]?.id,
  );
  const m = c.messages.find((m) => m.id === selectedId);
  const pendingActions = c.messages.filter(
    (message) => message.important && !message.resolved,
  ).length;
  const voice = useVoice();
  const speaking = voice.mailbox ? null : voice.current?.id;
  const voiceItem = (msg: Message): VoiceItem => ({
    id: msg.id,
    title: msg.title,
    text: `${msg.from}. ${msg.title}. ${msg.aiText || msg.body}`,
    voice: messageVoice[msg.kind],
  });
  const unread = c.messages.filter((msg) => !msg.read);
  const listenAll = () => {
    if (voice.mailbox) return stopVoice();
    // Caixa postal: primeiro as não lidas, da mais recente para a mais antiga; sem novas, todas.
    playVoice((unread.length ? unread : c.messages).map(voiceItem), true);
  };
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const finance = c.finances[c.clubId];
  const scoutCost = 500000 + c.scouts.length * 250000;
  const inboxFull = c.prospects.length >= 5;
  const [managingId, setManaging] = useState<string | null>(null);
  const [confirmFire, setConfirmFire] = useState(false);
  const managed = c.scouts.find((scout) => scout.id === managingId);
  const closeManage = () => {
    setManaging(null);
    setConfirmFire(false);
  };
  // Ao trocar de etapa no modal o botão focado some; o foco segue para a opção segura.
  const fireStep = (confirm: boolean) => {
    setConfirmFire(confirm);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          confirm ? '.scout-manage-dialog [data-autofocus]' : '.scout-manage-dialog .scout-fire',
        )
        ?.focus(),
    );
  };
  const players = squad(c, world);
  const wages = players.reduce((sum, p) => sum + c.players[p.id].wage, 0);
  const economy = economyOf(c, world);
  const operation = club.reputation * 30000 + upkeep(economy);
  const expenses = wages + operation + finance.debt * 0.002;
  const wageShare = (wages / Math.max(1, expenses)) * 100;
  const opShare = (operation / Math.max(1, expenses)) * 100;
  const table = standings(c, world, club.league);
  const rank = table.findIndex((r) => r.clubId === club.id) + 1;
  const points = table.find((r) => r.clubId === club.id)!.points;
  const own = c.fixtures.filter((f) => f.cup && (f.homeId === c.clubId || f.awayId === c.clubId));
  const cups = [...new Set(own.map((f) => f.cup!))].map((cup) => {
    const done = c.honours.find((h) => h.season === c.season && h.competition === cup);
    const latest = c.fixtures.filter((f) => f.cup === cup).at(-1)?.stage;
    const mine = own.filter((f) => f.cup === cup);
    return {
      cup,
      status:
        done?.clubId === c.clubId
          ? 'Campeão'
          : !done && mine.some((f) => f.stage === latest)
            ? 'Em disputa'
            : 'Eliminado',
      stage: mine.at(-1)?.stage || '',
    };
  });
  const history = finance.history;
  const balances = history.map((h) => h.balance);
  const low = Math.min(0, ...balances),
    high = Math.max(1, ...balances);
  const path = balances
    .map(
      (n, i) =>
        `${(i * 560) / Math.max(1, balances.length - 1)},${150 - ((n - low) / (high - low)) * 130}`,
    )
    .join(' ');
  const income = history.reduce((n, h) => n + h.income, 0);
  const outgo = history.reduce((n, h) => n + h.expenses, 0);
  const scoutingPanel = (
    <div className="staff-layout scout-layout">
      <section className="panel scout-network-panel">
        <div>
          <p className="eyebrow">GLOBAL SCOUTING NETWORK · MANDO</p>
          <h2>
            <Radar size={22} /> Rede de observação
          </h2>
          <p className="muted">
            Referência visual das regiões do Brasil. O mapa não indica a localização de olheiros ou
            atletas; os destinos ativos aparecem ao lado.
          </p>
        </div>
        <div className="scout-network-content">
          <div
            className="scout-region-map"
            role="img"
            aria-label="Mapa esquemático do Brasil, sem localização de atletas ou olheiros"
          >
            <span className="region-north">NORTE</span>
            <span className="region-northeast">NORDESTE</span>
            <span className="region-center">CENTRO-OESTE</span>
            <span className="region-southeast">SUDESTE</span>
            <span className="region-south">SUL</span>
          </div>
          <div className="scout-destinations">
            <p className="eyebrow">DESTINOS CONFIGURADOS</p>
            {scoutRegions.map((region) => {
              const assigned = c.scouts.filter((scout) => scout.region === region);
              return (
                <div className={assigned.length ? 'assigned' : ''} key={region}>
                  <span>{region}</span>
                  <strong>
                    {assigned.length
                      ? `${assigned.length} olheiro${assigned.length > 1 ? 's' : ''}`
                      : 'Sem olheiro'}
                  </strong>
                </div>
              );
            })}
            <p className="muted small">
              {c.scouts.length}/3 olheiros · {c.prospects.length} jovens nos relatórios
            </p>
          </div>
        </div>
      </section>
      <section className="panel staff-reports scout-team">
        <h2>
          <MapPinned size={22} /> Rede de olheiros
        </h2>
        <p className="muted">
          A cada 7 dias de observação, o olheiro entrega um jovem talento. Quanto maior o nível, maior
          o potencial e menor a incerteza do relatório. A caixa guarda até 5 relatórios.
        </p>
        {inboxFull && c.scouts.length > 0 && (
          <p className="scout-paused" role="status">
            <TriangleAlert size={15} /> Observação pausada: 5/5 relatórios na caixa. Promova ou
            aguarde para liberar espaço.
          </p>
        )}
        <div className="scout-cards">
          {c.scouts.map((scout) => {
            const left = 7 - scout.progress;
            return (
              <article className="scout-card" key={scout.id}>
                <span className="scout-avatar" aria-hidden="true">
                  {scout.name
                    .split(' ')
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('')}
                </span>
                <div className="scout-card-body">
                  <strong>{scout.name}</strong>
                  <span className="scout-meta">
                    {scout.region}
                    <span className="scout-pips" aria-label={`Nível ${scout.skill} de 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <i key={n} className={n <= scout.skill ? 'on' : ''} />
                      ))}
                    </span>
                  </span>
                  <meter
                    min={0}
                    max={7}
                    value={scout.progress}
                    aria-label={`Observação de ${scout.name}`}
                  />
                  <small>
                    {inboxFull
                      ? 'Pausado até liberar a caixa'
                      : left <= 1
                        ? 'Relatório chega amanhã'
                        : `Próximo relatório em ${left} dias`}
                    {' · '}+{scout.skill} de potencial por achado
                  </small>
                </div>
                <button
                  className="scout-manage"
                  onClick={() => {
                    setManaging(scout.id);
                    setConfirmFire(false);
                  }}
                  aria-label={`Gerenciar ${scout.name}`}
                >
                  <Settings2 size={15} /> Gerenciar
                </button>
              </article>
            );
          })}
          {c.scouts.length < 3 && (
            <article className="scout-card scout-slot">
              <span className="scout-avatar empty" aria-hidden="true">
                <UserPlus size={18} />
              </span>
              <div className="scout-card-body">
                <strong>Vaga livre · {money(scoutCost)}</strong>
                <small>Pagamento único. Escolha onde ele vai observar:</small>
                <div className="scout-regions">
                  {scoutRegions.map((region) => (
                    <button
                      key={region}
                      onClick={() => onHireScout(region)}
                      disabled={finance.cash < scoutCost}
                    >
                      {region}
                    </button>
                  ))}
                </div>
                {finance.cash < scoutCost && (
                  <small className="scout-warning">Caixa insuficiente ({money(finance.cash)}).</small>
                )}
              </div>
            </article>
          )}
        </div>
      </section>
      <section className="panel staff-reports">
        <h2>
          <Users size={22} /> Captação na base
        </h2>
        {c.prospects.length === 0 && (
          <p className="muted">Sem relatórios novos. Contrate um olheiro para iniciar a busca.</p>
        )}
        {c.prospects.map((prospect) => (
          <div key={prospect.id}>
            <span>
              {prospect.position} · {prospect.nationality}
            </span>
            <strong>{prospect.name}</strong>
            <p>
              {prospect.potential} de potencial · {prospect.uncertainty} de incerteza ·{' '}
              {money(prospect.value)} de valor estimado
            </p>
            <button className="primary" onClick={() => onSignProspect(prospect.id)}>
              Promover à base do clube
            </button>
          </div>
        ))}
      </section>
      {managed && (
        <Modal
          title={confirmFire ? `Dispensar ${managed.name}?` : `Gerenciar ${managed.name}`}
          onClose={closeManage}
          className="scout-manage-dialog"
        >
          {!confirmFire ? (
            <>
              <p className="muted">
                {managed.region} · nível {managed.skill}/5 · {managed.progress}/7 dias de observação
                em andamento.
              </p>
              <h3>Mudar destino</h3>
              <p className="muted small">
                Ele passa a observar outra região. A observação atual recomeça do zero, sem custo.
              </p>
              <div className="scout-regions">
                {scoutRegions.map((region) => (
                  <button
                    key={region}
                    disabled={region === managed.region}
                    aria-pressed={region === managed.region}
                    onClick={() => {
                      onReassignScout(managed.id, region);
                      closeManage();
                    }}
                  >
                    {region === managed.region ? `${region} · atual` : region}
                  </button>
                ))}
              </div>
              <h3>Encerrar contrato</h3>
              <p className="muted small">
                Libera a vaga na rede. Você confirma na próxima etapa.
              </p>
              <button className="scout-fire" onClick={() => fireStep(true)}>
                <UserMinus size={15} /> Dispensar olheiro…
              </button>
            </>
          ) : (
            <>
              <ul className="scout-consequences">
                <li>
                  Os <strong>{managed.progress} dias</strong> de observação em andamento são
                  perdidos.
                </li>
                <li>O valor pago na contratação não é devolvido.</li>
                <li>Os relatórios que ele já entregou continuam na sua caixa.</li>
                <li>
                  Uma nova contratação custará{' '}
                  <strong>{money(500000 + (c.scouts.length - 1) * 250000)}</strong>.
                </li>
              </ul>
              <div className="button-row">
                <button data-autofocus onClick={() => fireStep(false)}>
                  Manter {managed.name.split(' ')[0]}
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    onFireScout(managed.id);
                    closeManage();
                  }}
                >
                  Confirmar dispensa
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
  return (
    <div className="screen-enter office-screen">
      <SectionTitle
        kicker="ESCRITÓRIO / ALÉM DAS QUATRO LINHAS"
        title="Um clube inteiro ao seu redor."
      >
        <span className={`status-pill ${pendingActions ? 'attention' : 'no-actions'}`}>
          {pendingActions} AÇÕES NECESSÁRIAS
        </span>
      </SectionTitle>
      <div className="segmented" role="group" aria-label="Áreas do Escritório">
        {(
          [
            ['inbox', 'Mensagens', MessageSquare],
            ['finances', 'Finanças', TrendingUp],
            ['board', 'Diretoria', Landmark],
            ['staff', 'Comissão e perfil', Users],
            ['scouts', 'Olheiros e base', MapPinned],
            ['club', 'Clube vivo', HeartPulse],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            onClick={() => setView(id)}
            aria-pressed={view === id}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {view === 'inbox' && (
        <div className="office-inbox">
          <section className="panel message-list">
            {voiceAvailable() && (
              <button
                className={`mailbox-button ${voice.mailbox ? 'speaking' : ''}`}
                onClick={listenAll}
                aria-label={
                  voice.mailbox ? 'Parar caixa postal' : 'Ouvir todas as mensagens da caixa postal'
                }
              >
                {voice.mailbox ? <Square size={16} /> : <Voicemail size={18} />}
                <span>
                  <strong>{voice.mailbox ? 'Parar caixa postal' : 'Ouvir caixa postal'}</strong>
                  <small>
                    {voice.mailbox
                      ? `Recado ${voice.position} de ${voice.total}${voice.loading ? ' · preparando voz…' : ''}`
                      : unread.length
                        ? `${unread.length} recado${unread.length > 1 ? 's' : ''} novo${unread.length > 1 ? 's' : ''}`
                        : `Todas as ${c.messages.length} mensagens`}
                  </small>
                </span>
              </button>
            )}
            {c.messages.map((msg) => (
              <button
                key={msg.id}
                className={`${msg.id === selectedId ? 'selected' : ''} ${!msg.read ? 'unread' : ''} ${voice.current?.id === msg.id ? 'playing' : ''}`}
                onClick={() => {
                  if (!voice.mailbox && voice.current) stopVoice();
                  setSelected(msg.id);
                  onRead(msg.id);
                }}
              >
                <span
                  className={`message-indicator ${msg.important && !msg.resolved ? 'important' : ''}`}
                />
                <span>
                  <small>
                    {msg.from} · {dateLabel(msg.date)}
                  </small>
                  <strong>{msg.title}</strong>
                </span>
                {msg.resolved ? <Check size={15} /> : <ChevronRight size={15} />}
              </button>
            ))}
          </section>
          <article className="panel message-reader">
            {m ? (
              <>
                <div className="message-byline">
                  <span className="message-avatar">{m.from.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <strong>{m.from}</strong>
                    <p>{dateLabel(m.date, true)}</p>
                  </div>
                  <span className={`pill message-kind kind-${m.kind}`}>
                    {messageKindLabel[m.kind]}
                  </span>
                </div>
                <h2>{m.title}</h2>
                {voiceAvailable() && (
                  <button
                    className={`voice-button ${speaking === m.id ? 'speaking' : ''}`}
                    onClick={() => (speaking === m.id ? stopVoice() : playVoice([voiceItem(m)]))}
                    aria-label={speaking === m.id ? 'Parar áudio' : 'Ouvir mensagem'}
                  >
                    {speaking === m.id ? <Square size={16} /> : <Volume2 size={18} />}
                    <span className="voice-wave" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    {speaking === m.id
                      ? voice.loading
                        ? 'Preparando voz…'
                        : 'Parar'
                      : 'Ouvir mensagem'}
                  </button>
                )}
                <p className="message-body">{m.aiText || m.body}</p>
                {m.tactic && (
                  <div className="button-row">
                    <button
                      className="primary"
                      disabled={JSON.stringify(m.tactic) === JSON.stringify(c.tactic)}
                      onClick={() => onApplyPlan(m.id)}
                    >
                      {JSON.stringify(m.tactic) === JSON.stringify(c.tactic)
                        ? 'Plano do auxiliar em uso'
                        : 'Aplicar plano do auxiliar'}
                    </button>
                  </div>
                )}
                {m.important && !m.resolved ? (
                  <div className="response-area">
                    <p className="eyebrow">SUA DECISÃO</p>
                    {m.kind === 'player' ? (
                      <div className="button-row">
                        <button className="primary" onClick={() => onMessage(m.id, 'support')}>
                          Ouvir e oferecer apoio
                        </button>
                        <button onClick={() => onMessage(m.id, 'firm')}>Cobrar dedicação</button>
                      </div>
                    ) : m.id === economy.offersMessage && economy.offers.length ? (
                      <div className="button-row sponsor-choice">
                        {economy.offers.map((o, i) => (
                          <button
                            key={o.name}
                            className={i === 0 ? 'primary' : ''}
                            onClick={() => onSponsor(i)}
                          >
                            {o.name} · {o.style} · {money(o.monthly)}/mês
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button className="primary" onClick={() => onMessage(m.id, 'support')}>
                        Ciente. Continuar o trabalho.
                      </button>
                    )}
                    {m.kind === 'market' && (
                      <p className="muted small">
                        Aceite ou recuse propostas na aba Transferências. Esta ação confirma apenas
                        a leitura.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="muted small">
                    {m.choice
                      ? 'Sua resposta foi registrada na memória da carreira.'
                      : 'Mensagem informativa. Nenhuma decisão necessária.'}
                  </p>
                )}
                {m.playerId && (
                  <div className="memory-list">
                    <p className="eyebrow">MEMÓRIAS RECENTES</p>
                    {c.memories
                      .filter((memory) => memory.playerId === m.playerId)
                      .slice(-5)
                      .map((memory, i) => (
                        <p key={i}>
                          {dateLabel(memory.date)} · {memory.text}
                        </p>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">Selecione uma mensagem.</div>
            )}
          </article>
        </div>
      )}
      {view === 'finances' && (
        <div className="finance-section">
          <div
            className="segmented compact club-tabs finance-tabs"
            role="group"
            aria-label="Áreas das finanças"
          >
            {(
              [
                ['overview', 'Visão geral'],
                ['stadium', 'Estádio e torcida'],
                ['sponsor', 'Patrocínio'],
                ['facilities', 'Instalações'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className={financeView === id ? 'active' : ''}
                aria-pressed={financeView === id}
                onClick={() => setFinanceView(id)}
              >
                {label}
                {id === 'sponsor' && economy.offers.length > 0 && <b className="nav-dot" />}
              </button>
            ))}
          </div>
          {financeView === 'stadium' && (
            <StadiumPanel career={c} world={world} onPrices={onPrices} />
          )}
          {financeView === 'sponsor' && (
            <SponsorPanel career={c} world={world} onSponsor={onSponsor} />
          )}
          {financeView === 'facilities' && (
            <FacilitiesPanel career={c} world={world} onWork={onWork} />
          )}
          {financeView === 'overview' && (
        <div className="finance-layout">
          <div className="metrics-strip">
            <Metric label="CAIXA ATUAL" value={money(finance.cash)} />
            <Metric label="TRANSFERÊNCIAS" value={money(finance.transferBudget)} />
            <Metric label="FOLHA MENSAL" value={money(wages)} />
            <Metric label="DÍVIDA" value={money(finance.debt)} />
          </div>
          <div className="finance-charts">
            <section className="panel">
              <p className="eyebrow">DISTRIBUIÇÃO MENSAL PREVISTA</p>
              <h2>Para onde vai o dinheiro</h2>
              <div className="donut-container">
                <div
                  role="img"
                  aria-label={`Salários ${Math.round(wageShare)}%, operação ${Math.round(opShare)}%, juros ${Math.round(100 - wageShare - opShare)}%`}
                  className="donut"
                  style={{
                    background: `conic-gradient(#36d6e7 0 ${wageShare}%, #8c6cff ${wageShare}% ${wageShare + opShare}%, #334258 ${wageShare + opShare}% 100%)`,
                  }}
                >
                  <span>
                    {money(expenses)}
                    <small>POR MÊS</small>
                  </span>
                </div>
                <ul className="chart-legend">
                  <li>
                    Salários <strong>{Math.round(wageShare)}%</strong>
                  </li>
                  <li>
                    Operação <strong>{Math.round(opShare)}%</strong>
                  </li>
                  <li>
                    Juros <strong>{Math.round(100 - wageShare - opShare)}%</strong>
                  </li>
                </ul>
              </div>
            </section>
            <section className="panel">
              <p className="eyebrow">EVOLUÇÃO DO CAIXA</p>
              <h2>O equilíbrio do projeto</h2>
              {history.length > 1 ? (
                <svg
                  className="line-chart"
                  viewBox="0 0 560 170"
                  role="img"
                  aria-label={`Caixa de ${money(balances[0])} para ${money(balances.at(-1)!)}`}
                >
                  <path
                    d="M0 150H560M0 85H560M0 20H560"
                    stroke="rgba(255,255,255,.18)"
                    fill="none"
                  />
                  <polyline points={path} fill="none" stroke="#c6ff00" strokeWidth="3" />
                </svg>
              ) : (
                <p className="empty-state">
                  O gráfico aparece após os primeiros lançamentos financeiros.
                </p>
              )}
              <div className="cash-flow">
                <span>
                  Receitas <b>{money(income)}</b>
                </span>
                <div>
                  <i style={{ width: `${(income / Math.max(1, income, outgo)) * 100}%` }} />
                </div>
                <span>
                  Despesas <b>{money(outgo)}</b>
                </span>
                <div>
                  <i
                    className="expense"
                    style={{ width: `${(outgo / Math.max(1, income, outgo)) * 100}%` }}
                  />
                </div>
              </div>
            </section>
          </div>
          <section className="panel ledger">
            <h2>Últimos lançamentos</h2>
            {history
              .slice(-15)
              .reverse()
              .map((h, i) => (
                <div key={i}>
                  <span>{dateLabel(h.date)}</span>
                  <span>+ {money(h.income)}</span>
                  <span>− {money(h.expenses)}</span>
                  <strong>{money(h.balance)}</strong>
                </div>
              ))}
            {!history.length && (
              <p className="muted">
                Nenhum lançamento. As finanças são processadas mensalmente e em partidas, contratos
                e transferências.
              </p>
            )}
          </section>
        </div>
          )}
        </div>
      )}
      {view === 'board' && (
        <div className="board-layout">
          <section className="panel confidence-panel">
            <Landmark size={35} />
            <p className="eyebrow">CONFIANÇA DA DIRETORIA</p>
            <strong className="huge-number">
              {Math.round(c.confidence)}
              <span>%</span>
            </strong>
            <meter min={0} max={100} value={c.confidence} />
            <h2>
              {c.confidence >= 70
                ? 'Seu trabalho tem respaldo.'
                : c.confidence >= 40
                  ? 'É hora de mostrar uma resposta.'
                  : 'A pressão está no limite.'}
            </h2>
            <p>
              Resultados, dificuldade e desafio determinam a reação da diretoria. A confiança não
              aumenta o overall dos adversários.
            </p>
            {c.sacked && <strong className="status-pill">CARGO ENCERRADO</strong>}
            {!c.sacked && c.living.ultimatum && (
              <p className="living-headline">
                Ultimato: {c.living.ultimatum.points}/{c.living.ultimatum.target} pontos ·{' '}
                {c.living.ultimatum.games - c.living.ultimatum.played} jogos restantes
              </p>
            )}
            {!c.sacked &&
              !c.living.ultimatum &&
              c.living.hiredAt &&
              (Date.parse(c.date) - Date.parse(c.living.hiredAt)) / 864e5 < 45 && (
                <p className="muted">Período de adaptação: a diretoria ainda não ameaça o cargo.</p>
              )}
            {c.jobOffers.map((offer) => {
              const target = world.clubs.find((item) => item.id === offer.clubId);
              return (
                <article className="panel" key={offer.id}>
                  <h3>{target?.name}</h3>
                  <p>
                    {target ? `Série ${target.league} · reputação ${target.reputation} · ` : ''}
                    {c.sacked
                      ? 'Aguardando sua resposta'
                      : `Proposta válida até ${dateLabel(offer.expires)}`}{' '}
                    · {money(offer.salary)}/mês
                  </p>
                  <div className="button-row">
                    <button className="primary" onClick={() => onAcceptJob(offer.id)}>
                      Aceitar desafio
                    </button>
                    {!c.sacked && <button onClick={() => onDeclineJob(offer.id)}>Recusar</button>}
                  </div>
                </article>
              );
            })}
          </section>
          <section className="panel objectives">
            <p className="eyebrow">O QUE ESPERAM DE VOCÊ</p>
            <h2>
              <Target size={23} /> Objetivos de {c.season}
            </h2>
            <div>
              <h3 className="objective-line">
                <span>Brasileirão Série {club.league}</span>
                <i> — </i>
                <strong>{club.league === 'A' ? 'Terminar no G6' : 'Disputar o acesso (G6)'}</strong>
              </h3>
              <p>
                Atual: {rank}º colocado · {points} pontos
              </p>
              <meter min={0} max={20} value={21 - rank} />
            </div>
            <div>
              <h3 className="objective-line">
                <span>Saúde financeira</span>
                <i> — </i>
                <strong>Manter o caixa positivo</strong>
              </h3>
              <p>{money(finance.cash)} em caixa</p>
            </div>
            <div>
              <h3 className="objective-line">
                <span>Desafio da carreira</span>
                <i> — </i>
                <strong>{c.challenge}</strong>
              </h3>
              {c.challenge === 'Venda necessária' && (
                <p>{money(c.sales)} de R$ 10 milhões em vendas</p>
              )}
            </div>
            {cups.map(({ cup, status, stage }) => (
              <div key={cup}>
                <h3 className="objective-line">
                  <span>{competitionName(cup)}</span>
                  <i> — </i>
                  <strong>{status}</strong>
                </h3>
                <p>Última fase disputada: {stage}</p>
              </div>
            ))}
          </section>
        </div>
      )}
      {view === 'staff' && (
        <div className="staff-layout">
          <section className="panel profile-panel">
            <ManagerPortrait manager={c.manager} />
            <div>
              <p className="eyebrow">MANAGER DO {club.name.toUpperCase()}</p>
              <h2>
                {c.manager.firstName} {c.manager.lastName}
              </h2>
              <p>
                {c.manager.nationality} · {c.manager.age} anos · {c.difficulty}
              </p>
              <p>{c.manager.appearance}</p>
              <button
                className="primary"
                disabled={!aiAvailable || busy}
                onClick={() => setCamera(true)}
              >
                <Camera size={16} />
                {c.manager.avatar ? 'Novo retrato com sua foto' : 'Criar retrato com sua foto'}
              </button>
              {camera && (
                <PortraitCamera
                  style={c.manager.style}
                  onClose={() => setCamera(false)}
                  onCapture={(photo) => {
                    setCamera(false);
                    onAvatar(photo);
                  }}
                />
              )}
            </div>
          </section>
          <section className="panel staff-reports">
            <h2>
              <BriefcaseBusiness size={22} /> Sua comissão
            </h2>
            <div>
              <span>AUXILIAR TÉCNICO</span>
              <strong>
                {c.tactic.formation} · {c.tactic.mentality}
              </strong>
              <p>
                {c.tactic.pressure > 3
                  ? 'Pressão alta exige rotação. Observe as condições antes de escalar.'
                  : 'Um bloco equilibrado ajuda a controlar o ritmo e preservar energia.'}
              </p>
            </div>
            <div>
              <span>PREPARADOR FÍSICO</span>
              <strong>
                {players.filter((p) => c.players[p.id].fitness < 70).length} atletas precisam de
                descanso
              </strong>
              <p>
                Condição média:{' '}
                {Math.round(
                  players.reduce((n, p) => n + c.players[p.id].fitness, 0) / players.length,
                )}
                %
              </p>
            </div>
            <div>
              <span>DEPARTAMENTO MÉDICO</span>
              <strong>
                {players.filter((p) => c.players[p.id].injuryDays > 0).length} atletas em
                recuperação
              </strong>
              <p>
                {players
                  .filter((p) => c.players[p.id].injuryDays > 0)
                  .map((p) => `${p.name}: ${c.players[p.id].injuryDays} dias`)
                  .join(' · ') || 'Todos os atletas estão liberados clinicamente.'}
              </p>
            </div>
            <div>
              <span>SCOUT</span>
              <strong>Recrutamento nacional</strong>
              <p>
                Combine os filtros do mercado. O potencial tem incerteza e o valor da transferência
                depende também de contrato, clube e interesse.
              </p>
            </div>
          </section>
        </div>
      )}
      {view === 'scouts' && scoutingPanel}
      {view === 'club' && (
        <ClubPanel
          career={c}
          world={world}
          onUpdate={onLiving}
          onUpgradeAnalyst={onUpgradeAnalyst}
        />
      )}
    </div>
  );
}
