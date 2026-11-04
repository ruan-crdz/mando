import { useMemo, useState } from 'react';
import { Flag, Play, Search, Users } from 'lucide-react';
import { dateLabel } from './ui';
import { eligibleForBrazil } from '../game/international';
import {
  acceptNationalJob,
  autoSelectNational,
  beginNationalMatch,
  nextNationalFixture,
  swapNationalStarter,
  toggleNationalCallup,
} from '../game/national';
import { BRAZIL_NATIONAL_ID, clubById } from '../game/npc';
import { overall } from '../game/ratings';
import { formations, type Career, type Player, type World } from '../game/types';

const pageSize = 20;

export function NationalPanel({
  career,
  world,
  onChange,
  onError,
}: {
  career: Career;
  world: World;
  onChange: (career: Career) => void;
  onError: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [outgoing, setOutgoing] = useState('');
  const national = career.national;
  const callups = national?.callups || [];
  const pool = useMemo(
    () =>
      world.players
        .filter(
          (player) =>
            eligibleForBrazil(career, player) &&
            player.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
        )
        .sort(
          (a, b) =>
            overall(b, b.position, career.players[b.id]) -
              overall(a, a.position, career.players[a.id]) || a.name.localeCompare(b.name),
        ),
    [career, world, query],
  );
  const run = (action: () => Career) => {
    try {
      onChange(action());
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };
  if (!national) {
    return (
      <section className="panel national-intro">
        <Flag size={28} />
        <h2>Seleção Brasileira</h2>
        <p>
          Conquiste um título nacional ou continental relevante, ou quatro títulos na carreira,
          mantendo a confiança da diretoria para receber o convite ao fim da temporada.
        </p>
        {career.living.nationalInvite ? (
          <>
            <p className="living-headline">A Seleção quer você no comando, em paralelo ao clube.</p>
            <button className="primary" onClick={() => run(() => acceptNationalJob(career, world))}>
              Aceitar o convite
            </button>
          </>
        ) : (
          <p className="muted">O convite ainda não chegou. Sua trajetória no clube continua normalmente.</p>
        )}
        <p className="muted">
          Convocações e amistosos usam o mundo da carreira, adversários simulados e datas fictícias.
        </p>
      </section>
    );
  }

  const next = nextNationalFixture(career);
  const home = next?.homeId === BRAZIL_NATIONAL_ID;
  const rival = next && clubById(world, home ? next.awayId : next.homeId);
  const ready = Boolean(next && next.date <= career.date);
  const players = new Map(world.players.map((player) => [player.id, player]));
  const reserves = callups.filter((id) => !national.lineup.includes(id));
  const status = (player: Player) => {
    const state = career.players[player.id];
    if (state.retired || !state.clubId) return 'Fora de atividade';
    if (state.injuryDays) return `Lesão: ${state.injuryDays}d`;
    if (national.suspensions[player.id]) return 'Suspenso pela Seleção';
    if (state.fitness < 30) return 'Condição insuficiente';
    return `${Math.round(state.fitness)}% de condição`;
  };
  const pages = Math.max(1, Math.ceil(pool.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const recent = national.fixtures.filter((fixture) => fixture.result).slice(-5).reverse();

  return (
    <div className="national-layout">
      <section className="panel national-summary">
        <div>
          <p className="eyebrow"><Flag size={15} /> SELEÇÃO BRASILEIRA</p>
          <h2>{next && rival ? `Brasil × ${rival.name}` : 'Agenda internacional concluída'}</h2>
          <p className="muted">
            {next
              ? `${dateLabel(next.date, true)} · ${home ? 'Em casa' : 'Fora'} · amistoso simulado`
              : 'Novos amistosos serão marcados na próxima temporada.'}
          </p>
          <p className="muted">
            Até 23 convocados. Durante a janela internacional eles desfalcam seus clubes.
            A convocação não pode agravar a falta de atletas ou deixar um clube sem goleiro.
          </p>
        </div>
        <div className="national-actions">
          <button onClick={() => run(() => autoSelectNational(career, world))}>
            <Users size={16} /> Recomendar convocação
          </button>
          <button
            className="primary"
            disabled={!ready}
            onClick={() => run(() => beginNationalMatch(career, world))}
          >
            <Play size={16} /> {ready ? 'Começar partida' : 'Aguardar dia do jogo'}
          </button>
        </div>
      </section>

      <section className="panel national-lineup">
        <h2>Escalação · {national.tactic.formation}</h2>
        <p className="muted">
          Escolha um titular e depois um reserva para trocar. A convocação pode ser ajustada abaixo.
        </p>
        <div className="national-starters">
          {formations[national.tactic.formation].map((role, index) => {
            const id = national.lineup[index];
            const player = players.get(id);
            return (
              <button
                key={`${role}-${index}`}
                disabled={!player}
                className={outgoing === id ? 'active' : ''}
                aria-pressed={outgoing === id}
                onClick={() => setOutgoing(outgoing === id ? '' : id)}
              >
                <b>{role}</b> {player?.name || 'Vaga livre'}
                {player && <small>{status(player)}</small>}
              </button>
            );
          })}
        </div>
        <h3>Reservas convocados</h3>
        {reserves.length ? (
          <div className="national-reserves">
            {reserves.map((id) => {
              const player = players.get(id);
              if (!player) return null;
              return (
                <button
                  key={id}
                  disabled={!outgoing}
                  onClick={() => {
                    run(() => swapNationalStarter(career, world, outgoing, id));
                    setOutgoing('');
                  }}
                >
                  {player.position} · {player.name} <small>{status(player)}</small>
                </button>
              );
            })}
          </div>
        ) : <p className="muted">Nenhum reserva convocado.</p>}
      </section>

      <section className="panel national-callups">
        <h2>Convocados · {callups.length}/23</h2>
        <p className="muted">
          Dispensar um titular reorganiza a escalação. Alterações na janela atual atualizam os
          desfalques dos clubes.
        </p>
        <div className="national-player-list">
          {callups.map((id) => {
            const player = players.get(id);
            if (!player) return null;
            return (
              <div key={id} className="national-player-row">
                <span>
                  <strong>{player.name}</strong>
                  <small>{player.position} · {status(player)}</small>
                </span>
                <button onClick={() => run(() => toggleNationalCallup(career, world, id))}>
                  Dispensar
                </button>
              </div>
            );
          })}
        </div>
        {recent.length > 0 && (
          <>
            <h3>Últimos amistosos</h3>
            {recent.map((fixture) => (
              <p key={fixture.id} className="muted">
                {dateLabel(fixture.date)} · {clubById(world, fixture.homeId).short}{' '}
                {fixture.result!.homeGoals} × {fixture.result!.awayGoals}{' '}
                {clubById(world, fixture.awayId).short}
              </p>
            ))}
          </>
        )}
      </section>

      <section className="panel national-search">
        <h2><Search size={18} /> Buscar brasileiros</h2>
        <label>
          <span className="muted">Nome do atleta</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Pesquisar no mundo da carreira"
          />
        </label>
        <div className="national-player-list">
          {pool.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((player) => {
            const selected = callups.includes(player.id);
            const clubId = career.players[player.id].clubId!;
            return (
              <div key={player.id} className="national-player-row">
                <span>
                  <strong>{player.name}</strong>
                  <small>
                    {player.position} · OVR {overall(player, player.position, career.players[player.id])} ·{' '}
                    {clubById(world, clubId).short}
                  </small>
                </span>
                <button
                  disabled={!selected && callups.length >= 23}
                  onClick={() => run(() => toggleNationalCallup(career, world, player.id))}
                >
                  {selected ? 'Dispensar' : 'Convocar'}
                </button>
              </div>
            );
          })}
          {!pool.length && <p className="muted">Nenhum atleta encontrado.</p>}
        </div>
        <div className="national-pagination">
          <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button>
          <span>{currentPage + 1} / {pages}</span>
          <button disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Próxima</button>
        </div>
      </section>
    </div>
  );
}
