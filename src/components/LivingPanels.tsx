import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Radar } from 'lucide-react';
import { useStickX } from '../controller/GamepadProvider';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { clubById, findPlayer } from '../game/npc';
import { analystCost } from '../game/living';
import { winProbability } from '../game/tactics';
import { dateLabel, money } from './ui';
import { nextFixture } from '../game/calendar';
import {
  trainingFocus,
  type Career,
  type Fixture,
  type Living,
  type Match,
  type World,
} from '../game/types';

const clubName = (world: World, id: string) => {
  try {
    return clubById(world, id).name;
  } catch {
    return id;
  }
};
const playerName = (_career: Career, world: World, id: string) =>
  findPlayer(world, id)?.name || 'Atleta';

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div className="living-bar">
    <span>{label}</span>
    <meter min={0} max={100} low={35} high={65} optimum={90} value={value} />
    <strong>{Math.round(value)}</strong>
  </div>
);

export function MarketFeed({
  career,
  world,
  onOpen,
}: {
  career: Career;
  world: World;
  onOpen: () => void;
}) {
  const [view, setView] = useState(0);
  const [focused, setFocused] = useState(false);
  const cycle = (direction: number) => setView((current) => (current + direction + 2) % 2);
  useStickX(cycle, focused);
  const l = career.living;
  const moves = l.transfers.slice(-6).reverse();
  const titles = ['Mercado da Bola', 'Rede de olheiros'];
  return (
    <section
      className="tile tile-market market-tile"
      aria-label="Mercado e rede de olheiros"
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span className="tile-label">
        <Radar size={14} /> MUNDO VIVO
      </span>
      <div className="market-heading">
        <h2>{titles[view]}</h2>
        <div className="market-switch">
          <button aria-label="Conteúdo anterior" onClick={() => cycle(-1)}>
            <ChevronLeft size={16} />
          </button>
          <button aria-label="Próximo conteúdo" onClick={() => cycle(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="market-body" aria-live="polite">
        {view === 0 ? (
          <>
            {l.headline && l.headline.until >= career.date && (
              <p className="living-headline">{l.headline.text}</p>
            )}
            <Bar label="Torcida" value={l.fans} />
            {moves.length ? (
              <ul>
                {moves.map((m, i) => (
                  <li key={`${m.playerId}-${i}`}>
                    <strong>{playerName(career, world, m.playerId)}</strong>
                    <span>
                      {clubName(world, m.from)} → {clubName(world, m.to)}
                    </span>
                    <small>{m.fee > 0 ? money(m.fee) : 'Livre'}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhuma movimentação recente no mercado.</p>
            )}
          </>
        ) : (
          <>
            <p className="market-network-count">
              <strong>{career.scouts.length}/3</strong> olheiros
              <span>{career.prospects.length} jovens nos relatórios</span>
            </p>
            {career.scouts.length ? (
              career.scouts.map((scout) => (
                <div className="market-scout" key={scout.id}>
                  <strong>{scout.name}</strong>
                  <small>
                    {scout.region} · nível {scout.skill}
                  </small>
                  <meter
                    aria-label={`Observação de ${scout.name}`}
                    min={0}
                    max={7}
                    value={scout.progress}
                  />
                  <small>{scout.progress}/7 dias</small>
                </div>
              ))
            ) : (
              <p className="muted">Contrate olheiros no Escritório para ampliar sua rede.</p>
            )}
          </>
        )}
      </div>
      <div className="market-pagination">
        <div className="market-dots" aria-label="Conteúdo do painel">
          {titles.map((title, index) => (
            <button
              key={title}
              aria-label={title}
              aria-pressed={view === index}
              onClick={() => setView(index)}
            />
          ))}
        </div>
        <ControllerButtonHint action="stick" label="Alternar" />
      </div>
      <button className="market-open" onClick={onOpen}>
        Escritório <ArrowUpRight size={15} />
      </button>
    </section>
  );
}

const trainingInfo: Record<Living['training'], { daily: string; match: string }> = {
  Equilibrado: {
    daily: 'Sem efeito extra na semana.',
    match: 'Nenhum bônus nem custo. Bom ponto de partida.',
  },
  Físico: {
    daily: '−1 de condição e +0,3 de ritmo por dia.',
    match: 'O time cansa bem menos durante os jogos.',
  },
  Tático: {
    daily: '+0,15 de ritmo por dia.',
    match: '+1,2% de rendimento coletivo em campo.',
  },
  Finalização: {
    daily: 'Sem efeito físico na semana.',
    match: '+0,8% de rendimento coletivo em campo.',
  },
  Recuperação: {
    daily: '+2 de condição por dia.',
    match: 'O time cansa um pouco menos. Ideal em semana de dois jogos.',
  },
};

const analystLevels = [
  { level: 1, error: '±6', traits: 1, odds: false },
  { level: 2, error: '±4', traits: 2, odds: false },
  { level: 3, error: '±2', traits: 3, odds: true },
  { level: 4, error: 'exato', traits: 4, odds: true },
  { level: 5, error: 'exato', traits: 5, odds: true },
];

const boardAxes = [
  ['results', 'Resultados', '+3 por vitória e −4 por derrota.'],
  ['finances', 'Finanças', 'Revisada todo dia 1º: caixa positivo sobe, negativo derruba.'],
  ['youth', 'Base', 'Sobe conforme os minutos dados a atletas da base.'],
  ['style', 'Estilo', 'Média de gols marcados na temporada.'],
  ['derbies', 'Clássicos', '+10 ao vencer um clássico e −12 ao perder.'],
] as const;

const mood = (v: number) =>
  v >= 80 ? 'Em festa' : v >= 60 ? 'Confiante' : v >= 40 ? 'Desconfiada' : v >= 25 ? 'Irritada' : 'Em protesto';

type ClubView = 'board' | 'preparation' | 'analyst' | 'locker' | 'rivals';

export function ClubPanel({
  career,
  world,
  onUpdate,
  onUpgradeAnalyst,
}: {
  career: Career;
  world: World;
  onUpdate: (patch: Partial<Living>) => void;
  onUpgradeAnalyst: () => void;
}) {
  const [view, setView] = useState<ClubView>('board');
  const l = career.living;
  const league = world.clubs.find((x) => x.id === career.clubId)?.league;
  const rivals = Object.entries(l.coaches)
    .filter(([id]) => world.clubs.some((c) => c.id === id && c.league === league))
    .sort((a, b) => b[1].winless - a[1].winless)
    .slice(0, 20);
  const reporters = Object.entries(l.media);
  const cash = career.finances[career.clubId]?.cash ?? 0;
  const boardAvg = Math.round(
    Object.values(l.board).reduce((n, v) => n + v, 0) / Object.values(l.board).length,
  );
  const openDemands = l.demands.filter((d) => !d.done);
  const next = nextFixture(career);
  const nextRival = next
    ? clubName(world, next.homeId === career.clubId ? next.awayId : next.homeId)
    : null;
  const nextCost = l.analyst < 5 ? analystCost(l.analyst + 1) : 0;
  const tabs: [ClubView, string][] = [
    ['board', 'Diretoria'],
    ['preparation', 'Preparação'],
    ['analyst', 'Analista'],
    ['locker', 'Vestiário e imprensa'],
    ['rivals', 'Técnicos rivais'],
  ];
  return (
    <div className="club-living">
      <div className="club-kpis">
        <button className="club-kpi" onClick={() => setView('board')}>
          <span>Seu cargo</span>
          <strong>{Math.round(career.confidence)}%</strong>
          <small>confiança da diretoria</small>
        </button>
        <button className="club-kpi" onClick={() => setView('board')}>
          <span>Torcida</span>
          <strong>{Math.round(l.fans)}</strong>
          <small>{mood(l.fans)}</small>
        </button>
        <button className="club-kpi" onClick={() => setView('preparation')}>
          <span>Treino da semana</span>
          <strong>{l.training}</strong>
          <small>{l.marking ? 'Marcação individual ligada' : 'Sem marcação individual'}</small>
        </button>
        <button className="club-kpi" onClick={() => setView('analyst')}>
          <span>Analista</span>
          <strong>Nível {l.analyst}/5</strong>
          <small>
            {analystLevels[l.analyst - 1].odds ? 'Com previsão de resultado' : 'Sem previsão de resultado'}
          </small>
        </button>
      </div>
      <div className="segmented compact club-tabs" role="group" aria-label="Áreas do clube vivo">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={view === id ? 'active' : ''}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'board' && (
        <div className="club-grid">
          <section className="panel">
            <h2>Como a diretoria te avalia</h2>
            <p className="muted">
              Cinco notas de 0 a 100. Todo dia 1º a média é comparada com 60: acima disso sua
              confiança no cargo sobe; abaixo, cai. Média atual: <strong>{boardAvg}</strong>.
            </p>
            {boardAxes.map(([key, label, how]) => (
              <div className="club-axis" key={key}>
                <Bar label={label} value={l.board[key]} />
                <small>{how}</small>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Torcida · {mood(l.fans)}</h2>
            <Bar label="Humor" value={l.fans} />
            <ul className="club-rules">
              <li>Vitória +3, derrota −4, empate −1. Em clássico, vale o dobro.</li>
              <li>A partir de 78 (ou estádio 92% cheio): casa cheia empurra o time. Acima de 80: bônus mensal de bilheteria.</li>
              <li>O humor puxa o público e o número de sócios (veja Finanças → Estádio e torcida).</li>
              <li>Abaixo de 30: vaias em casa. Abaixo de 25: protesto no CT e a moral do elenco cai.</li>
            </ul>
            <h3>Situação do clube</h3>
            <p>
              Gestão: <strong>{l.owner}</strong>
              {l.wagesLate && <span className="pill danger"> Salários atrasados</span>}
              {l.transferBan && l.transferBan >= career.date && (
                <span className="pill danger"> Transfer ban até {dateLabel(l.transferBan)}</span>
              )}
            </p>
            {l.election && (
              <p className="living-headline">
                Eleição em {dateLabel(l.election.date)}: {l.election.rival} tem{' '}
                {l.election.threat}% de chance de vencer e te demitir.
              </p>
            )}
            {l.nationalInvite && (
              <p className="living-headline">A CBF quer você no comando da Seleção!</p>
            )}
            <h3>Exigências em aberto</h3>
            {openDemands.length ? (
              openDemands.map((d) => (
                <p key={d.id} className="club-demand">
                  {d.text} <span className="muted">· prazo {dateLabel(d.deadline)}</span>
                </p>
              ))
            ) : (
              <p className="muted">Nenhuma exigência em aberto.</p>
            )}
          </section>
        </div>
      )}

      {view === 'preparation' && (
        <div className="club-grid">
          <section className="panel">
            <h2>Treino da semana</h2>
            <p className="muted">
              Vale todos os dias até você trocar. Afeta condição física e ritmo do elenco e dá um
              bônus nas partidas.
            </p>
            <div className="training-options" role="radiogroup" aria-label="Foco do treino">
              {trainingFocus.map((t) => (
                <button
                  key={t}
                  role="radio"
                  aria-checked={l.training === t}
                  className={l.training === t ? 'active' : ''}
                  onClick={() => onUpdate({ training: t })}
                >
                  <strong>{t}</strong>
                  <small>Semana: {trainingInfo[t].daily}</small>
                  <small>Jogo: {trainingInfo[t].match}</small>
                </button>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Marcação individual</h2>
            <p className="muted">
              Um jogador seu persegue o finalizador mais perigoso do adversário em todos os jogos.
            </p>
            <ul className="club-rules">
              <li className="good">A chance de gol do marcado cai 55%.</li>
              <li className="bad">Seu meio-campo perde 1,5% de força (um homem a menos na criação).</li>
              <li>Vale a pena contra times que dependem de um craque.</li>
            </ul>
            <button
              className={l.marking ? 'primary' : ''}
              aria-pressed={l.marking}
              onClick={() => onUpdate({ marking: !l.marking })}
            >
              {l.marking ? 'Marcação ligada · desligar' : 'Ligar marcação individual'}
            </button>
          </section>
        </div>
      )}

      {view === 'analyst' && (
        <div className="club-grid">
          <section className="panel">
            <h2>O que o analista faz</h2>
            <p>
              Antes de cada jogo ele monta o <strong>relatório do adversário</strong>, que chega no
              Escritório como mensagem do Auxiliar técnico
              {nextRival ? (
                <>
                  {' '}
                  — o próximo será sobre o <strong>{nextRival}</strong>
                </>
              ) : null}
              .
            </p>
            <ul className="club-rules">
              <li>Força estimada do rival (com margem de erro nos níveis baixos).</li>
              <li>Pontos fracos vistos no vídeo: defesa lenta, laterais, cansaço, pressão.</li>
              <li>A partir do nível 3: chance de vitória, empate e derrota com xG.</li>
              <li>Sugestão de tática pronta para aplicar com um botão.</li>
            </ul>
            <p className="muted small">
              Contratar um nível acima substitui o analista atual. Pagamento único, sem salário.
              Caixa disponível: {money(cash)}.
            </p>
          </section>
          <section className="panel analyst-ladder" aria-label="Níveis do analista">
            <h2>Níveis</h2>
            {analystLevels.map((a) => {
              const state =
                a.level === l.analyst
                  ? 'current'
                  : a.level < l.analyst
                    ? 'past'
                    : a.level === l.analyst + 1
                      ? 'next'
                      : 'locked';
              return (
                <div key={a.level} className={`analyst-step ${state}`}>
                  <b>{a.level}</b>
                  <span>
                    Força {a.error === 'exato' ? 'exata' : `com erro de ${a.error}`} ·{' '}
                    {a.traits} ponto{a.traits > 1 ? 's' : ''} fraco{a.traits > 1 ? 's' : ''}
                    {a.odds ? ' · previsão de resultado' : ''}
                  </span>
                  {state === 'current' && <em>ATUAL</em>}
                  {state === 'next' && (
                    <button
                      className="primary"
                      disabled={cash < nextCost}
                      onClick={onUpgradeAnalyst}
                      title={cash < nextCost ? 'Caixa insuficiente' : undefined}
                    >
                      Contratar · {money(nextCost)}
                    </button>
                  )}
                  {state === 'locked' && <small>{money(analystCost(a.level))}</small>}
                </div>
              );
            })}
            {l.analyst >= 5 && <p className="muted">Você já tem o melhor analista do mercado.</p>}
          </section>
        </div>
      )}

      {view === 'locker' && (
        <div className="club-grid">
          <section className="panel">
            <h2>Vestiário</h2>
            <ul className="club-rules">
              <li className="good">Amizade: +0,6% de rendimento quando os dois jogam juntos.</li>
              <li className="bad">
                Rixa: −1,2% de rendimento se escalados juntos e risco de briga no treino (−5 de
                moral para os dois).
              </li>
            </ul>
            {l.relations.length ? (
              l.relations.map((r) => (
                <p key={`${r.a}-${r.b}`} className={`club-relation ${r.kind}`}>
                  <span>{r.kind === 'amizade' ? 'AMIZADE' : 'RIXA'}</span>
                  {playerName(career, world, r.a)} e {playerName(career, world, r.b)}
                </p>
              ))
            ) : (
              <p className="muted">Sem grupos marcantes no elenco.</p>
            )}
          </section>
          <section className="panel">
            <h2>Imprensa</h2>
            <p className="muted">
              Simpatia de cada jornalista. Respostas calorosas na coletiva aproximam; respostas
              duras afastam.
            </p>
            {reporters.length ? (
              reporters.map(([name, v]) => <Bar key={name} label={name} value={v} />)
            ) : (
              <p className="muted">Dê a primeira coletiva para conhecer os setoristas.</p>
            )}
          </section>
        </div>
      )}

      {view === 'rivals' && (
        <section className="panel">
          <h2>Técnicos rivais da sua divisão</h2>
          <p className="muted">
            Eles estudam seus últimos planos táticos e se adaptam. Quem passa de 5 jogos sem vencer
            na metade de baixo da tabela (ou 8 em qualquer posição) cai, e o substituto muda o jeito
            do time jogar.
          </p>
          <div className="rival-table" role="table" aria-label="Técnicos rivais">
            <div role="row" className="rival-head">
              <span role="columnheader">Clube</span>
              <span role="columnheader">Técnico</span>
              <span role="columnheader">Estilo</span>
              <span role="columnheader">Nível</span>
              <span role="columnheader">Sem vencer</span>
            </div>
            {rivals.map(([id, coach]) => (
              <div role="row" key={id} className={coach.winless >= 5 ? 'pressure' : ''}>
                <strong role="cell">{clubName(world, id)}</strong>
                <span role="cell">{coach.name}</span>
                <span role="cell">{coach.style}</span>
                <span role="cell">{coach.skill}/5</span>
                <span role="cell">
                  {coach.winless}
                  {coach.winless >= 5 ? ' · balançando' : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function MatchOdds({
  career,
  world,
  fixture,
}: {
  career: Career;
  world: World;
  fixture: Fixture;
}) {
  const odds = winProbability(career, world, fixture);
  if (!odds) return null;
  return (
    <div className="living-odds">
      <div>
        <span>Vitória</span>
        <strong>{odds.win}%</strong>
      </div>
      <div>
        <span>Empate</span>
        <strong>{odds.draw}%</strong>
      </div>
      <div>
        <span>Derrota</span>
        <strong>{odds.loss}%</strong>
      </div>
      <p className="muted">
        xG esperado {odds.xgFor} × {odds.xgAgainst}
        {odds.studied ? ' · o técnico rival estudou seus últimos jogos' : ''}
      </p>
      {odds.notes.map((n) => (
        <p key={n} className="muted">
          {n}
        </p>
      ))}
    </div>
  );
}

const kindIcon: Record<string, string> = {
  titulo: '🏆',
  venda: '💰',
  contratacao: '✍️',
  derrota: '💥',
  vitoria: '⚽',
  marco: '⭐',
  base: '🌱',
  cargo: '💼',
};

export function LegacyPanel({ career, world }: { career: Career; world: World }) {
  const l = career.living;
  const hall = Object.entries(l.clubStats)
    .sort((a, b) => b[1].games + b[1].goals * 3 - (a[1].games + a[1].goals * 3))
    .slice(0, 10);
  const sales = l.transfers
    .filter((t) => t.from === career.clubId)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);
  const buys = l.transfers
    .filter((t) => t.to === career.clubId)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);
  return (
    <div className="staff-layout legacy-layout">
      <section className="panel">
        <h2>Linha do tempo</h2>
        {l.nationalInvite && (
          <p className="living-headline">Convidado para treinar a Seleção Brasileira</p>
        )}
        {l.timeline.length ? (
          [...l.timeline]
            .reverse()
            .slice(0, 40)
            .map((e, i) => (
              <p key={i} tabIndex={0}>
                {kindIcon[e.kind]} <span className="muted">{dateLabel(e.date)}</span> {e.text}
              </p>
            ))
        ) : (
          <p className="muted">A história ainda está sendo escrita.</p>
        )}
      </section>
      <section className="panel">
        <h2>Hall da fama</h2>
        {hall.map(([id, s]) => (
          <p key={id} tabIndex={0}>
            <strong>{playerName(career, world, id)}</strong>{' '}
            <span className="muted">
              {s.games} jogos · {s.goals} gols · {s.assists} assist.
            </span>
          </p>
        ))}
        {!hall.length && <p className="muted">Jogue partidas para formar ídolos.</p>}
      </section>
      <section className="panel">
        <h2>Maiores negócios</h2>
        <h3>Vendas</h3>
        {sales.map((t, i) => (
          <p key={i} tabIndex={0}>
            {playerName(career, world, t.playerId)} → {clubName(world, t.to)} · {money(t.fee)}
          </p>
        ))}
        <h3>Contratações</h3>
        {buys.map((t, i) => (
          <p key={i} tabIndex={0}>
            {playerName(career, world, t.playerId)} ← {clubName(world, t.from)} · {money(t.fee)}
          </p>
        ))}
      </section>
    </div>
  );
}

/** Pós-jogo: xG acumulado e explicação do resultado a partir dos números. */
export function MatchAnalysis({
  match,
  fixture,
  clubId,
}: {
  match: Match;
  fixture: Fixture;
  clubId: string;
}) {
  const ownHome = fixture.homeId === clubId;
  const ownId = clubId;
  let a = 0,
    b = 0;
  const ours: string[] = ['0,90'];
  const theirs: string[] = ['0,90'];
  for (const e of match.events) {
    if (!e.xg) continue;
    if (e.clubId === ownId) a += e.xg;
    else b += e.xg;
    ours.push(`${(e.minute / 90) * 300},${90 - a * 25}`);
    theirs.push(`${(e.minute / 90) * 300},${90 - b * 25}`);
  }
  ours.push(`300,${90 - a * 25}`);
  theirs.push(`300,${90 - b * 25}`);
  const us = ownHome ? match.home : match.away;
  const them = ownHome ? match.away : match.home;
  const gf = ownHome ? match.homeGoals : match.awayGoals;
  const ga = ownHome ? match.awayGoals : match.homeGoals;
  const why: string[] = [];
  if (gf > ga)
    why.push(
      us.xg >= them.xg
        ? 'Vitória construída: criamos mais chances claras.'
        : 'Vitória com eficiência: o rival criou mais, mas fomos letais.',
    );
  else if (gf < ga)
    why.push(
      us.xg > them.xg
        ? 'Derrota injusta pelos números: criamos mais e faltou pontaria.'
        : 'Derrota merecida: o rival criou chances melhores.',
    );
  else why.push('Empate equilibrado nas chances.');
  if (us.possession >= 58) why.push(`Dominamos a bola (${us.possession}%).`);
  if (us.possession <= 42) why.push(`Cedemos a posse (${us.possession}%).`);
  if (match.studied) why.push('O técnico rival estudou nossos jogos e montou um plano específico.');
  if (match.marked)
    why.push('A marcação individual travou o principal jogador deles, ao custo de força no meio.');
  for (const n of match.conditions?.notes || []) why.push(n);
  return (
    <div className="match-analysis">
      <h3>Por que {gf > ga ? 'vencemos' : gf < ga ? 'perdemos' : 'empatamos'}</h3>
      <svg viewBox="0 0 300 95" preserveAspectRatio="none" aria-label="xG acumulado">
        <polyline points={ours.join(' ')} fill="none" stroke="#22c55e" strokeWidth="3" />
        <polyline points={theirs.join(' ')} fill="none" stroke="#ef4444" strokeWidth="3" />
      </svg>
      <p className="muted small">
        xG acumulado: nós {a.toFixed(2)} (verde) × {b.toFixed(2)} rival (vermelho)
      </p>
      {why.map((w) => (
        <p key={w} className="small">
          {w}
        </p>
      ))}
    </div>
  );
}
