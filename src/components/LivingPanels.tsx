import { useState } from 'react';
import { clubById, findPlayer } from '../game/npc';
import { competitionName } from '../game/calendar';
import { dateLabel, money } from './ui';
import { type Career, type Fixture, type Match, type World } from '../game/types';

const clubName = (world: World, id: string) => {
  try {
    return clubById(world, id).name;
  } catch {
    return id;
  }
};

const playerName = (world: World, id: string) => findPlayer(world, id)?.name || 'Atleta';

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
  const living = career.living;
  const titles = new Set(
    career.history.flatMap((season) =>
      season.trophies.map((competition) => `${season.season}:${competition}`),
    ),
  );
  for (const title of living.managerTitles?.entries || [])
    titles.add(`${title.season}:${title.competition}`);
  const record = living.managerRecord;
  const hall = Object.entries(living.clubStats)
    .sort((a, b) => b[1].games + b[1].goals * 3 - (a[1].games + a[1].goals * 3))
    .slice(0, 10);
  const sales = living.transfers
    .filter((transfer) => transfer.from === career.clubId)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);
  const buys = living.transfers
    .filter((transfer) => transfer.to === career.clubId)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);

  return (
    <div className="staff-layout legacy-layout">
      <section className="panel legacy-profile">
        <h2>
          {career.manager.firstName} {career.manager.lastName} · trajetória
        </h2>
        <div className="legacy-summary">
          <p>
            <strong>{career.history.length}</strong>
            <span>temporadas encerradas</span>
          </p>
          <p>
            <strong>{titles.size}</strong>
            <span>títulos registrados</span>
          </p>
          <p>
            <strong>{record ? record.won + record.drawn + record.lost : 0}</strong>
            <span>jogos de clube registrados</span>
          </p>
        </div>
        {record ? (
          <p className="muted">
            Clubes: {record.won} vitórias · {record.drawn} empates · {record.lost} derrotas ·
            registro desde {dateLabel(record.since)}.
          </p>
        ) : (
          <p className="muted">O registro de resultados começa na próxima partida de clube.</p>
        )}
        {living.managerTitles && living.managerTitles.since > '2026-01-01' && (
          <p className="muted">
            Títulos anteriores à atualização aparecem quando constam no histórico de temporadas.
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Linha do tempo</h2>
        {living.timeline.length ? (
          [...living.timeline]
            .reverse()
            .slice(0, visibleEvents)
            .map((event, index) => (
              <p key={index} tabIndex={0}>
                {kindIcon[event.kind]} <span className="muted">{dateLabel(event.date)}</span>{' '}
                {event.text}
              </p>
            ))
        ) : (
          <p className="muted">A história ainda está sendo escrita.</p>
        )}
        {visibleEvents < living.timeline.length && (
          <button onClick={() => setVisibleEvents((count) => count + 40)}>
            Ver eventos anteriores
          </button>
        )}
      </section>
      <section className="panel">
        <h2>Hall da fama</h2>
        {hall.map(([id, stats]) => (
          <p key={id} tabIndex={0}>
            <strong>{playerName(world, id)}</strong>{' '}
            <span className="muted">
              {stats.games} jogos · {stats.goals} gols · {stats.assists} assist.
            </span>
          </p>
        ))}
        {!hall.length && <p className="muted">Jogue partidas para formar ídolos.</p>}
      </section>
      <section className="panel">
        <h2>Maiores negócios</h2>
        <h3>Vendas</h3>
        {sales.map((transfer, index) => (
          <p key={index} tabIndex={0}>
            {playerName(world, transfer.playerId)} → {clubName(world, transfer.to)} ·{' '}
            {money(transfer.fee)}
          </p>
        ))}
        <h3>Contratações</h3>
        {buys.map((transfer, index) => (
          <p key={index} tabIndex={0}>
            {playerName(world, transfer.playerId)} ← {clubName(world, transfer.from)} ·{' '}
            {money(transfer.fee)}
          </p>
        ))}
      </section>
      <section className="panel legacy-seasons">
        <h2>Temporadas e títulos</h2>
        {living.managerTitles?.entries
          .slice()
          .reverse()
          .map((title) => (
            <p key={`${title.season}-${title.competition}`} tabIndex={0}>
              🏆 {competitionName(title.competition)} {title.season} · {clubName(world, title.clubId)}
            </p>
          ))}
        {career.history
          .slice()
          .reverse()
          .map((season) => (
            <p key={`${season.season}-${season.clubId || 'antigo'}`} tabIndex={0}>
              <strong>{season.season}</strong> ·{' '}
              {season.clubId ? clubName(world, season.clubId) : 'Clube não registrado'} · Série{' '}
              {season.league}, {season.position}º
              {season.trophies.length
                ? ` · ${season.trophies.map(competitionName).join(', ')}`
                : ''}
            </p>
          ))}
        {!career.history.length && !living.managerTitles?.entries.length && (
          <p className="muted">
            Seu histórico será preenchido ao conquistar títulos e encerrar temporadas.
          </p>
        )}
      </section>
    </div>
  );
}

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
  let ownXg = 0;
  let rivalXg = 0;
  const ours: string[] = ['0,90'];
  const theirs: string[] = ['0,90'];
  for (const event of match.events) {
    if (!event.xg) continue;
    if (event.clubId === clubId) ownXg += event.xg;
    else rivalXg += event.xg;
    ours.push(`${(event.minute / 90) * 300},${90 - ownXg * 25}`);
    theirs.push(`${(event.minute / 90) * 300},${90 - rivalXg * 25}`);
  }
  ours.push(`300,${90 - ownXg * 25}`);
  theirs.push(`300,${90 - rivalXg * 25}`);
  const us = ownHome ? match.home : match.away;
  const them = ownHome ? match.away : match.home;
  const goalsFor = ownHome ? match.homeGoals : match.awayGoals;
  const goalsAgainst = ownHome ? match.awayGoals : match.homeGoals;
  const reasons: string[] = [];
  if (goalsFor > goalsAgainst)
    reasons.push(
      us.xg >= them.xg
        ? 'Vitória construída: criamos mais chances claras.'
        : 'Vitória com eficiência: o rival criou mais, mas fomos letais.',
    );
  else if (goalsFor < goalsAgainst)
    reasons.push(
      us.xg > them.xg
        ? 'Derrota injusta pelos números: criamos mais e faltou pontaria.'
        : 'Derrota merecida: o rival criou chances melhores.',
    );
  else reasons.push('Empate equilibrado nas chances.');
  if (us.possession >= 58) reasons.push(`Dominamos a bola (${us.possession}%).`);
  if (us.possession <= 42) reasons.push(`Cedemos a posse (${us.possession}%).`);
  return (
    <div className="match-analysis">
      <h3>Por que {goalsFor > goalsAgainst ? 'vencemos' : goalsFor < goalsAgainst ? 'perdemos' : 'empatamos'}</h3>
      <svg viewBox="0 0 300 95" preserveAspectRatio="none" aria-label="xG acumulado">
        <polyline points={ours.join(' ')} fill="none" stroke="#22c55e" strokeWidth="3" />
        <polyline points={theirs.join(' ')} fill="none" stroke="#ef4444" strokeWidth="3" />
      </svg>
      <p className="muted small">
        xG acumulado: nós {ownXg.toFixed(2)} (verde) × {rivalXg.toFixed(2)} rival (vermelho)
      </p>
      {reasons.map((reason) => (
        <p key={reason} className="small">
          {reason}
        </p>
      ))}
    </div>
  );
}
