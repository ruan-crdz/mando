import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleArrowRight,
  MessageSquare,
  Radio,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Badge,
  dateLabel,
  ManagerPortrait,
  Metric,
  money,
  SectionTitle,
  Tile,
} from '../components/ui';
import { nextFixture } from '../game/calendar';
import { addDays } from '../game/random';
import { squad } from '../game/matches';
import { standings } from '../game/engine';
import { overall } from '../game/ratings';
import { type Career, type World } from '../game/types';

export function CareerCentral({
  career: c,
  world,
  onAdvance,
  onMatch,
  onTab,
  busy,
}: {
  career: Career;
  world: World;
  onAdvance: () => void;
  onMatch: () => void;
  onTab: (tab: number) => void;
  busy: boolean;
}) {
  const club = world.clubs.find((club) => club.id === c.clubId)!;
  const fixture = nextFixture(c);
  const home = fixture && world.clubs.find((club) => club.id === fixture.homeId)!;
  const away = fixture && world.clubs.find((club) => club.id === fixture.awayId)!;
  const position = standings(c, world, club.league).findIndex((r) => r.clubId === c.clubId) + 1;
  const players = squad(c, world);
  const average = Math.round(
    players.reduce((n, p) => n + overall(p, p.position, c.players[p.id]), 0) / players.length,
  );
  const unread = c.messages.filter((m) => !m.read);
  const pending = c.messages.filter((m) => m.important && !m.resolved);
  const isMatchDay = Boolean(fixture && fixture.date <= c.date);
  return (
    <div className="screen-enter">
      <SectionTitle
        kicker={`TEMPORADA 2026 / ${c.date < '2026-01-28' ? 'PRÉ-TEMPORADA' : 'CARREIRA EM ANDAMENTO'}`}
        title={`Bom trabalho, ${c.manager.firstName}`}
      >
        <span className="weather">
          <span className="live-dot" /> {club.state} · {dateLabel(c.date, true)}
        </span>
      </SectionTitle>
      <div className="central-top">
        <Tile className="fixture-tile" onClick={fixture ? onMatch : () => onTab(4)}>
          <div className="tile-heading">
            <p className="eyebrow">
              <Radio size={14} /> {isMatchDay ? 'HOJE É DIA DE JOGO' : 'PRÓXIMO COMPROMISSO'}
            </p>
            <span className="pill">
              {fixture?.playoff
                ? 'PLAYOFF'
                : fixture
                  ? `RODADA ${fixture.round.toString().padStart(2, '0')}`
                  : 'FIM DA TEMPORADA'}
            </span>
          </div>
          {fixture && home && away ? (
            <>
              <div className="matchup">
                <div>
                  <Badge club={home} size="large" />
                  <h3>{home.name}</h3>
                </div>
                <span className="versus">×</span>
                <div>
                  <Badge club={away} size="large" />
                  <h3>{away.name}</h3>
                </div>
              </div>
              <div className="fixture-meta">
                <span>BRASILEIRÃO SÉRIE {fixture.league}</span>
                <span>
                  {dateLabel(fixture.date)} · {home.stadium}
                </span>
              </div>
            </>
          ) : (
            <div className="season-complete">
              <Trophy size={64} />
              <h2>O apito final de 2026.</h2>
              <p>Veja como ficou a sua história.</p>
            </div>
          )}
          <span className="fixture-action">
            {isMatchDay ? 'PREPARAR EQUIPE' : fixture ? 'VER CALENDÁRIO' : 'RELATÓRIO FINAL'}{' '}
            <ArrowRight size={17} />
          </span>
        </Tile>
        <div className="advance-column">
          <button
            className={`advance-tile ${isMatchDay ? 'match-day' : ''}`}
            disabled={busy || c.seasonEnded}
            onClick={pending.length ? () => onTab(3) : isMatchDay ? onMatch : onAdvance}
          >
            <p className="eyebrow">
              {pending.length
                ? 'UMA DECISÃO ESPERA POR VOCÊ'
                : isMatchDay
                  ? 'O ESTÁDIO ESTÁ PRONTO'
                  : 'O CLUBE NÃO PARA'}
            </p>
            <h2>
              {pending.length ? 'Abrir escritório' : isMatchDay ? 'Dia de jogo' : 'Avançar dia'}
            </h2>
            <div className="advance-dates">
              <span>
                {c.date.slice(8)}
                <small>
                  {new Date(`${c.date}T12:00Z`)
                    .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                    .toUpperCase()}
                </small>
              </span>
              <CircleArrowRight size={31} strokeWidth={1.3} />
              <span>
                {addDays(c.date, 1).slice(8)}
                <small>
                  {new Date(`${addDays(c.date, 1)}T12:00Z`)
                    .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                    .toUpperCase()}
                </small>
              </span>
            </div>
            <span className="advance-footnote">
              {busy
                ? 'Processando…'
                : pending.length
                  ? `${pending.length} ação necessária`
                  : 'Um novo dia. Uma nova história.'}
            </span>
          </button>
          <div className="quick-stats">
            <Metric label="NA TABELA" value={`${position}º`} note={`Série ${club.league}`} />
            <Metric label="CONFIANÇA" value={`${Math.round(c.confidence)}%`} note="da diretoria" />
          </div>
        </div>
        <Tile className="manager-tile" onClick={() => onTab(3)}>
          <p className="eyebrow">O HOMEM NO COMANDO</p>
          <div className="manager-watermark">M</div>
          <ManagerPortrait manager={c.manager} />
          <div className="manager-title">
            <span>MANAGER · {club.short}</span>
            <h2>
              {c.manager.firstName}
              <br />
              {c.manager.lastName}
            </h2>
            <span className="text-link">
              SEU ESCRITÓRIO <ChevronRight size={16} />
            </span>
          </div>
        </Tile>
      </div>
      <div className="central-bottom">
        <section className="panel inbox-preview">
          <div className="panel-heading">
            <h2>
              <MessageSquare size={19} /> Dentro do clube{' '}
              <span className="count">{unread.length}</span>
            </h2>
            <button className="text-button" onClick={() => onTab(3)}>
              VER TODAS <ArrowRight size={15} />
            </button>
          </div>
          {c.messages.slice(0, 3).map((m) => (
            <button className="inbox-row" key={m.id} onClick={() => onTab(3)}>
              <span
                className={`message-indicator ${m.important && !m.resolved ? 'important' : ''}`}
              />
              <span>
                <small>
                  {m.from} <span>· {dateLabel(m.date)}</span>
                </small>
                <strong>{m.title}</strong>
              </span>
              <ChevronRight size={17} />
            </button>
          ))}
        </section>
        <Tile className="squad-preview" onClick={() => onTab(1)}>
          <div className="tile-heading">
            <p className="eyebrow">
              <Users size={15} /> SEU TIME
            </p>
            <span className="pill">{c.tactic.formation}</span>
          </div>
          <h2>
            O plano começa
            <br />
            com onze.
          </h2>
          <div className="squad-summary">
            <strong>
              {average}
              <small>OVR MÉDIO</small>
            </strong>
            <div>
              <span>{players.length} atletas no elenco</span>
              <span>
                {players.filter((p) => c.players[p.id].injuryDays > 0).length} no departamento
                médico
              </span>
            </div>
          </div>
          <span className="text-link">
            GERENCIAR ELENCO <ArrowRight size={15} />
          </span>
          <div className="mini-pitch">
            <i />
            <i />
            <i />
          </div>
        </Tile>
        <div className="central-side">
          <Tile className="finance-preview" onClick={() => onTab(3)}>
            <p className="eyebrow">
              <TrendingUp size={15} /> SAÚDE FINANCEIRA
            </p>
            <h2>{money(c.finances[c.clubId].cash)}</h2>
            <p>Saldo disponível em caixa</p>
            <span className="finance-spark" />
          </Tile>
          <button className="calendar-shortcut" onClick={() => onTab(4)}>
            <CalendarDays size={20} />
            <span>
              Uma temporada pela frente<small>CALENDÁRIO E COMPETIÇÕES</small>
            </span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div className="news-ticker">
        <span>MANDO NEWS</span>
        <p>
          {c.messages.find((m) => m.kind === 'news')?.title ||
            `${club.name} inicia um novo projeto. A primeira decisão é sua.`}
        </p>
        <span className="live-dot" />
      </div>
    </div>
  );
}
