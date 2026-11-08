import { useMemo, useState } from 'react';
import { PlayerFace } from '../components/PlayerFace';
import { LegacyPanel } from '../components/LivingPanels';
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DoorClosed,
  DoorOpen,
  FastForward,
  Medal,
  Trophy,
} from 'lucide-react';
import { Badge, dateLabel, Modal, SectionTitle } from '../components/ui';
import { standings } from '../game/engine';
import {
  competitionName,
  fixtureCompetition,
  fixtureLabel,
  milestones,
  windowMark,
} from '../game/calendar';
import { cupGroups, cupTies } from '../game/competitions';
import { clubById } from '../game/npc';
import { type Career, type Fixture, type TableRow, type World } from '../game/types';
import { useGamepad, useStickX } from '../controller/GamepadProvider';

function StandingsTable({
  rows,
  career: c,
  world,
  zone,
}: {
  rows: TableRow[];
  career: Career;
  world: World;
  zone: (i: number) => string;
}) {
  return (
    <div className="table-scroll" aria-label="Tabela de classificação">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>CLUBE</th>
            {['P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.clubId}
              className={`${r.clubId === c.clubId ? 'your-club' : ''} ${zone(i)}`}
              tabIndex={0}
              aria-label={`${i + 1}º, ${clubById(world, r.clubId).name}, ${r.points} pontos`}
            >
              <td>{i + 1}</td>
              <td>
                <Badge club={clubById(world, r.clubId)} size="small" />
                {clubById(world, r.clubId).name}
              </td>
              <td>
                <strong>{r.points}</strong>
              </td>
              <td>{r.played}</td>
              <td>{r.won}</td>
              <td>{r.drawn}</td>
              <td>{r.lost}</td>
              <td>{r.gf}</td>
              <td>{r.ga}</td>
              <td>{r.gf - r.ga}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cupRules: Record<string, string> = {
  EST: 'Turno único entre clubes do estado (principais e convidados). Os quatro primeiros fazem semifinal e final em jogo único na casa do melhor; empate vai para os pênaltis.',
  CDB: '64 clubes: 40 das Séries A/B e 24 convidados nacionais. Fases iniciais em jogo único, a partir das oitavas ida e volta. Empate no agregado vai para os pênaltis.',
  SUP: 'Campeão brasileiro × campeão da Copa do Brasil (ou vice) em jogo único.',
  LIB: '32 clubes em 8 grupos de 4, ida e volta. Dois primeiros avançam; mata-mata ida e volta até a final em jogo único.',
  SUL: '32 clubes em 8 grupos de 4, ida e volta. Dois primeiros avançam; mata-mata ida e volta até a final em jogo único.',
};

const shortCompetition = (id: string) =>
  id === 'A'
    ? 'Série A'
    : id === 'B'
      ? 'Série B'
      : id === 'CDB'
        ? 'Copa do Brasil'
        : id === 'SUP'
          ? 'Supercopa'
          : id === 'LIB'
            ? 'Libertadores'
            : id === 'SUL'
              ? 'Sul-Americana'
              : competitionName(id);

const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const monthName = (month: string) =>
  new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T12:00:00Z`),
  );
const shiftMonth = (month: string, delta: number) => {
  const d = new Date(`${month}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
};

export type SeasonView = 'table' | 'calendar' | 'stats' | 'legacy';

export function Season({
  career: c,
  world,
  initialView,
  officeMode = false,
  embedded = false,
  onBack,
  onSimulateTo,
}: {
  career: Career;
  world: World;
  initialView?: SeasonView;
  officeMode?: boolean;
  embedded?: boolean;
  onBack?: () => void;
  onSimulateTo?: (date: string) => void;
}) {
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const { input, hints } = useGamepad();
  const [comp, setComp] = useState<string>(c.leagues[c.clubId] || club.league);
  const [view, setView] = useState<SeasonView>(initialView || 'table');
  const [month, setMonth] = useState(c.date.slice(0, 7));
  const [day, setDay] = useState(c.date);
  const [simTarget, setSimTarget] = useState<string | null>(null);
  const available = ['A', 'B', `EST-${club.state}`, 'CDB', 'SUP', 'LIB', 'SUL'].filter(
    (id) => id === 'A' || id === 'B' || c.fixtures.some((f) => f.cup === id),
  );
  const cycleComp = (dir: number) => {
    const i = Math.max(0, available.indexOf(comp));
    setComp(available[(i + dir + available.length) % available.length]);
  };
  const cycleMonth = (dir: number) => {
    const next = shiftMonth(month, dir);
    if (next.slice(0, 4) !== String(c.season)) return;
    setMonth(next);
    setDay(`${next}-01`);
  };
  useStickX((dir) => {
    if (view === 'calendar') {
      cycleMonth(dir);
      return;
    }
    if (view === 'table') {
      cycleComp(dir);
      return;
    }
    const selector = view === 'stats' ? '.stats-grid' : '.legacy-layout';
    const viewTarget = document.querySelector<HTMLElement>(`.season-screen ${selector}`);
    const target =
      viewTarget &&
      (view === 'legacy'
        ? viewTarget.scrollHeight > viewTarget.clientHeight
        : view === 'stats' && window.innerWidth <= 700
          ? viewTarget.scrollHeight > viewTarget.clientHeight
          : viewTarget.scrollWidth > viewTarget.clientWidth)
        ? viewTarget
        : document.querySelector<HTMLElement>('main.stage');
    if (!target) return;
    const vertical = view === 'legacy' || (view === 'stats' && window.innerWidth <= 700);
    target.scrollBy(
      vertical
        ? { top: dir * target.clientHeight * 0.6, behavior: 'smooth' }
        : { left: dir * target.clientWidth * 0.6, behavior: 'smooth' },
    );
  });
  const pad = input === 'xbox' || input === 'playstation';
  const isLeague = comp === 'A' || comp === 'B';
  const statsLeague = isLeague ? (comp as 'A' | 'B') : club.league;
  const ownFixtures = useMemo(
    () => c.fixtures.filter((f) => f.homeId === c.clubId || f.awayId === c.clubId),
    [c.fixtures, c.clubId],
  );
  const byDate = useMemo(() => {
    const map = new Map<string, Fixture>();
    for (const f of ownFixtures) map.set(f.date, f);
    return map;
  }, [ownFixtures]);
  const compFixtures = c.fixtures.filter((f) => (isLeague ? f.league === comp : f.cup === comp));
  const last = compFixtures.filter((f) => f.result).slice(-10);
  const stats = world.players.filter(
    (p) => world.clubs.find((club) => club.id === c.players[p.id]?.clubId)?.league === statsLeague,
  );
  const champion = (id: string, season = c.season) =>
    c.honours.find((h) => h.season === season && h.competition === id)?.clubId;
  const family = comp.startsWith('EST-') ? 'EST' : comp;
  const ties = isLeague ? [] : cupTies(c, comp);
  const stages = [...new Set(ties.map((t) => t.stage))];
  const switcher = (label: string, onPrev: () => void, onNext: () => void, dots?: string[]) => (
    <div className="stick-switcher" aria-live="polite">
      <button type="button" tabIndex={-1} aria-label="Anterior" onClick={onPrev}>
        <ChevronLeft size={20} />
      </button>
      <div>
        <strong>{label}</strong>
        {dots && (
          <span className="switcher-dots">
            {dots.map((d) => (
              <i key={d} className={d === comp ? 'on' : ''} />
            ))}
          </span>
        )}
      </div>
      <button type="button" tabIndex={-1} aria-label="Próximo" onClick={onNext}>
        <ChevronRight size={20} />
      </button>
      <small>{pad ? <kbd>{hints.stick}</kbd> : ', .'} ◄ ► trocar</small>
    </div>
  );

  // Calendário mensal: começa no domingo, completa a última semana.
  const first = new Date(`${month}-01T12:00:00Z`);
  const daysInMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const lead = first.getUTCDay();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => {
    const n = i - lead + 1;
    return n >= 1 && n <= daysInMonth ? `${month}-${String(n).padStart(2, '0')}` : null;
  });
  const dayFixture = byDate.get(day);
  const dayMilestones = milestones(c.season).filter((m) =>
    m.end ? m.date <= day && day <= m.end : m.date === day,
  );

  return (
    <div className="screen-enter season-screen">
      {!embedded && (
        <SectionTitle
          kicker={`${officeMode ? 'ESCRITÓRIO / DADOS DA TEMPORADA' : 'TEMPORADA'} / ${c.season}`}
          title={officeMode ? 'Competições e histórico.' : 'Cada rodada conta.'}
        >
          {officeMode && onBack && (
            <button onClick={onBack}>
              <ArrowLeft size={16} /> Voltar ao Escritório
            </button>
          )}
        </SectionTitle>
      )}
      {!embedded && (
        <div className="segmented" role="group" aria-label="Áreas da Temporada">
          {(
            [
              ['table', isLeague ? 'Classificação' : 'Chaves e grupos', Trophy],
              ['calendar', 'Calendário', CalendarDays],
              ['stats', 'Estatísticas', Medal],
              ['legacy', 'Carreira', Medal],
            ] as const
          ).map(([id, name, Icon]) => (
            <button
              className={view === id ? 'active' : ''}
              key={id}
              onClick={() => setView(id)}
              aria-pressed={view === id}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </div>
      )}
      {view === 'table' && (
        <div className="season-layout">
          <section className="panel standings-panel">
            <div className="panel-heading">
              {switcher(
                competitionName(comp),
                () => cycleComp(-1),
                () => cycleComp(1),
                available,
              )}
              <span className="pill">
                {champion(comp) ? `CAMPEÃO: ${clubById(world, champion(comp)!).short}` : c.season}
              </span>
            </div>
            {isLeague ? (
              <>
                <StandingsTable
                  rows={standings(c, world, comp as 'A' | 'B')}
                  career={c}
                  world={world}
                  zone={(i) =>
                    comp === 'A'
                      ? i >= 16
                        ? 'relegation'
                        : i < 6
                          ? 'qualification'
                          : ''
                      : i < 2
                        ? 'qualification'
                        : i < 6
                          ? 'playoff-zone'
                          : ''
                  }
                />
                <div className="table-legend">
                  <span className="legend-up">
                    ● {comp === 'B' ? 'Acesso direto' : 'Libertadores (G6)'}
                  </span>
                  {comp === 'B' && <span className="legend-playoff">● Playoffs (3º–6º)</span>}
                  {comp === 'A' && <span className="legend-down">● Rebaixamento</span>}
                  <span className="muted">
                    {pad ? <kbd>{hints.stick}</kbd> : 'Roda do mouse'} ▲▼ rolar
                  </span>
                </div>
              </>
            ) : (
              <div className="table-scroll cup-scroll">
                {cupGroups(c, comp).map((g) => (
                  <div key={g.group} className="cup-group">
                    <p className="eyebrow">
                      {g.group === 'Único' ? 'FASE DE CLASSIFICAÇÃO' : `GRUPO ${g.group}`}
                    </p>
                    <StandingsTable
                      rows={g.rows}
                      career={c}
                      world={world}
                      zone={(i) => (i < (family === 'EST' ? 4 : 2) ? 'qualification' : '')}
                    />
                  </div>
                ))}
                {stages.map((stage) => (
                  <div key={stage} className="cup-stage">
                    <p className="eyebrow">{stage.toUpperCase()}</p>
                    {ties
                      .filter((t) => t.stage === stage)
                      .map((t) => (
                        <div
                          key={t.tie}
                          className={`result-row tie-row ${[t.legs[0].homeId, t.legs[0].awayId].includes(c.clubId) ? 'your-club' : ''}`}
                        >
                          <span className={t.winner === t.legs[0].homeId ? 'winner' : ''}>
                            {clubById(world, t.legs[0].homeId).name}
                          </span>
                          <strong>
                            {t.legs
                              .map((f) =>
                                f.result
                                  ? `${f.result.homeGoals}:${f.result.awayGoals}${f.penalties ? ` (${f.penalties.home}-${f.penalties.away} pên.)` : ''}`
                                  : dateLabel(f.date),
                              )
                              .join(' / ')}
                          </strong>
                          <span className={t.winner === t.legs[0].awayId ? 'winner' : ''}>
                            {clubById(world, t.legs[0].awayId).name}
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
                {!stages.length && !cupGroups(c, comp).length && (
                  <p className="muted">Nenhuma partida desta competição na temporada.</p>
                )}
              </div>
            )}
          </section>
          <aside>
            <section className="panel">
              <p className="eyebrow">ÚLTIMOS RESULTADOS</p>
              {last.length ? (
                last.map((f) => (
                  <div className="result-row" key={f.id}>
                    <span>{clubById(world, f.homeId).short}</span>
                    <strong>
                      {f.result!.homeGoals} : {f.result!.awayGoals}
                    </strong>
                    <span>{clubById(world, f.awayId).short}</span>
                  </div>
                ))
              ) : (
                <p className="muted">A bola ainda não rolou.</p>
              )}
            </section>
            <section className="panel rules-panel">
              <p className="eyebrow">REGULAMENTO DA SIMULAÇÃO</p>
              <h3>
                {comp === 'B'
                  ? 'Um acesso disputado até o fim.'
                  : comp === 'A'
                    ? '38 rodadas. Ida e volta.'
                    : competitionName(comp)}
              </h3>
              <p>
                {comp === 'B'
                  ? 'Os dois primeiros sobem. 3º × 6º e 4º × 5º disputam ida e volta por mais duas vagas. Empate no agregado favorece a melhor campanha. A Série C não é simulada, então ninguém cai da Série B.'
                  : comp === 'A'
                    ? '20 clubes e 380 partidas. Quatro últimos rebaixados. G6 e campeão da Copa do Brasil vão à Libertadores; os seis seguintes à Sul-Americana.'
                    : cupRules[family]}
              </p>
            </section>
          </aside>
        </div>
      )}
      {view === 'calendar' && (
        <div className="season-layout calendar-layout">
          <section className="panel month-panel">
            <div className="panel-heading">
              {switcher(
                monthName(month),
                () => cycleMonth(-1),
                () => cycleMonth(1),
              )}
              <span className="pill">
                {ownFixtures.filter((f) => f.date.startsWith(month)).length} jogos
              </span>
            </div>
            <div className="month-grid">
              {weekDays.map((w) => (
                <span key={w} className="weekday">
                  {w}
                </span>
              ))}
              {cells.map((date, i) => {
                if (!date) return <span key={`x${i}`} className="day-cell blank" />;
                const f = byDate.get(date);
                const opponent = f && clubById(world, f.homeId === c.clubId ? f.awayId : f.homeId);
                const home = f?.homeId === c.clubId;
                const won =
                  f?.result &&
                  (home
                    ? f.result.homeGoals - f.result.awayGoals
                    : f.result.awayGoals - f.result.homeGoals);
                return (
                  <button
                    key={date}
                    type="button"
                    className={`day-cell ${f ? 'match' : ''} ${date === c.date ? 'today' : ''} ${date === day ? 'selected' : ''} ${date < c.date ? 'past' : ''} ${won !== undefined && won !== null && f?.result ? (won > 0 ? 'win' : won < 0 ? 'loss' : 'draw') : ''}`}
                    onClick={() => {
                      setDay(date);
                      if (onSimulateTo && date > c.date) setSimTarget(date);
                    }}
                    onFocus={() => setDay(date)}
                    aria-label={`${dateLabel(date, true)}${f ? `: ${opponent!.name}, ${shortCompetition(fixtureCompetition(f))}` : ''}`}
                  >
                    <span className="day-number">{Number(date.slice(8))}</span>
                    {windowMark(date) && (
                      <span
                        className={`window-mark ${windowMark(date)}`}
                        title={
                          windowMark(date) === 'open'
                            ? 'Abre a janela de transferências'
                            : 'Fecha a janela de transferências'
                        }
                      >
                        {windowMark(date) === 'open' ? (
                          <DoorOpen size={13} />
                        ) : (
                          <DoorClosed size={13} />
                        )}
                      </span>
                    )}
                    {f && opponent && (
                      <>
                        <span className="day-side">{home ? 'CASA' : 'FORA'}</span>
                        <Badge club={opponent} size="small" />
                        <small className="day-comp">
                          {f.result
                            ? `${f.result.homeGoals}–${f.result.awayGoals}`
                            : shortCompetition(fixtureCompetition(f))}
                        </small>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
          <aside className="panel day-panel">
            <p className="eyebrow">{dateLabel(day, true).toUpperCase()}</p>
            {dayFixture ? (
              <div className="day-fixture">
                <p className="eyebrow">
                  {fixtureLabel(dayFixture).name} · {fixtureLabel(dayFixture).stage}
                </p>
                <div className="day-versus">
                  <span>
                    <Badge club={clubById(world, dayFixture.homeId)} size="large" />
                    <strong>{clubById(world, dayFixture.homeId).short}</strong>
                  </span>
                  <b>
                    {dayFixture.result
                      ? `${dayFixture.result.homeGoals} : ${dayFixture.result.awayGoals}`
                      : '×'}
                  </b>
                  <span>
                    <Badge club={clubById(world, dayFixture.awayId)} size="large" />
                    <strong>{clubById(world, dayFixture.awayId).short}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <h3>Dia sem jogo · treino e recuperação.</h3>
            )}
            <p className="eyebrow">CALENDÁRIO DA TEMPORADA</p>
            {(dayMilestones.length
              ? dayMilestones
              : milestones(c.season).filter((m) => m.date.startsWith(month))
            ).map((m) => (
              <div className="milestone" key={m.title}>
                <CalendarDays size={17} />
                <div>
                  <strong>{m.title}</strong>
                  <p>
                    {dateLabel(m.date)}
                    {m.end ? ` — ${dateLabel(m.end)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </aside>
        </div>
      )}
      {simTarget && onSimulateTo && (
        <Modal title="Simular até esta data?" onClose={() => setSimTarget(null)}>
          <p>
            Avançar o calendário até {dateLabel(simTarget, true)}. A simulação para antes se houver
            jogo seu ou decisão importante no caminho.
          </p>
          <div className="button-row">
            <button
              className="primary"
              data-autofocus
              onClick={() => {
                const target = simTarget;
                setSimTarget(null);
                onSimulateTo(target);
              }}
            >
              <FastForward size={16} /> Simular
            </button>
            <button onClick={() => setSimTarget(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
      {view === 'stats' && (
        <div className="stats-grid">
          {(
            [
              ['goals', 'Artilharia'],
              ['assists', 'Assistências'],
              ['yellow', 'Cartões amarelos'],
              ['minutes', 'Minutos em campo'],
            ] as const
          ).map(([key, title]) => {
            const leaders = [...stats]
              .sort((a, b) => c.players[b.id][key] - c.players[a.id][key])
              .slice(0, 10);
            const topValue = Math.max(1, ...leaders.map((p) => c.players[p.id][key]));
            return (
              <section className="panel" key={key}>
                <p className="eyebrow">CLUBES DA SÉRIE {statsLeague} · TODAS AS COMPETIÇÕES</p>
                <h2>{title}</h2>
                {leaders.map((p, i) => (
                  <div
                    className="stat-leader"
                    key={p.id}
                    tabIndex={0}
                    aria-label={`${i + 1}º, ${p.name}, ${c.players[p.id][key]} ${title.toLowerCase()}`}
                  >
                    <span>{i + 1}</span>
                    <PlayerFace player={p} size="sm" />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {world.clubs.find((club) => club.id === c.players[p.id].clubId)?.name}
                      </small>
                    </div>
                    <b>{c.players[p.id][key]}</b>
                    <span className="stat-leader-track" aria-hidden="true">
                      <i style={{ width: `${(c.players[p.id][key] / topValue) * 100}%` }} />
                    </span>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {view === 'legacy' && <LegacyPanel career={c} world={world} />}
    </div>
  );
}
