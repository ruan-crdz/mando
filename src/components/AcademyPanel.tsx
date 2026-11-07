import { type Career, type World, positions } from '../game/types';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { setDevelopmentPlan } from '../game/engine';
import { setTraining, familiarity, LEARNED } from '../game/positions';
import { positionTrainingEta } from '../game/squadManagement';
import { PlayerFace } from './PlayerFace';
import { ChipGroup, OptionCycler } from './controls';
import { dateLabel } from './ui';

export function AcademyPanel({
  career: c,
  world,
  view,
  onChange,
  onPromote,
  onError,
}: {
  career: Career;
  world: World;
  view: 'roster' | 'development' | 'tournament';
  onChange: (career: Career) => void;
  onPromote: (id: string) => void;
  onError: (message: string) => void;
}) {
  const roster = c.living.academyRoster.filter((player) => player.clubId === c.clubId);
  const apply = (operation: () => Career) => {
    try {
      onChange(operation());
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  if (view !== 'tournament')
    return (
      <section className="panel academy-youth-roster" data-stick-scroll>
        <h2>
          {view === 'development' ? 'Desenvolvimento da base' : 'Elenco jovem'} · {roster.length}{' '}
          atletas
        </h2>
        <p>
          Atletas fictícios do clube. Mesmos planos, treino de posição, potencial, moral e minutos
          usados no profissional. Promoção a partir dos 16 anos.
        </p>
        <div className="academy-player-grid">
          {roster.map((player) => {
            const state = c.players[player.id];
            const age = ageAt(player.birthDate, c.date);
            const eta = state.training ? positionTrainingEta(player, c, state.training) : null;
            return (
              <article key={player.id}>
                <PlayerFace player={player} size="md" />
                <span>
                  {state.position ?? player.position} · {age} anos
                </span>
                <strong>{player.name}</strong>
                <p>
                  OVR {overall(player, state.position ?? player.position, state)} · potencial{' '}
                  {player.potential + state.potentialDelta} · evolução +{state.growth.toFixed(2)}
                </p>
                <small>
                  {state.minutes} min · {state.goals} gols · ritmo {Math.round(state.sharpness)}%
                </small>
                {view === 'roster' ? (
                  age >= 16 ? (
                    <button className="primary" onClick={() => onPromote(player.id)}>
                      Promover ao profissional
                    </button>
                  ) : (
                    <p className="muted small">Promoção disponível aos 16 anos.</p>
                  )
                ) : (
                  <>
                    <ChipGroup
                      label="Plano de desenvolvimento"
                      value={state.development}
                      options={(
                        ['Equilibrado', 'Ataque', 'Criação', 'Defesa', 'Físico'] as const
                      ).map((value) => ({ value, label: value }))}
                      onChange={(plan) => apply(() => setDevelopmentPlan(c, player.id, plan))}
                    />
                    <OptionCycler
                      label="Treinar posição"
                      value={state.training ?? 'none'}
                      options={[
                        { value: 'none', label: 'Sem treino específico' },
                        ...positions
                          .filter(
                            (position) =>
                              (position === 'GK') === (player.position === 'GK') &&
                              familiarity(player, position, state) < LEARNED,
                          )
                          .map((value) => ({ value, label: value })),
                      ]}
                      onChange={(target) =>
                        apply(() =>
                          setTraining(
                            c,
                            player,
                            target === 'none'
                              ? null
                              : (positions.find((position) => position === target) ?? null),
                          ),
                        )
                      }
                    />
                    {eta && (
                      <p>
                        {eta.current.toFixed(0)}% de familiaridade · cerca de {eta.weeks} semanas.
                      </p>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
        {!roster.length && (
          <p className="empty-state">
            Sem atletas na base. Use a captação de olheiros ou aguarde a próxima temporada.
          </p>
        )}
      </section>
    );
  const fixtures = c.living.academyFixtures;
  const clubs = [...new Set(fixtures.flatMap((fixture) => [fixture.homeId, fixture.awayId]))];
  const rows = clubs
    .map((clubId) => {
      let played = 0,
        points = 0,
        gf = 0,
        ga = 0;
      for (const fixture of fixtures) {
        if (
          fixture.homeGoals === undefined ||
          fixture.awayGoals === undefined ||
          (fixture.homeId !== clubId && fixture.awayId !== clubId)
        )
          continue;
        const goals = fixture.homeId === clubId ? fixture.homeGoals : fixture.awayGoals;
        const conceded = fixture.homeId === clubId ? fixture.awayGoals : fixture.homeGoals;
        played++;
        gf += goals;
        ga += conceded;
        points += goals > conceded ? 3 : goals === conceded ? 1 : 0;
      }
      return { clubId, played, points, gf, ga };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gf - b.ga - (a.gf - a.ga) ||
        b.gf - a.gf ||
        a.clubId.localeCompare(b.clubId),
    );
  const name = (id: string) => world.clubs.find((club) => club.id === id)?.name ?? id;
  return (
    <section className="panel academy-tournament" data-stick-scroll>
      <h2>Liga de base Sub-20 · {c.season}</h2>
      <p>
        8 clubes · 14 rodadas · ida e volta. Simulação aos sábados pelo calendário. Participar
        concede minutos e ritmo que influenciam o desenvolvimento.
      </p>
      {fixtures.every((fixture) => fixture.homeGoals !== undefined) && rows[0] && (
        <h3>Campeão: {name(rows[0].clubId)}</h3>
      )}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>CLUBE</th>
            <th>P</th>
            <th>J</th>
            <th>GP</th>
            <th>GC</th>
            <th>SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.clubId} className={row.clubId === c.clubId ? 'your-club' : ''}>
              <td>{index + 1}</td>
              <td>{name(row.clubId)}</td>
              <td>{row.points}</td>
              <td>{row.played}</td>
              <td>{row.gf}</td>
              <td>{row.ga}</td>
              <td>{row.gf - row.ga}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Calendário do seu clube</h3>
      <div className="academy-fixture-list">
        {fixtures
          .filter((fixture) => fixture.homeId === c.clubId || fixture.awayId === c.clubId)
          .map((fixture) => (
            <article key={fixture.id}>
              <small>{dateLabel(fixture.date)}</small>
              <span>
                {name(fixture.homeId)} {fixture.homeGoals ?? '—'} × {fixture.awayGoals ?? '—'}{' '}
                {name(fixture.awayId)}
              </span>
            </article>
          ))}
      </div>
    </section>
  );
}
