import { ArrowRight, CalendarClock, CircleArrowRight, Radio, Trophy } from 'lucide-react';
import { Badge, dateLabel } from '../components/ui';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { fixtureLabel, nextFixture } from '../game/calendar';
import { clubById } from '../game/npc';
import { addDays } from '../game/random';
import { standings } from '../game/engine';
import { type Career, type World } from '../game/types';
import { TAB } from '../navigation';

export function CareerCentral({
  career: c,
  world,
  onAdvance,
  onMatch,
  onTab,
  onOpenSeason,
  onNewSeason,
  onPreferences,
  busy,
}: {
  career: Career;
  world: World;
  onAdvance: () => void;
  onMatch: () => void;
  onTab: (tab: (typeof TAB)[keyof typeof TAB]) => void;
  onOpenSeason: (view: 'table') => void;
  onNewSeason: () => void;
  onPreferences: () => void;
  busy: boolean;
}) {
  const club = world.clubs.find((item) => item.id === c.clubId)!;
  const fixture = nextFixture(c);
  const home = fixture && clubById(world, fixture.homeId);
  const away = fixture && clubById(world, fixture.awayId);
  const label = fixture && fixtureLabel(fixture);
  const position =
    standings(c, world, club.league).findIndex((row) => row.clubId === c.clubId) + 1;
  const targetPosition = 6;
  const target = club.league === 'A' ? 'Classificar para a Libertadores (G6)' : 'Disputar o acesso';
  const pending = c.messages.filter((message) => message.important && !message.resolved);
  const isMatchDay = Boolean(fixture && fixture.date <= c.date);
  const mode = c.prefs?.advance || 'day';
  const auto = mode === 'auto' && !c.seasonEnded;
  const advanceAction = auto
    ? onAdvance
    : pending.length
      ? () => onTab(TAB.NOTIFICATIONS)
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
      <div className="central-grid">
        <button
          className="tile tile-primary fixture-tile"
          data-autofocus
          onClick={fixture ? onMatch : () => onOpenSeason('table')}
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
          className={`tile ${!auto && (pending.length || isMatchDay) ? 'tile-event' : 'tile-primary'} advance-tile`}
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
                ? 'Abrir notificações'
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
                ? `${pending.length} decisão${pending.length === 1 ? '' : 'ões'} pendente${pending.length === 1 ? '' : 's'}`
                : c.seasonEnded
                  ? 'Nova temporada'
                  : 'Continuar'}
          </span>
          <ControllerButtonHint action="menu" label="Mudar modo de avanço" />
        </button>
        <section className="tile tile-raised central-missions">
          <span className="tile-label">MISSÕES DA TEMPORADA</span>
          <article className="central-mission">
            <span className="eyebrow">OBJETIVO DO CLUBE</span>
            <strong>{target}</strong>
            <p>
              {position > 0
                ? `Posição atual: ${position}º${position <= targetPosition ? ' · objetivo em alcance' : ' · aproxime-se da zona de classificação'}`
                : 'A temporada ainda não começou.'}
            </p>
            <button onClick={() => onTab(TAB.OFFICE)}>
              Acompanhar objetivo <ArrowRight size={15} />
            </button>
          </article>
          <article className="central-mission">
            <span className="eyebrow">DECISÕES IMPORTANTES</span>
            <strong>
              {pending.length
                ? `${pending.length} decisão${pending.length === 1 ? '' : 'ões'} pendente${pending.length === 1 ? '' : 's'}`
                : 'Nenhuma decisão pendente'}
            </strong>
            <p>
              {pending[0]?.title || 'Novas mensagens e conversas com atletas aparecem em Notificações.'}
            </p>
            <button onClick={() => onTab(TAB.NOTIFICATIONS)}>
              Abrir notificações <ArrowRight size={15} />
            </button>
          </article>
        </section>
      </div>
    </div>
  );
}
