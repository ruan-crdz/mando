import {
  ArrowRight,
  CalendarClock,
  CircleArrowRight,
  MessageSquare,
  Radio,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge, dateLabel, ManagerPortrait, money } from '../components/ui';
import { CareerCalendar } from '../components/CareerCalendar';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
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
  onPreferences,
  busy,
}: {
  career: Career;
  world: World;
  onAdvance: () => void;
  onMatch: () => void;
  onTab: (tab: number) => void;
  onNewSeason: () => void;
  onPreferences: () => void;
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
  const auto = mode === 'auto' && !c.seasonEnded && !c.sacked;
  const advanceAction = c.sacked
    ? () => onTab(3)
    : auto
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
        <div>
          <p className="eyebrow">{club.name} · CENTRAL DO CLUBE</p>
          <h1 className="screen-title">Bom trabalho, {c.manager.firstName}</h1>
        </div>
        <div className="central-context">
          <span className="strip-meta">
            <span className="live-dot" /> TEMPORADA {c.season} ·{' '}
            {c.seasonEnded
              ? 'ENCERRADA'
              : c.date < `${c.season}-01-11`
                ? 'PRÉ-TEMPORADA'
                : 'EM ANDAMENTO'}{' '}
            · {dateLabel(c.date, true).toUpperCase()}
          </span>
          <button className="central-advance-mode" onClick={onPreferences}>
            <CalendarClock size={15} />{' '}
            {mode === 'auto'
              ? 'Nunca parar'
              : mode === 'event'
                ? 'Parar em eventos'
                : 'Um dia por vez'}
          </button>
        </div>
      </div>
      <CareerCalendar career={c} world={world} />
      <div className="central-grid">
        <button
          className="tile tile-primary fixture-tile"
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
          className={`tile ${c.sacked || (!auto && (pending.length || isMatchDay)) ? 'tile-event' : 'tile-primary'} advance-tile`}
          disabled={busy}
          onClick={advanceAction}
        >
          <span className="tile-label">
            {c.sacked
              ? 'CARGO ENCERRADO'
              : auto
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
            {c.sacked
              ? 'Escolher novo clube'
              : auto
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
              : c.sacked
                ? `${c.jobOffers.length} propostas na Diretoria`
                : pending.length
                  ? `${pending.length} ação necessária`
                  : c.seasonEnded
                    ? 'Nova temporada'
                    : 'Continuar'}
          </span>
          <ControllerButtonHint action="menu" label="Mudar modo de avanço" />
        </button>
        <MarketFeed career={c} world={world} onOpen={() => onTab(3)} />
        <button className="tile tile-raised manager-tile" onClick={() => onTab(3)}>
          <span className="tile-label">MANAGER · {club.short}</span>
          <ManagerPortrait manager={c.manager} />
          <span className="manager-title">
            <strong>
              {c.manager.firstName}
              <br />
              {c.manager.lastName}
            </strong>
            <em>CONFIANÇA {Math.round(c.confidence)}%</em>
            <meter aria-label="Confiança da diretoria" min={0} max={100} value={c.confidence} />
          </span>
        </button>
        <section className="tile tile-glass inbox-preview">
          <span className="tile-label">
            <MessageSquare size={14} /> MENSAGENS <b className="count">{unread.length}</b>
          </span>
          <div className="inbox-rows">
            {c.messages.slice(0, 4).map((m) => (
              <button
                className={`inbox-row ${m.read ? 'read' : 'unread'}`}
                key={m.id}
                onClick={() => onTab(3)}
              >
                <span
                  className={`message-indicator ${m.important && !m.resolved ? 'important' : ''}`}
                />
                <span>
                  <small>
                    {m.from} · {dateLabel(m.date)}
                  </small>
                  <strong>{m.title}</strong>
                  {m.important && !m.resolved && (
                    <em className="inbox-decision">DECISÃO PENDENTE</em>
                  )}
                </span>
              </button>
            ))}
            {!c.messages.length && <p className="inbox-empty">Sua caixa de entrada está em dia.</p>}
          </div>
        </section>
        <button className="tile tile-surface squad-preview" onClick={() => onTab(1)}>
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
        <button className="tile tile-data table-preview" onClick={() => onTab(4)}>
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
