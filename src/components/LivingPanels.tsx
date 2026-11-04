import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Radar } from 'lucide-react';
import { useStickX } from '../controller/GamepadProvider';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { BRAZIL_NATIONAL_ID, clubById, findPlayer } from '../game/npc';
import { analystCost } from '../game/living';
import {
  staffEffectText,
  staffHireCost,
  staffLevel,
  staffName,
  staffPayroll,
  staffRoles,
  staffTitles,
  staffWage,
  type StaffRole,
} from '../game/staff';
import {
  MENTOR_MIN_AGE,
  MENTOR_SLOTS,
  PUPIL_MAX_AGE,
  cliques,
  hierarchy,
  inheritChance,
  mentorGrowth,
  mentorSuggestions,
  tiers,
  type Tier,
} from '../game/dressing';
import { winProbability } from '../game/tactics';
import { dateLabel, money } from './ui';
import { competitionName, nextFixture } from '../game/calendar';
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

type ClubView = 'board' | 'preparation' | 'staff' | 'analyst' | 'locker' | 'rivals';

const Pips = ({ level }: { level: number }) => (
  <span className="scout-pips" aria-label={`Nível ${level} de 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <i key={n} className={n <= level ? 'on' : ''} />
    ))}
  </span>
);

const tierInfo: Record<Tier, string> = {
  Líderes: 'Ditam o clima. Felizes, levantam o grupo; contrariados, levam a turma junto.',
  Influentes: 'Têm voz no vestiário e puxam a opinião dos mais novos.',
  Elenco: 'Seguem as lideranças.',
  Periféricos: 'Pouco espaço e pouca voz. Somem do grupo se ficarem esquecidos.',
};

export function ClubPanel({
  career,
  world,
  onUpdate,
  onUpgradeAnalyst,
  onHireStaff,
  onMentor,
  onEndMentor,
  onOpenScouts,
  initialView,
}: {
  career: Career;
  world: World;
  onUpdate: (patch: Partial<Living>) => void;
  onUpgradeAnalyst: () => void;
  onHireStaff: (role: StaffRole, level: number) => void;
  onMentor: (mentorId: string, pupilId: string) => void;
  onEndMentor: (pupilId: string) => void;
  onOpenScouts?: () => void;
  initialView?: ClubView;
}) {
  const [view, setView] = useState<ClubView>(initialView ?? 'board');
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
  const staffAvg =
    Math.round(
      ([...staffRoles.map((r) => staffLevel(career, r)), l.analyst].reduce((n, v) => n + v, 0) /
        (staffRoles.length + 1)) *
        10,
    ) / 10;
  const payroll = staffPayroll(career);
  const ranks = view === 'locker' ? hierarchy(career, world) : [];
  const groups = view === 'locker' ? cliques(career, world) : [];
  const suggestions =
    view === 'locker' && l.mentors.length < MENTOR_SLOTS
      ? mentorSuggestions(career, world, MENTOR_SLOTS - l.mentors.length)
      : [];
  const tabs: [ClubView, string][] = [
    ['board', 'Diretoria'],
    ['preparation', 'Preparação'],
    ['staff', 'Comissão'],
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
        <button className="club-kpi" onClick={() => setView('staff')}>
          <span>Comissão técnica</span>
          <strong>Média {String(staffAvg).replace('.', ',')}/5</strong>
          <small>
            Analista {l.analyst}/5 · folha {money(payroll)}/mês
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
            {l.nationalInvite && !career.national && (
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

      {view === 'staff' && (
        <div className="club-grid staff-grid">
          <section className="panel staff-summary">
            <h2>Comissão técnica</h2>
            <p className="muted">
              Cada profissional tem nível de 1 a 5. Subir de nível troca o profissional por um
              melhor: pagamento único na contratação e salário mensal debitado no fechamento do mês.
              Rebaixar é grátis e alivia a folha.
            </p>
            <p>
              Folha da comissão: <strong>{money(payroll)}/mês</strong> · Caixa:{' '}
              <strong>{money(cash)}</strong>
            </p>
          </section>
          {staffRoles.map((role) => {
            const level = staffLevel(career, role);
            const hire = level < 5 ? staffHireCost(level + 1) : 0;
            return (
              <section key={role} className="panel staff-card" aria-label={staffTitles[role]}>
                <span className="staff-role">{staffTitles[role]}</span>
                <div className="staff-head">
                  <strong>{staffName(career, role)}</strong>
                  <Pips level={level} />
                </div>
                <p className="staff-step">AGORA · NÍVEL {level}</p>
                <ul className="club-rules">
                  {staffEffectText(role, level).map((t) => (
                    <li key={t} className="good">
                      {t}
                    </li>
                  ))}
                </ul>
                {level < 5 ? (
                  <>
                    <p className="staff-step next">NÍVEL {level + 1}</p>
                    <ul className="club-rules">
                      {staffEffectText(role, level + 1).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="muted small">O melhor profissional do mercado já está no cargo.</p>
                )}
                <small className="muted">
                  Salário {money(staffWage(level))}/mês
                  {level < 5 ? ` · nível ${level + 1}: ${money(staffWage(level + 1))}/mês` : ''}
                </small>
                <div className="button-row">
                  {level < 5 && (
                    <button
                      className="primary"
                      disabled={cash < hire}
                      title={cash < hire ? 'Caixa insuficiente' : undefined}
                      onClick={() => onHireStaff(role, level + 1)}
                    >
                      Contratar nível {level + 1} · {money(hire)}
                    </button>
                  )}
                  {level > 1 && (
                    <button onClick={() => onHireStaff(role, level - 1)}>
                      Trocar por nível {level - 1}
                    </button>
                  )}
                </div>
              </section>
            );
          })}
          <section className="panel staff-card" aria-label="Analista de desempenho">
            <span className="staff-role">Analista de desempenho</span>
            <div className="staff-head">
              <strong>Nível {l.analyst}</strong>
              <Pips level={l.analyst} />
            </div>
            <ul className="club-rules">
              <li className="good">
                Força do rival{' '}
                {analystLevels[l.analyst - 1].error === 'exato'
                  ? 'exata'
                  : `com erro de ${analystLevels[l.analyst - 1].error}`}
              </li>
              <li className="good">
                {analystLevels[l.analyst - 1].traits} ponto(s) fraco(s) por relatório
              </li>
              <li className={analystLevels[l.analyst - 1].odds ? 'good' : ''}>
                {analystLevels[l.analyst - 1].odds
                  ? 'Previsão de resultado ligada'
                  : 'Previsão de resultado a partir do nível 3'}
              </li>
            </ul>
            <small className="muted">Pagamento único, sem salário.</small>
            <div className="button-row">
              <button onClick={() => setView('analyst')}>Ver escada do analista</button>
            </div>
          </section>
          <section className="panel staff-card" aria-label="Olheiros">
            <span className="staff-role">Rede de olheiros</span>
            <div className="staff-head">
              <strong>{career.scouts.length}/3 olheiros</strong>
            </div>
            {career.scouts.length ? (
              <ul className="club-rules">
                {career.scouts.map((s) => (
                  <li key={s.id}>
                    {s.name} · {s.region} <Pips level={s.skill} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Nenhum olheiro contratado.</p>
            )}
            <small className="muted">
              Cada nível soma +1 de potencial e −1 de incerteza nos jovens encontrados.
            </small>
            {onOpenScouts && (
              <div className="button-row">
                <button onClick={onOpenScouts}>Gerenciar olheiros</button>
              </div>
            )}
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
        <div className="club-grid locker-grid">
          <section className="panel">
            <h2>Hierarquia do vestiário</h2>
            <p className="muted small">
              Influência por idade, tempo de clube, braçadeira, personalidade, nível e jogos.
            </p>
            <ul className="club-rules">
              <li className="good">Cada líder feliz (moral 75+) dá +1 de moral ao elenco no fim do mês (máx. +3).</li>
              <li className="bad">Líder 4+ jogos fora: −3 de moral para ele e para o grupo dele.</li>
              <li className="bad">Promessa quebrada: −2 de moral no grupo do atleta (−4 se for líder).</li>
            </ul>
            {tiers.map((tier) => {
              const rows = ranks.filter((r) => r.tier === tier);
              if (!rows.length) return null;
              const detailed = tier === 'Líderes' || tier === 'Influentes';
              return (
                <div key={tier} className={`locker-tier tier-${tier === 'Líderes' ? 'lead' : tier === 'Influentes' ? 'influent' : tier === 'Elenco' ? 'squad' : 'fringe'}`}>
                  <h3>
                    {tier} <small className="muted">{tierInfo[tier]}</small>
                  </h3>
                  {detailed ? (
                    rows.map((r) => (
                      <p key={r.player.id} className="locker-row">
                        <strong>{r.player.name}</strong>
                        <span className="muted small">{r.reasons.join(' · ') || 'respeitado pelo grupo'}</span>
                        <em>Moral {Math.round(career.players[r.player.id].morale)}</em>
                      </p>
                    ))
                  ) : (
                    <p className="small">{rows.map((r) => r.player.name).join(' · ')}</p>
                  )}
                </div>
              );
            })}
          </section>
          <section className="panel">
            <h2>Panelinhas e relações</h2>
            {groups.length ? (
              groups.map((g) => (
                <p key={g.name} className="club-relation amizade">
                  <span>{g.kind.toUpperCase()}</span>
                  <strong>{g.name}</strong>
                  <small className="muted">
                    {g.ids.map((id) => playerName(career, world, id).split(' ')[0]).join(', ')}
                  </small>
                </p>
              ))
            ) : (
              <p className="muted">Sem panelinhas marcantes no elenco.</p>
            )}
            <h3>Relações</h3>
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
              <p className="muted">Sem amizades ou rixas registradas.</p>
            )}
          </section>
          <section className="panel">
            <h2>
              Mentoria · {l.mentors.length}/{MENTOR_SLOTS}
            </h2>
            <p className="muted small">
              Veterano ({MENTOR_MIN_AGE}+ anos) guia um jovem (até {PUPIL_MAX_AGE}). O jovem evolui
              20% mais rápido (30% com mentor Líder, Profissional ou Disciplinado), os dois ganham +2
              de moral por mês e o jovem pode herdar a personalidade do mentor (8% ao mês, 15% com
              os perfis acima). Termina sozinha quando o jovem passa dos 23.
            </p>
            {l.mentors.map((m) => {
              const ms = career.players[m.mentor];
              return (
                <div key={m.pupil} className="mentor-pair">
                  <p>
                    <strong>{playerName(career, world, m.mentor)}</strong> →{' '}
                    <strong>{playerName(career, world, m.pupil)}</strong>
                    <small className="muted">
                      {' '}
                      desde {dateLabel(m.since)} · +{Math.round((mentorGrowth(ms) - 1) * 100)}%
                      evolução · {Math.round(inheritChance(ms) * 100)}% de herdar “{ms.personality}”
                    </small>
                  </p>
                  <button onClick={() => onEndMentor(m.pupil)}>Encerrar</button>
                </div>
              );
            })}
            {!l.mentors.length && <p className="muted">Nenhuma dupla formada.</p>}
            {suggestions.length > 0 && (
              <>
                <h3>Sugestões do auxiliar</h3>
                {suggestions.map((s) => (
                  <div key={s.pupil.id} className="mentor-pair">
                    <p>
                      {s.mentor.name}{' '}
                      <small className="muted">({career.players[s.mentor.id].personality})</small>{' '}
                      → {s.pupil.name}{' '}
                      <small className="muted">({s.pupil.position})</small>
                    </p>
                    <button className="primary" onClick={() => onMentor(s.mentor.id, s.pupil.id)}>
                      Formar dupla
                    </button>
                  </div>
                ))}
              </>
            )}
            <p className="muted small">Também dá para escolher na ficha do jogador (Time → Evolução e função).</p>
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
  const [visibleEvents, setVisibleEvents] = useState(40);
  const l = career.living;
  const titles = new Set(
    career.history.flatMap((season) =>
      season.trophies.map((competition) => `${season.season}:${competition}`),
    ),
  );
  for (const title of l.managerTitles?.entries || [])
    titles.add(`${title.season}:${title.competition}`);
  const record = l.managerRecord;
  const nationalGames = career.national?.fixtures.filter((fixture) => fixture.result) || [];
  const nationalWins = nationalGames.filter((fixture) => {
    const result = fixture.result!;
    return fixture.homeId === BRAZIL_NATIONAL_ID
      ? result.homeGoals > result.awayGoals
      : result.awayGoals > result.homeGoals;
  }).length;
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
      <section className="panel legacy-profile">
        <h2>{career.manager.firstName} {career.manager.lastName} · trajetória</h2>
        <div className="legacy-summary">
          <p><strong>{career.history.length}</strong><span>temporadas encerradas</span></p>
          <p><strong>{titles.size}</strong><span>títulos registrados</span></p>
          <p>
            <strong>{record ? record.won + record.drawn + record.lost : 0}</strong>
            <span>jogos de clube registrados</span>
          </p>
          {career.national && (
            <p><strong>{nationalWins}/{nationalGames.length}</strong><span>vitórias pela Seleção</span></p>
          )}
        </div>
        {record ? (
          <p className="muted">
            Clubes: {record.won} vitórias · {record.drawn} empates · {record.lost} derrotas
            {' '}· registro desde {dateLabel(record.since)}.
          </p>
        ) : (
          <p className="muted">O registro de resultados começa na próxima partida de clube.</p>
        )}
        {l.managerTitles && l.managerTitles.since > '2026-01-01' && (
          <p className="muted">
            Títulos anteriores à atualização aparecem quando constam no histórico de temporadas.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Linha do tempo</h2>
        {l.nationalInvite && !career.national && (
          <p className="living-headline">Convidado para treinar a Seleção Brasileira</p>
        )}
        {l.timeline.length ? (
          [...l.timeline]
            .reverse()
            .slice(0, visibleEvents)
            .map((e, i) => (
              <p key={i} tabIndex={0}>
                {kindIcon[e.kind]} <span className="muted">{dateLabel(e.date)}</span> {e.text}
              </p>
            ))
        ) : (
          <p className="muted">A história ainda está sendo escrita.</p>
        )}
        {visibleEvents < l.timeline.length && (
          <button onClick={() => setVisibleEvents((count) => count + 40)}>Ver eventos anteriores</button>
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
      <section className="panel legacy-seasons">
        <h2>Temporadas e conquistas</h2>
        {l.managerTitles?.entries.slice().reverse().map((title) => (
          <p key={`${title.season}-${title.competition}`} tabIndex={0}>
            🏆 {competitionName(title.competition)} {title.season} · {clubName(world, title.clubId)}
          </p>
        ))}
        {career.history.slice().reverse().map((season) => (
          <p key={`${season.season}-${season.clubId || 'antigo'}`} tabIndex={0}>
            <strong>{season.season}</strong> · {season.clubId ? clubName(world, season.clubId) : 'Clube não registrado'} ·{' '}
            Série {season.league}, {season.position}º
            {season.trophies.length ? ` · ${season.trophies.map(competitionName).join(', ')}` : ''}
          </p>
        ))}
        {!career.history.length && !l.managerTitles?.entries.length && (
          <p className="muted">Seu histórico será preenchido ao conquistar títulos e encerrar temporadas.</p>
        )}
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
