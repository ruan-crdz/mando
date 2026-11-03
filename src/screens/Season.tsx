import { useState } from 'react';
import { CalendarDays, Medal, Trophy } from 'lucide-react';
import { Badge, dateLabel, SectionTitle } from '../components/ui';
import { standings } from '../game/engine';
import { competitionName, fixtureLabel, milestones } from '../game/calendar';
import { cupGroups, cupTies } from '../game/competitions';
import { clubById } from '../game/npc';
import { type Career, type TableRow, type World } from '../game/types';

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
    <div
      className="table-scroll"
      tabIndex={0}
      aria-label="Tabela de classificação, role para ver todas as colunas"
    >
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
            <tr key={r.clubId} className={`${r.clubId === c.clubId ? 'your-club' : ''} ${zone(i)}`}>
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

export function Season({ career: c, world }: { career: Career; world: World }) {
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const [comp, setComp] = useState<string>(club.league);
  const [view, setView] = useState<'table' | 'calendar' | 'stats' | 'trophies'>('table');
  const available = ['A', 'B', `EST-${club.state}`, 'CDB', 'SUP', 'LIB', 'SUL'].filter(
    (id) => id === 'A' || id === 'B' || c.fixtures.some((f) => f.cup === id),
  );
  const isLeague = comp === 'A' || comp === 'B';
  const statsLeague = isLeague ? (comp as 'A' | 'B') : club.league;
  const ownFixtures = c.fixtures.filter((f) => f.homeId === c.clubId || f.awayId === c.clubId);
  const compFixtures = c.fixtures.filter((f) => (isLeague ? f.league === comp : f.cup === comp));
  const last = compFixtures.filter((f) => f.result).slice(-10);
  const stats = world.players.filter(
    (p) => world.clubs.find((club) => club.id === c.players[p.id]?.clubId)?.league === statsLeague,
  );
  const champion = (id: string, season = c.season) =>
    c.honours.find((h) => h.season === season && h.competition === id)?.clubId;
  const ownTitles = c.honours.filter((h) => h.clubId === c.clubId);
  const family = comp.startsWith('EST-') ? 'EST' : comp;
  const ties = isLeague ? [] : cupTies(c, comp);
  const stages = [...new Set(ties.map((t) => t.stage))];
  return (
    <div className="screen-enter">
      <SectionTitle kicker={`TEMPORADA / ${c.season}`} title="Cada rodada conta.">
        <div className="segmented compact" role="tablist" aria-label="Competição">
          {available.map((id) => (
            <button
              key={id}
              className={comp === id ? 'active' : ''}
              onClick={() => setComp(id)}
              title={competitionName(id)}
            >
              {id === 'A' || id === 'B'
                ? `SÉRIE ${id}`
                : id.startsWith('EST-')
                  ? competitionName(id).toUpperCase()
                  : id}
            </button>
          ))}
        </div>
      </SectionTitle>
      <div className="segmented">
        {(
          [
            ['table', isLeague ? 'Classificação' : 'Chaves e grupos', Trophy],
            ['calendar', 'Calendário', CalendarDays],
            ['stats', 'Estatísticas', Medal],
            ['trophies', 'Conquistas', Trophy],
          ] as const
        ).map(([id, name, Icon]) => (
          <button className={view === id ? 'active' : ''} key={id} onClick={() => setView(id)}>
            <Icon size={16} />
            {name}
          </button>
        ))}
      </div>
      {view === 'table' && (
        <div className="season-layout">
          <section className="panel standings-panel">
            <div className="panel-heading">
              <h2>{competitionName(comp)}</h2>
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
                  <span>● {comp === 'B' ? 'Acesso direto' : 'Libertadores (G6)'}</span>
                  {comp === 'B' && <span>● Playoffs (3º–6º)</span>}
                  {comp === 'A' && <span>● Rebaixamento</span>}
                </div>
              </>
            ) : (
              <>
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
              </>
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
              <p className="muted small">
                Datas geradas pelo simulador dentro das janelas oficiais de {c.season}, sem
                conflitos de calendário; não são a tabela oficial da CBF/Conmebol.
              </p>
            </section>
          </aside>
        </div>
      )}
      {view === 'calendar' && (
        <div className="season-layout">
          <section className="panel">
            <h2>O caminho do {club.name}</h2>
            <div className="fixture-list">
              {ownFixtures.map((f) => {
                const label = fixtureLabel(f);
                return (
                  <div className={f.date === c.date ? 'today' : ''} key={f.id}>
                    <span>
                      <small>
                        {label.name} · {label.stage}
                      </small>
                      {dateLabel(f.date)}
                    </span>
                    <span>{clubById(world, f.homeId).name}</span>
                    <strong>
                      {f.result ? `${f.result.homeGoals} : ${f.result.awayGoals}` : '×'}
                    </strong>
                    <span>{clubById(world, f.awayId).name}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <aside className="panel">
            <p className="eyebrow">AGENDA NACIONAL</p>
            {milestones(c.season).map((m) => (
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
            <p className="muted small">
              Novas fases das copas entram no calendário assim que a fase anterior termina.
            </p>
          </aside>
        </div>
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
          ).map(([key, title]) => (
            <section className="panel" key={key}>
              <p className="eyebrow">CLUBES DA SÉRIE {statsLeague} · TODAS AS COMPETIÇÕES</p>
              <h2>{title}</h2>
              {[...stats]
                .sort((a, b) => c.players[b.id][key] - c.players[a.id][key])
                .slice(0, 10)
                .map((p, i) => (
                  <div className="stat-leader" key={p.id}>
                    <span>{i + 1}</span>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {world.clubs.find((club) => club.id === c.players[p.id].clubId)?.name}
                      </small>
                    </div>
                    <b>{c.players[p.id][key]}</b>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}
      {view === 'trophies' && (
        <div className="panel trophy-room">
          <Trophy size={70} strokeWidth={1} />
          <p className="eyebrow">SALA DE CONQUISTAS</p>
          <h2>
            {ownTitles.length
              ? `${ownTitles.length} ${ownTitles.length === 1 ? 'título' : 'títulos'} na sua gestão.`
              : 'A história ainda está sendo escrita.'}
          </h2>
          {ownTitles.map((h) => (
            <p key={`${h.season}-${h.competition}`}>
              🏆 <strong>{competitionName(h.competition)}</strong> {h.season}
            </p>
          ))}
          <p className="eyebrow">CAMPEÕES DE {c.season}</p>
          {['A', 'B', `EST-${club.state}`, 'SUP', 'CDB', 'LIB', 'SUL'].map((id) => (
            <p key={id}>
              {competitionName(id)}:{' '}
              <strong>{champion(id) ? clubById(world, champion(id)!).name : 'em disputa'}</strong>
            </p>
          ))}
          {c.seasonEnded && (
            <p>
              Acesso à Série A: {c.promoted.map((id) => clubById(world, id).name).join(', ')} ·
              Rebaixados: {c.relegated.map((id) => clubById(world, id).name).join(', ')}
            </p>
          )}
          {c.history.length > 0 && (
            <>
              <p className="eyebrow">SUA CARREIRA</p>
              {c.history.map((h) => (
                <p key={h.season}>
                  {h.season}: {h.position}º na Série {h.league} · confiança{' '}
                  {Math.round(h.confidence)}%
                  {h.trophies.length
                    ? ` · ${h.trophies.map((t) => competitionName(t)).join(', ')}`
                    : ''}
                </p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
