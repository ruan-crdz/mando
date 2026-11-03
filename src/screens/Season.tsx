import { useState } from 'react';
import { CalendarDays, Medal, Trophy } from 'lucide-react';
import { Badge, dateLabel, SectionTitle } from '../components/ui';
import { standings } from '../game/engine';
import { milestones } from '../game/calendar';
import { type Career, type World } from '../game/types';

export function Season({ career: c, world }: { career: Career; world: World }) {
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const [league, setLeague] = useState<'A' | 'B'>(club.league);
  const [view, setView] = useState<'table' | 'calendar' | 'stats' | 'trophies'>('table');
  const table = standings(c, world, league);
  const ownFixtures = c.fixtures.filter((f) => f.homeId === c.clubId || f.awayId === c.clubId);
  const last = c.fixtures.filter((f) => f.league === league && f.result).slice(-10);
  const stats = world.players.filter(
    (p) => world.clubs.find((club) => club.id === c.players[p.id].clubId)?.league === league,
  );
  return (
    <div className="screen-enter">
      <SectionTitle kicker="TEMPORADA / 2026" title="Cada rodada conta.">
        <div className="segmented compact">
          {(['A', 'B'] as const).map((l) => (
            <button key={l} className={league === l ? 'active' : ''} onClick={() => setLeague(l)}>
              SÉRIE {l}
            </button>
          ))}
        </div>
      </SectionTitle>
      <div className="segmented">
        {(
          [
            ['table', 'Classificação', Trophy],
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
              <h2>Brasileirão Série {league}</h2>
              <span className="pill">2026</span>
            </div>
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
                  {table.map((r, i) => (
                    <tr
                      key={r.clubId}
                      className={`${r.clubId === c.clubId ? 'your-club' : ''} ${i >= 16 ? 'relegation' : i < (league === 'B' ? 2 : 6) ? 'qualification' : league === 'B' && i < 6 ? 'playoff-zone' : ''}`}
                    >
                      <td>{i + 1}</td>
                      <td>
                        <Badge
                          club={world.clubs.find((club) => club.id === r.clubId)!}
                          size="small"
                        />
                        {world.clubs.find((club) => club.id === r.clubId)!.name}
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
            <div className="table-legend">
              <span>● {league === 'B' ? 'Acesso direto' : 'Meta G6'}</span>
              {league === 'B' && <span>● Playoffs (3º–6º)</span>}
              <span>● Rebaixamento</span>
            </div>
          </section>
          <aside>
            <section className="panel">
              <p className="eyebrow">ÚLTIMOS RESULTADOS</p>
              {last.length ? (
                last.map((f) => (
                  <div className="result-row" key={f.id}>
                    <span>{world.clubs.find((club) => club.id === f.homeId)!.short}</span>
                    <strong>
                      {f.result!.homeGoals} : {f.result!.awayGoals}
                    </strong>
                    <span>{world.clubs.find((club) => club.id === f.awayId)!.short}</span>
                  </div>
                ))
              ) : (
                <p className="muted">A bola ainda não rolou.</p>
              )}
            </section>
            <section className="panel rules-panel">
              <p className="eyebrow">REGULAMENTO DA SIMULAÇÃO</p>
              <h3>
                {league === 'B' ? 'Um acesso disputado até o fim.' : '38 rodadas. Ida e volta.'}
              </h3>
              <p>
                {league === 'B'
                  ? 'Os dois primeiros sobem. 3º × 6º e 4º × 5º disputam ida e volta por mais duas vagas. Empate no agregado favorece a melhor campanha.'
                  : '20 clubes e 380 partidas. Quatro últimos rebaixados. Datas de rodadas geradas pelo simulador dentro do intervalo da temporada, não são a tabela oficial da CBF.'}
              </p>
              <p className="muted small">
                Desempate: pontos, vitórias, saldo, gols e ID estável. Playoffs e critérios devem
                ser conferidos com o regulamento oficial antes de publicar um mundo real.
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
              {ownFixtures.map((f) => (
                <div className={f.date === c.date ? 'today' : ''} key={f.id}>
                  <span>
                    <small>{f.playoff ? 'PLAYOFF' : `RODADA ${f.round}`}</small>
                    {dateLabel(f.date)}
                  </span>
                  <span>{world.clubs.find((club) => club.id === f.homeId)!.name}</span>
                  <strong>
                    {f.result ? `${f.result.homeGoals} : ${f.result.awayGoals}` : '×'}
                  </strong>
                  <span>{world.clubs.find((club) => club.id === f.awayId)!.name}</span>
                </div>
              ))}
            </div>
          </section>
          <aside className="panel">
            <p className="eyebrow">AGENDA NACIONAL</p>
            {milestones.map((m) => (
              <div className="milestone" key={m.title}>
                <CalendarDays size={17} />
                <div>
                  <strong>{m.title}</strong>
                  <p>
                    {dateLabel(m.date)}
                    {'end' in m ? ` — ${dateLabel(m.end)}` : ''}
                  </p>
                </div>
              </div>
            ))}
            <p className="muted small">
              Competições indicadas como expansão são referências de calendário, não partidas
              simuladas.
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
              <p className="eyebrow">BRASILEIRÃO SÉRIE {league}</p>
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
            {c.seasonEnded ? 'O ano que você construiu.' : 'A história ainda está sendo escrita.'}
          </h2>
          {c.seasonEnded ? (
            <>
              <p>
                Campeão Série A:{' '}
                <strong>
                  {world.clubs.find((club) => club.id === standings(c, world, 'A')[0].clubId)!.name}
                </strong>
              </p>
              <p>
                Campeão Série B:{' '}
                <strong>
                  {world.clubs.find((club) => club.id === standings(c, world, 'B')[0].clubId)!.name}
                </strong>
              </p>
              <p>
                Acesso à Série A:{' '}
                {c.promoted
                  .map((id) => world.clubs.find((club) => club.id === id)!.name)
                  .join(', ')}
              </p>
              <p>
                Seu clube:{' '}
                {standings(c, world, club.league).findIndex((r) => r.clubId === c.clubId) + 1}º ·
                Confiança {Math.round(c.confidence)}%
              </p>
            </>
          ) : (
            <p>As conquistas aparecem ao encerrar a temporada. Nada de troféus antecipados.</p>
          )}
        </div>
      )}
    </div>
  );
}
