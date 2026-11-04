import { AlertCircle, CalendarClock, MessageSquare, Square, Trophy } from 'lucide-react';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { fixtureLabel, nextFixture } from '../game/calendar';
import { nextNationalFixture } from '../game/national';
import { BRAZIL_NATIONAL_ID, clubById } from '../game/npc';
import { addDays } from '../game/random';
import { type Career, type World } from '../game/types';
import { dateLabel, Modal } from './ui';

export function CareerCalendar({
  career,
  world,
  pastDays = 0,
}: {
  career: Career;
  world: World;
  pastDays?: number;
}) {
  return (
    <ol className="career-calendar" aria-label="Agenda de cinco dias">
      {Array.from({ length: 5 }, (_, index) => {
        const offset = index - pastDays;
        const date = addDays(career.date, offset);
        const fixture = career.fixtures.find(
          (item) =>
            item.date === date && (item.homeId === career.clubId || item.awayId === career.clubId),
        );
        const opponent =
          fixture &&
          clubById(world, fixture.homeId === career.clubId ? fixture.awayId : fixture.homeId);
        const national = career.national?.fixtures.find((item) => item.date === date);
        const nationalOpponent =
          national &&
          clubById(
            world,
            national.homeId === BRAZIL_NATIONAL_ID ? national.awayId : national.homeId,
          );
        const messages = career.messages.filter((message) => message.date === date);
        const decisions = messages.filter((message) => message.important && !message.resolved);
        const parsed = new Date(`${date}T12:00:00Z`);
        return (
          <li
            key={date}
            className={`${offset === 0 ? 'today' : offset < 0 ? 'past' : 'upcoming'}${fixture ? ' match-day' : ''}`}
            aria-current={offset === 0 ? 'date' : undefined}
          >
            <time dateTime={date}>
              <span className="calendar-weekday">
                {offset === 0
                  ? 'HOJE'
                  : parsed
                      .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
                      .replace('.', '')
                      .toUpperCase()}
              </span>
              <strong>{date.slice(8)}</strong>
              <span className="calendar-month">
                {parsed
                  .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                  .replace('.', '')
                  .toUpperCase()}
              </span>
            </time>
            <span className="calendar-events">
              {opponent && fixture && (
                <span className="calendar-match" title={fixtureLabel(fixture).name}>
                  <Trophy size={12} aria-hidden="true" /> {opponent.short}
                </span>
              )}
              {nationalOpponent && (
                <span className="calendar-match" title="Amistoso da Seleção Brasileira">
                  <Trophy size={12} aria-hidden="true" /> BRA × {nationalOpponent.short}
                </span>
              )}
              {decisions.length ? (
                <span
                  className="calendar-decision"
                  title={`${decisions.length} ${decisions.length === 1 ? 'decisão pendente' : 'decisões pendentes'}`}
                >
                  <AlertCircle size={12} aria-hidden="true" /> {decisions.length}
                </span>
              ) : messages.length ? (
                <span
                  title={`${messages.length} ${messages.length === 1 ? 'mensagem' : 'mensagens'}`}
                >
                  <MessageSquare size={12} aria-hidden="true" /> {messages.length}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function AdvanceOverlay({
  career,
  world,
  startedAt,
  played,
  onStop,
}: {
  career: Career;
  world: World;
  startedAt: string;
  played: number;
  onStop: () => void;
}) {
  const automatic = career.prefs.advance === 'auto';
  const days = Math.max(
    0,
    Math.round((Date.parse(career.date) - Date.parse(startedAt)) / 86400000),
  );
  const clubFixture = nextFixture(career);
  const national = nextNationalFixture(career);
  const fixture =
    national && (!clubFixture || national.date <= clubFixture.date) ? national : clubFixture;
  const pending = career.messages.find((message) => message.important && !message.resolved);
  return (
    <Modal
      title={automatic ? 'Avançando até o fim da temporada' : 'Avançando até o próximo evento'}
      onClose={onStop}
      className="hub-modal simulation-dialog"
      wide
    >
      <div className="simulation-status" role="status">
        <CalendarClock size={30} aria-hidden="true" />
        <div>
          <p className="eyebrow">
            {automatic ? 'SIMULAÇÃO AUTOMÁTICA' : 'CALENDÁRIO EM MOVIMENTO'}
          </p>
          <strong>{dateLabel(career.date, true)}</strong>
        </div>
        <span className="simulation-count">
          <b>{days}</b> {days === 1 ? 'dia avançado' : 'dias avançados'}
          <small>
            {played} {played === 1 ? 'partida simulada' : 'partidas simuladas'}
          </small>
        </span>
      </div>
      <CareerCalendar career={career} world={world} pastDays={2} />
      <div className="simulation-next">
        <span className="eyebrow">PRÓXIMO COMPROMISSO</span>
        <strong>
          {pending
            ? pending.title
            : fixture
              ? `${clubById(world, fixture.homeId).name} × ${clubById(world, fixture.awayId).name}`
              : 'Sem partida marcada'}
        </strong>
        <span>
          {pending
            ? `${pending.from} · decisão no Escritório`
            : fixture
              ? `${fixtureLabel(fixture).name} · ${dateLabel(fixture.date)}`
              : `Temporada ${career.season}`}
        </span>
      </div>
      <div className="simulation-footer">
        <p>
          {automatic
            ? 'O auxiliar simula os jogos sem abrir a partida.'
            : 'Para em mensagens, decisões e dias de jogo.'}
        </p>
        <button className="primary" data-autofocus data-stop-run onClick={onStop}>
          <Square size={16} aria-hidden="true" />
          <ControllerButtonHint action="secondary" label="Parar" />
        </button>
      </div>
    </Modal>
  );
}
