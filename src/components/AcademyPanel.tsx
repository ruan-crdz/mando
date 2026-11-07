import { useEffect, useRef, useState } from 'react';
import { type Career, type World, positions } from '../game/types';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { setDevelopmentPlan } from '../game/engine';
import { setTraining, familiarity, LEARNED } from '../game/positions';
import { positionTrainingEta } from '../game/squadManagement';
import { PlayerFace } from './PlayerFace';
import { PlayerStatsPanel } from './PlayerStatsPanel';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !focusedId ||
      c.living.academyRoster.some((player) => player.clubId === c.clubId && player.id === focusedId)
    )
      return;
    const frame = requestAnimationFrame(() =>
      list.current?.querySelector<HTMLButtonElement>('[data-academy-player]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [focusedId, c.living.academyRoster, c.clubId]);
  const apply = (operation: () => Career) => {
    try {
      onChange(operation());
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  if (view === 'roster') {
    const players = [...roster].sort(
      (a, b) =>
        overall(b, b.position, c.players[b.id]) - overall(a, a.position, c.players[a.id]) ||
        a.name.localeCompare(b.name),
    );
    const focused = players.find((player) => player.id === focusedId) ?? players[0];
    const select = (id: string) => {
      setFocusedId(id);
      setExpandedId((previous) => (previous === id ? previous : null));
    };
    return (
      <div className="squad-screen academy-roster-screen">
        <div className="squad-layout">
          {focused && <PlayerStatsPanel player={focused} career={c} />}
          <section
            className="panel squad-controls academy-roster-list"
            aria-label="Lista do elenco jovem"
          >
            <div className="panel-heading">
              <h2>Elenco jovem · {players.length} atletas</h2>
            </div>
            <p className="muted small">
              Selecione um atleta para ver a ficha à esquerda. Abra a linha para promover a partir
              dos 16 anos.
            </p>
            <div className="roster-columns academy-roster-columns" aria-hidden="true">
              <span>JOGADOR</span>
              <span>OVR · POTENCIAL · CONDIÇÃO</span>
            </div>
            <div className="card-scroll">
              <div className="roster-list" ref={list}>
                {players.map((player) => {
                  const state = c.players[player.id];
                  const age = ageAt(player.birthDate, c.date);
                  const open = expandedId === player.id;
                  return (
                    <div className={`roster-item ${open ? 'open' : ''}`} key={player.id}>
                      <button
                        className={`market-row roster-row academy-roster-row ${focused?.id === player.id ? 'focused' : ''}`}
                        data-academy-player={player.id}
                        data-age={age}
                        aria-expanded={open}
                        onFocus={() => select(player.id)}
                        onMouseEnter={() => select(player.id)}
                        onClick={() => {
                          setFocusedId(player.id);
                          setExpandedId((previous) => (previous === player.id ? null : player.id));
                        }}
                      >
                        <span>
                          <span className="position-tag">{state.position ?? player.position}</span>
                          <PlayerFace player={player} size="md" />
                          <span>
                            <strong>{player.name}</strong>
                            <small>
                              {age} anos · {player.nationality}
                            </small>
                          </span>
                        </span>
                        <span className="roster-category-values academy-roster-values">
                          <b className="roster-ovr">
                            {overall(player, state.position ?? player.position, state)}
                          </b>
                          <b>{player.potential + state.potentialDelta}</b>
                          <b>{Math.round(state.fitness)}%</b>
                        </span>
                      </button>
                      {open && (
                        <div className="roster-expand">
                          <p>
                            {state.minutes} minutos · {state.goals} gols · evolução{' '}
                            {state.growth >= 0 ? '+' : ''}
                            {state.growth.toFixed(2)}
                          </p>
                          {age >= 16 ? (
                            <button
                              className="primary"
                              data-controller-secondary
                              onClick={() => onPromote(player.id)}
                            >
                              Promover ao profissional{' '}
                              <ControllerButtonHint action="secondary" label="Promover" />
                            </button>
                          ) : (
                            <p className="muted small">Promoção disponível aos 16 anos.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {!players.length && (
              <p className="empty-state">
                Sem atletas na base. Use a captação de olheiros ou aguarde a próxima temporada.
              </p>
            )}
          </section>
        </div>
      </div>
    );
  }
  if (view === 'development')
    return (
      <section className="panel academy-youth-roster" data-stick-scroll>
        <h2>Desenvolvimento da base · {roster.length} atletas</h2>
        <p>
          Atletas fictícios do clube. Mesmos planos, treino de posição, potencial, moral e minutos
          usados no profissional. Promoção a partir dos 16 anos.
        </p>
        <div className="academy-player-grid">
          {roster.map((player) => {
            const state = c.players[player.id];
            const eta = state.training ? positionTrainingEta(player, c, state.training) : null;
            return (
              <article key={player.id}>
                <PlayerFace player={player} size="md" />
                <span>
                  {state.position ?? player.position} · {ageAt(player.birthDate, c.date)} anos
                </span>
                <strong>{player.name}</strong>
                <p>
                  OVR {overall(player, state.position ?? player.position, state)} · potencial{' '}
                  {player.potential + state.potentialDelta} · evolução +{state.growth.toFixed(2)}
                </p>
                <small>
                  {state.minutes} min · {state.goals} gols · ritmo {Math.round(state.sharpness)}%
                </small>
                <ChipGroup
                  label="Plano de desenvolvimento"
                  value={state.development}
                  options={(['Equilibrado', 'Ataque', 'Criação', 'Defesa', 'Físico'] as const).map(
                    (value) => ({ value, label: value }),
                  )}
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
