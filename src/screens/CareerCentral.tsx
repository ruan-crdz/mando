import { ArrowRight, CircleArrowRight, MessageSquare, Radio, Trophy, Users } from 'lucide-react';
import { Badge, dateLabel, ManagerPortrait, money } from '../components/ui';
import { fixtureLabel, nextFixture } from '../game/calendar';
import { clubById } from '../game/npc';
import { addDays } from '../game/random';
import { squad } from '../game/matches';
import { standings } from '../game/engine';
import { overall } from '../game/ratings';
import { type Career, type World } from '../game/types';
import { MarketFeed } from '../components/LivingPanels';

export function CareerCentral({
  career: c,
  world,
  onAdvance,
  onMatch,
  onTab,
  onNewSeason,
  busy,
}: {
  career: Career;
  world: World;
  onAdvance: () => void;
  onMatch: () => void;
  onTab: (tab: number) => void;
  onNewSeason: () => void;
  busy: boolean;
}) {
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const fixture = nextFixture(c);
  const home = fixture && clubById(world, fixture.homeId);
  const away = fixture && clubById(world, fixture.awayId);
  const label = fixture && fixtureLabel(fixture);
  const position = standings(c, world, club.league).findIndex((r) => r.clubId === c.clubId) + 1;
  const players = squad(c, world);
  const average = Math.round(
    players.reduce((n, p) => n + overall(p, p.position, c.players[p.id]), 0) / players.length,
  );
  const unread = c.messages.filter((m) => !m.read);
  const pending = c.messages.filter((m) => m.important && !m.resolved);
  const isMatchDay = Boolean(fixture && fixture.date <= c.date);
  const mode = c.prefs?.advance || 'day';
  const auto = mode === 'auto' && !c.seasonEnded;
  const advanceAction = auto
    ? onAdvance
    : pending.length
      ? () => onTab(3)
      : c.seasonEnded
        ? onNewSeason
        : isMatchDay
          ? onMatch
          : onAdvance;
  return (
    <div className="screen central">
      <div className="central-strip">
        <h1 className="screen-title">Bom trabalho, {c.manager.firstName}</h1>
        <span className="strip-meta">
          <span className="live-dot" /> TEMPORADA {c.season} ·{' '}
          {c.seasonEnded
            ? 'ENCERRADA'
            : c.date < `${c.season}-01-11`
              ? 'PRÉ-TEMPORADA'
              : 'EM ANDAMENTO'}{' '}
          · {dateLabel(c.date, true).toUpperCase()}
        </span>
      </div>
      <div className="central-grid">
        <button
          className="tile tile-blue fixture-tile"
          data-autofocus
          onClick={fixture ? onMatch : () => onTab(4)}
        >
          <span className="tile-label">
            <Radio size={14} /> {isMatchDay ? 'HOJE É DIA DE JOGO' : 'PRÓXIMO JOGO'}
            <em>{label ? label.stage.toUpperCase() : 'FIM DA TEMPORADA'}</em>
          </span>
          {fixture && home && away ? (
            <>
              <span className="matchup">
                <span>
                  <Badge club={home} size="large" />
                  <strong>{home.name}</strong>
                </span>
                <span className="versus">VS</span>
                <span>
                  <Badge club={away} size="large" />
                  <strong>{away.name}</strong>
                </span>
              </span>
              <span className="fixture-meta">
                {label!.name.toUpperCase()} · {dateLabel(fixture.date)} · {home.stadium}
              </span>
            </>
          ) : (
            <span className="season-complete">
              <Trophy size={64} />
              <strong>O apito final de {c.season}.</strong>
            </span>
          )}
        </button>
        <button
          className={`tile ${auto ? 'tile-green' : isMatchDay ? 'tile-orange' : pending.length ? 'tile-pink' : 'tile-green'} advance-tile`}
          disabled={busy}
          onClick={advanceAction}
        >
          <span className="tile-label">
            {auto
              ? 'MODO AUTOMÁTICO'
              : pending.length
                ? 'UMA DECISÃO ESPERA POR VOCÊ'
                : c.seasonEnded
                  ? 'FÉRIAS ACABARAM'
                  : isMatchDay
                    ? 'O ESTÁDIO ESTÁ PRONTO'
                    : 'O CLUBE NÃO PARA'}
          </span>
          <h2>
            {auto
              ? 'Simular temporada'
              : pending.length
                ? 'Abrir escritório'
                : c.seasonEnded
                  ? `Iniciar ${c.season + 1}`
                  : isMatchDay
                    ? 'Dia de jogo'
                    : mode === 'event'
                      ? 'Avançar até o evento'
                      : 'Avançar dia'}
          </h2>
          <span className="advance-dates">
            <span>
              {c.date.slice(8)}
              <small>
                {new Date(`${c.date}T12:00Z`)
                  .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                  .toUpperCase()}
              </small>
            </span>
            <CircleArrowRight size={34} strokeWidth={1.6} />
            <span>
              {addDays(c.date, 1).slice(8)}
              <small>
                {new Date(`${addDays(c.date, 1)}T12:00Z`)
                  .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                  .toUpperCase()}
              </small>
            </span>
          </span>
          <span className="tile-cta">
            {busy
              ? 'Processando…'
              : pending.length
                ? `${pending.length} ação necessária`
                : c.seasonEnded
                  ? 'Nova temporada'
                  : 'Continuar · START muda o modo'}
          </span>
        </button>
        <button className="tile tile-purple manager-tile" onClick={() => onTab(3)}>
          <span className="tile-label">MANAGER · {club.short}</span>
          <ManagerPortrait manager={c.manager} />
          <span className="manager-title">
            <strong>
              {c.manager.firstName}
              <br />
              {c.manager.lastName}
            </strong>
            <em>CONFIANÇA {Math.round(c.confidence)}%</em>
            <meter min={0} max={100} value={c.confidence} />
          </span>
        </button>
        <section className="tile tile-glass inbox-preview">
          <span className="tile-label">
            <MessageSquare size={14} /> MENSAGENS <b className="count">{unread.length}</b>
          </span>
          <div className="inbox-rows">
            {c.messages.slice(0, 4).map((m) => (
              <button className="inbox-row" key={m.id} onClick={() => onTab(3)}>
                <span
                  className={`message-indicator ${m.important && !m.resolved ? 'important' : ''}`}
                />
                <span>
                  <small>
                    {m.from} · {dateLabel(m.date)}
                  </small>
                  <strong>{m.title}</strong>
                </span>
              </button>
            ))}
          </div>
        </section>
        <button className="tile tile-orange squad-preview" onClick={() => onTab(1)}>
          <span className="tile-label">
            <Users size={14} /> SEU TIME <em>{c.tactic.formation}</em>
          </span>
          <span className="big-stat">
            {average}
            <small>OVR MÉDIO</small>
          </span>
          <span className="tile-sub">
            {players.length} atletas ·{' '}
            {players.filter((p) => c.players[p.id].injuryDays > 0).length} lesionados
          </span>
          <span className="tile-cta">
            GERENCIAR <ArrowRight size={16} />
          </span>
        </button>
        <button className="tile tile-cyan table-preview" onClick={() => onTab(4)}>
          <span className="tile-label">
            <Trophy size={14} /> SÉRIE {club.league}
          </span>
          <span className="big-stat">
            {position}º<small>NA TABELA</small>
          </span>
          <span className="tile-sub">Caixa {money(c.finances[c.clubId].cash)}</span>
          <span className="tile-cta">
            TEMPORADA <ArrowRight size={16} />
          </span>
        </button>
      </div>
      <MarketFeed career={c} world={world} />
      <div className="news-ticker">
        <span>MANDO NEWS</span>
        <p>
          {c.messages.find((m) => m.kind === 'news')?.title ||
            `${club.name} inicia um novo projeto. A primeira decisão é sua.`}
        </p>
      </div>
    </div>
  );
}
