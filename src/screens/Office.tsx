import { useState } from 'react';
import {
  BrainCircuit,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Landmark,
  MessageSquare,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { type Career, type Message, type World } from '../game/types';
import { squad } from '../game/matches';
import { standings } from '../game/engine';
import { competitionName } from '../game/calendar';
import { dateLabel, ManagerPortrait, Metric, money, SectionTitle } from '../components/ui';

export function Office({
  career: c,
  world,
  onMessage,
  onRead,
  onAi,
  onAvatar,
  aiAvailable,
  busy,
}: {
  career: Career;
  world: World;
  onMessage: (id: string, choice: 'support' | 'firm') => void;
  onRead: (id: string) => void;
  onAi: (message: Message) => void;
  onAvatar: () => void;
  aiAvailable: boolean;
  busy: boolean;
}) {
  const [view, setView] = useState<'inbox' | 'finances' | 'board' | 'staff'>('inbox');
  const [selectedId, setSelected] = useState(
    c.messages.find((m) => m.important && !m.resolved)?.id || c.messages[0]?.id,
  );
  const m = c.messages.find((m) => m.id === selectedId);
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const finance = c.finances[c.clubId];
  const players = squad(c, world);
  const wages = players.reduce((sum, p) => sum + c.players[p.id].wage, 0);
  const expenses = wages + club.reputation * 30000 + finance.debt * 0.002;
  const wageShare = (wages / Math.max(1, expenses)) * 100;
  const opShare = ((club.reputation * 30000) / Math.max(1, expenses)) * 100;
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
  return (
    <div className="screen-enter">
      <SectionTitle
        kicker="ESCRITÓRIO / ALÉM DAS QUATRO LINHAS"
        title="Um clube inteiro ao seu redor."
      >
        <span className="status-pill">
          {c.messages.filter((m) => m.important && !m.resolved).length} AÇÕES NECESSÁRIAS
        </span>
      </SectionTitle>
      <div className="segmented">
        {(
          [
            ['inbox', 'Mensagens', MessageSquare],
            ['finances', 'Finanças', TrendingUp],
            ['board', 'Diretoria', Landmark],
            ['staff', 'Comissão e perfil', Users],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {view === 'inbox' && (
        <div className="office-inbox">
          <section className="panel message-list">
            {c.messages.map((msg) => (
              <button
                key={msg.id}
                className={`${msg.id === selectedId ? 'selected' : ''} ${!msg.read ? 'unread' : ''}`}
                onClick={() => {
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
                  <span className="pill">{m.kind.toUpperCase()}</span>
                </div>
                <h2>{m.title}</h2>
                <p className="message-body">{m.aiText || m.body}</p>
                {m.aiText && (
                  <p className="ai-disclosure">
                    <Sparkles size={14} /> Texto gerado por IA sobre um evento da engine.
                  </p>
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
                <button
                  className="ai-button"
                  disabled={!aiAvailable || busy || Boolean(m.aiText)}
                  onClick={() => onAi(m)}
                >
                  <BrainCircuit size={17} />{' '}
                  {m.aiText ? 'Diálogo já gerado' : 'Dar voz a esta história com IA'}
                </button>
                {!aiAvailable && (
                  <p className="muted small">
                    IA requer login, sincronização e Edge Functions configuradas.
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
        <>
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
                    background: `conic-gradient(#234d65 0 ${wageShare}%, #a9c5c6 ${wageShare}% ${wageShare + opShare}%, #d7ed78 ${wageShare + opShare}% 100%)`,
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
                  <path d="M0 150H560M0 85H560M0 20H560" stroke="#dce5e9" fill="none" />
                  <polyline points={path} fill="none" stroke="#287477" strokeWidth="3" />
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
        </>
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
          </section>
          <section className="panel objectives">
            <p className="eyebrow">O QUE ESPERAM DE VOCÊ</p>
            <h2>
              <Target size={23} /> Objetivos de {c.season}
            </h2>
            <div>
              <span>Brasileirão Série {club.league}</span>
              <strong>{club.league === 'A' ? 'Terminar no G6' : 'Disputar o acesso (G6)'}</strong>
              <p>
                Atual: {rank}º colocado · {points} pontos
              </p>
              <meter min={0} max={20} value={21 - rank} />
            </div>
            <div>
              <span>Saúde financeira</span>
              <strong>Manter o caixa positivo</strong>
              <p>{money(finance.cash)} em caixa</p>
            </div>
            <div>
              <span>Desafio da carreira</span>
              <strong>{c.challenge}</strong>
              {c.challenge === 'Venda necessária' && (
                <p>{money(c.sales)} de R$ 10 milhões em vendas</p>
              )}
            </div>
            {cups.map(({ cup, status, stage }) => (
              <div key={cup}>
                <span>{competitionName(cup)}</span>
                <strong>{status}</strong>
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
                disabled={!aiAvailable || busy || Boolean(c.manager.avatar)}
                onClick={onAvatar}
              >
                <Sparkles size={16} />
                {c.manager.avatar ? 'Retrato gerado' : 'Gerar retrato com IA'}
              </button>
              <p className="muted small">
                Uma geração por carreira. Requer OpenAI configurada e gera cobrança na sua conta.
              </p>
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
    </div>
  );
}
