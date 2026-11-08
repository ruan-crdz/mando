import { MatchAnalysis } from '../components/LivingPanels';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Check,
  Megaphone,
  Pause,
  Play,
  Shield,
  SlidersHorizontal,
  Star,
  Volume2,
} from 'lucide-react';
import {
  available,
  shoutChoices,
  shoutFromSideline,
  sideFormation,
  stepMatch,
} from '../game/matches';
import { manOfTheMatch, matchRatings, ratingTone } from '../game/matchRatings';
import { fixtureLabel } from '../game/calendar';
import { clubById, findPlayer } from '../game/npc';
import { shirtNumbers } from '../game/numbers';
import { formations, type Career, type Formation, type Player, type World } from '../game/types';
import { Badge, Modal } from '../components/ui';
import { ChipGroup, TacticSlider } from '../components/controls';
import { LivePitch, type PitchTeam } from '../components/LivePitch';
import { byPosition, PlayerCard, PlayerPicker, roleFits } from '../components/PlayerCard';
import { PlayerFace } from '../components/PlayerFace';
import { useGamepad } from '../controller/GamepadProvider';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { crowdGoal, setCrowdPlaying } from '../audio/sound';

const fits = (p: Player, role: string) => (roleFits[role] || [role]).includes(p.position);
const matchNumber = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MatchScreen({
  career: c,
  world,
  onChange,
  onFinish,
  onSubstitute,
  onError,
  paused,
}: {
  career: Career;
  world: World;
  onChange: (c: Career) => void;
  onFinish: () => void;
  onSubstitute: (outgoing: string, incoming: string) => void;
  onError: (message: string) => void;
  paused: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [sub, setSub] = useState(false);
  const [tactic, setTactic] = useState(false);
  const [shout, setShout] = useState(false);
  const [outgoing, setOut] = useState('');
  const [incoming, setIn] = useState('');
  const { rumble } = useGamepad();
  const latest = useRef(c);
  const finishButton = useRef<HTMLButtonElement>(null);
  latest.current = c;
  const match = c.activeMatch!;
  const scoreRef = useRef({ home: match.homeGoals, away: match.awayGoals, minute: match.minute });
  const fixture = c.fixtures.find((f) => f.id === match.fixtureId)!;
  const home = clubById(world, fixture.homeId);
  const away = clubById(world, fixture.awayId);
  const label = fixtureLabel(fixture);
  const ownLineup = fixture.homeId === c.clubId ? match.homeLineup : match.awayLineup;
  const selectedBench = c.benchConfigured ? new Set(c.bench) : null;
  const bench = world.players.filter(
    (p) =>
      c.players[p.id]?.clubId === c.clubId &&
      (!selectedBench || selectedBench.has(p.id)) &&
      !ownLineup.includes(p.id) &&
      !match.replaced.includes(p.id) &&
      available(c, p.id),
  );
  const ownNumbers = useMemo(() => shirtNumbers(c, world), [c, world]);
  const outgoingPlayer = outgoing ? findPlayer(world, outgoing) : undefined;
  const outgoingRole = formations[c.tactic.formation][ownLineup.indexOf(outgoing)] || 'CM';
  const teamFor = (clubId: string, ids: string[], color: string): PitchTeam => {
    let numbers: Record<string, number>;
    try {
      numbers = clubId === c.clubId ? ownNumbers : shirtNumbers(c, world, clubId);
    } catch {
      numbers = {};
    }
    return {
      formation: sideFormation(c, match, clubId),
      color,
      ids,
      numbers,
      names: Object.fromEntries(ids.map((id) => [id, findPlayer(world, id)?.name || ''])),
      dismissed: match.dismissed,
    };
  };
  const ratings = useMemo(() => matchRatings(c, world, match), [c, world, match]);
  const mvp =
    match.mvp ||
    (match.minute === 90 ? manOfTheMatch(ratings, match, fixture.homeId)?.id : undefined);
  const lastShotEvent = [...match.events]
    .reverse()
    .find((event) => event.type === 'goal' || event.type === 'save' || event.type === 'miss');
  const lastShot = lastShotEvent
    ? {
        side: (lastShotEvent.clubId === fixture.homeId ? 0 : 1) as 0 | 1,
        key: `${match.events.indexOf(lastShotEvent)}-${lastShotEvent.minute}`,
        type: lastShotEvent.type as 'goal' | 'save' | 'miss',
        playerId: lastShotEvent.playerId,
      }
    : null;
  const phase =
    match.minute === 90
      ? 'FIM DE JOGO'
      : match.minute === 45
        ? 'INTERVALO'
        : playing && !sub && !tactic && !shout && !paused
          ? 'AO VIVO'
          : 'PAUSADO';
  const isLive = playing && !sub && !tactic && !shout && !paused && match.minute < 90;
  useEffect(() => {
    setCrowdPlaying(isLive);
    return () => setCrowdPlaying(false);
  }, [isLive]);
  const timelineEvents = match.events.filter((event) =>
    ['goal', 'yellow', 'red', 'injury', 'sub', 'tactic'].includes(event.type),
  );
  useEffect(() => {
    if (match.minute !== 90) return;
    setPlaying(false);
    requestAnimationFrame(() => finishButton.current?.focus());
  }, [match.minute]);
  useEffect(() => {
    const before = scoreRef.current;
    const ownHome = fixture.homeId === c.clubId;
    const homeScored = match.homeGoals > before.home;
    const awayScored = match.awayGoals > before.away;
    if (homeScored) rumble(ownHome ? 'goal' : 'concede');
    if (awayScored) rumble(ownHome ? 'concede' : 'goal');
    if (homeScored || awayScored) crowdGoal();
    if (match.minute !== before.minute && (match.minute === 45 || match.minute === 90)) {
      rumble('whistle');
    }
    scoreRef.current = { home: match.homeGoals, away: match.awayGoals, minute: match.minute };
  }, [
    match.homeGoals,
    match.awayGoals,
    match.minute,
    match.events,
    fixture.homeId,
    c.clubId,
    rumble,
  ]);
  useEffect(() => {
    if (!playing || sub || tactic || shout || paused) return;
    const timer = setInterval(() => {
      try {
        const current = latest.current;
        if (!current.activeMatch || current.activeMatch.minute >= 90) {
          setPlaying(false);
          return;
        }
        const result = stepMatch(current, world, current.activeMatch);
        onChange({ ...current, activeMatch: result });
        if (result.minute === 45 || result.minute === 90) setPlaying(false);
      } catch (error) {
        setPlaying(false);
        onError(error instanceof Error ? error.message : String(error));
      }
    }, 1400 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, sub, tactic, shout, paused, world, onChange, onError]);
  return (
    <div className="screen match-screen">
      <div className="match-strip">
        <span>
          {label.name.toUpperCase()} · {label.stage.toUpperCase()}
        </span>
        <span>{home.stadium}</span>
      </div>
      <section
        className="scoreboard"
        style={{
          background: `linear-gradient(90deg, ${home.color}, rgba(8, 12, 24, 0.96) 36%, rgba(8, 12, 24, 0.96) 64%, ${away.color})`,
        }}
      >
        <div>
          <Badge club={home} size="large" />
          <h2>{home.name}</h2>
        </div>
        <div className="score-center">
          <p className="eyebrow">
            <span className={`live-dot ${isLive ? '' : 'paused'}`} /> {phase}
          </p>
          <strong>
            {match.homeGoals}
            <span>:</span>
            {match.awayGoals}
          </strong>
          <time>{String(match.minute).padStart(2, '0')}:00</time>
        </div>
        <div>
          <Badge club={away} size="large" />
          <h2>{away.name}</h2>
        </div>
      </section>
      <div className="match-layout">
        <section className="panel live-field-panel">
          <LivePitch
            home={teamFor(fixture.homeId, match.homeLineup, home.color)}
            away={teamFor(fixture.awayId, match.awayLineup, away.color)}
            playing={isLive}
            speed={speed}
            homePossession={match.home.possession || 50}
            shot={lastShot}
          />
          <div className="match-timeline">
            <div className="timeline-track">
              <i style={{ width: `${(match.minute / 90) * 100}%` }} />
              {timelineEvents.map((e, i) => (
                <span
                  key={i}
                  className={`timeline-marker type-${e.type}`}
                  style={{ left: `${(e.minute / 90) * 100}%` }}
                  title={`${e.minute}' ${e.text}`}
                  aria-label={`${e.minute} minutos: ${e.text}`}
                >
                  {e.type === 'goal'
                    ? '⚽'
                    : e.type === 'yellow' || e.type === 'red'
                      ? '▰'
                      : e.type === 'injury'
                        ? '+'
                        : e.type === 'sub'
                          ? '↔'
                          : '•'}
                </span>
              ))}
            </div>
            <span>0'</span>
            <span>45'</span>
            <span>90'</span>
          </div>
          <div className="match-controls">
            <button
              className="primary"
              data-controller-secondary
              disabled={match.minute === 90}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              {playing ? 'Pausar' : match.minute === 45 ? 'Segundo tempo' : 'Jogar'}
              <span aria-hidden="true">
                <ControllerButtonHint action="secondary" label="" />
              </span>
            </button>
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                className={speed === s ? 'active' : ''}
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
              >
                {s}×
              </button>
            ))}
            <button
              disabled={match.minute === 90}
              data-controller-info
              onClick={() => {
                setPlaying(false);
                setSub(true);
              }}
            >
              <ArrowLeftRight size={16} /> Substituir
              <span aria-hidden="true">
                <ControllerButtonHint action="info" label="" />
              </span>
            </button>
            <button
              disabled={match.minute === 90}
              onClick={() => {
                setPlaying(false);
                setTactic(true);
              }}
            >
              <SlidersHorizontal size={16} /> Tática
            </button>
            <button
              disabled={match.minute === 90}
              onClick={() => {
                setPlaying(false);
                setShout(true);
              }}
            >
              <Megaphone size={16} /> Instruções
            </button>
          </div>
          {match.minute === 90 && (
            <button
              ref={finishButton}
              className="primary finish-match"
              data-autofocus=""
              data-controller-secondary
              onClick={onFinish}
            >
              <Check size={18} /> Confirmar resultado e voltar à central
            </button>
          )}
        </section>
        <aside className="panel match-stats">
          <p className="eyebrow">
            <Activity size={15} /> O JOGO EM NÚMEROS
          </p>
          {(
            [
              ['possession', 'Posse de bola', '%'],
              ['shots', 'Finalizações', ''],
              ['xg', 'Gols esperados (xG)', ''],
              ['passes', 'Passes', ''],
            ] as const
          ).map(([key, label, suffix]) => (
            <div className="match-stat" key={key}>
              <span>
                {key === 'xg' ? matchNumber.format(match.home[key]) : match.home[key]}
                {suffix}
              </span>
              <span>{label}</span>
              <strong>
                {key === 'xg' ? matchNumber.format(match.away[key]) : match.away[key]}
                {suffix}
              </strong>
              <meter min={0} max={match.home[key] + match.away[key] || 1} value={match.home[key]} />
            </div>
          ))}
          <p className="muted small">Seed {match.seed} · Simulação determinística.</p>
          {match.minute === 90 && (
            <MatchAnalysis match={match} fixture={fixture} clubId={c.clubId} />
          )}
          <div className="match-ratings match-ratings-all">
            <h3>{match.minute === 90 ? 'Notas finais' : 'Notas ao vivo'}</h3>
            <div className="match-ratings-cols">
              {[fixture.homeId, fixture.awayId].map((clubId) => (
                <div key={clubId}>
                  <h4>{clubById(world, clubId).short}</h4>
                  {ratings
                    .filter((r) => r.clubId === clubId)
                    .map((r) => (
                      <div key={r.id}>
                        <span>
                          <small>{r.role}</small> {r.id === mvp ? '★ ' : ''}
                          {findPlayer(world, r.id)!.name}
                        </span>
                        <b className={`rating-badge ${ratingTone(r.rating)}`}>
                          {r.rating.toFixed(1)}
                        </b>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        </aside>
        {match.minute === 90 ? (
          <section className="panel commentary-panel ratings-panel">
            <h2>
              <Star size={19} /> Notas da partida
            </h2>
            {mvp && (
              <div className="mvp-banner">
                <span>CRAQUE DO JOGO</span>
                {findPlayer(world, mvp) && (
                  <PlayerFace player={findPlayer(world, mvp)!} size="md" />
                )}
                <strong>{findPlayer(world, mvp)?.name}</strong>
                <b
                  className={`rating-badge ${ratingTone(ratings.find((r) => r.id === mvp)?.rating || 0)}`}
                >
                  {ratings.find((r) => r.id === mvp)?.rating.toFixed(1)}
                </b>
              </div>
            )}
            <div className="ratings-columns scroll-area" tabIndex={-1}>
              {[fixture.homeId, fixture.awayId].map((clubId) => (
                <div key={clubId}>
                  <h3>
                    <Badge club={clubById(world, clubId)} /> {clubById(world, clubId).short}
                  </h3>
                  {ratings
                    .filter((r) => r.clubId === clubId)
                    .map((r) => (
                      <div key={r.id} className={`rating-row ${r.id === mvp ? 'mvp' : ''}`}>
                        <small>{r.role}</small>
                        <PlayerFace player={findPlayer(world, r.id)!} size="sm" />
                        <span>
                          {findPlayer(world, r.id)!.name}
                          {r.goals > 0 && <em> {'⚽'.repeat(r.goals)}</em>}
                          {r.assists > 0 && <em> {'🅰'.repeat(r.assists)}</em>}
                          {r.minutes < 90 && <i> {r.minutes}'</i>}
                        </span>
                        <b className={`rating-badge ${ratingTone(r.rating)}`}>
                          {r.rating.toFixed(1)}
                        </b>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="panel commentary-panel">
            <h2>
              <Volume2 size={19} /> Direto do campo
            </h2>
            <div className="commentary-feed" aria-live={playing ? 'off' : 'polite'}>
              {[...match.events]
                .reverse()
                .slice(0, 30)
                .map((e, i) => (
                  <div key={`${e.minute}-${i}`} className={e.type === 'goal' ? 'goal' : ''}>
                    <time>{e.minute}'</time>
                    <span>
                      {e.type === 'goal'
                        ? '⚽ '
                        : e.type === 'yellow'
                          ? '🟨 '
                          : e.type === 'red'
                            ? '🟥 '
                            : e.type === 'injury'
                              ? '🚑 '
                              : ''}
                      {e.text}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
      {sub && (
        <Modal
          title={
            outgoingPlayer
              ? `Quem entra no lugar de ${outgoingPlayer.name}?`
              : incoming
                ? `Quem sai para a entrada de ${findPlayer(world, incoming)?.name}?`
                : 'Quem sai?'
          }
          onClose={() => {
            setSub(false);
            setOut('');
            setIn('');
          }}
          className="match-subs-modal"
          wide
        >
          <p className="muted">
            {match.usedSubs} de 5 substituições utilizadas ·{' '}
            {outgoing
              ? 'Escolha o reserva. B fecha esta janela.'
              : 'Escolha o titular que deixa o campo.'}
          </p>
          {!outgoing ? (
            <div className="card-scroll">
              <div className="card-grid">
                {ownLineup.map((id, i) => {
                  const p = findPlayer(world, id)!;
                  return (
                    <PlayerCard
                      key={id}
                      player={p}
                      career={c}
                      role={formations[c.tactic.formation][i]}
                      number={ownNumbers[id]}
                      note={
                        match.dismissed.includes(id)
                          ? 'Expulso'
                          : `Cansaço ${Math.round(match.energySpent[id] || 0)}`
                      }
                      accessibilityNote={
                        match.dismissed.includes(id)
                          ? 'Expulso'
                          : `Cansaço ${Math.round(match.energySpent[id] || 0)}`
                      }
                      disabled={match.dismissed.includes(id)}
                      autoFocus={i === 0}
                      onClick={() => {
                        if (!incoming) return setOut(id);
                        onSubstitute(id, incoming);
                        setIn('');
                        setSub(false);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <PlayerPicker
              recommended={bench.filter((p) => fits(p, outgoingRole))}
              others={bench.filter((p) => !fits(p, outgoingRole)).sort(byPosition(c))}
              recommendedLabel={`Recomendados para ${outgoingRole}`}
              othersLabel="Demais reservas"
              extra={
                <button
                  type="button"
                  className="player-card empty"
                  data-autofocus=""
                  onClick={() => setOut('')}
                >
                  <ArrowLeftRight size={28} />
                  <strong className="pc-name">Trocar quem sai</strong>
                </button>
              }
              render={(p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  career={c}
                  role={outgoingRole}
                  number={ownNumbers[p.id]}
                  note={`Fôlego ${Math.max(0, Math.round((c.players[p.id]?.fitness || 0) - (match.energySpent[p.id] || 0)))}%`}
                  accessibilityNote={`Fôlego ${Math.max(0, Math.round((c.players[p.id]?.fitness || 0) - (match.energySpent[p.id] || 0)))}%`}
                  disabled={match.usedSubs >= 5}
                  onClick={() => {
                    onSubstitute(outgoing, p.id);
                    setOut('');
                    setSub(false);
                  }}
                />
              )}
            />
          )}
        </Modal>
      )}
      {shout && (
        <Modal title="Instruções da beira do campo" onClose={() => setShout(false)}>
          <p className="muted">
            Cada instrução dura até 10 minutos. É preciso esperar 15 minutos entre comandos.
          </p>
          {match.lastShout !== undefined && match.minute - match.lastShout < 15 && (
            <p className="muted">
              Próxima instrução em {15 - (match.minute - match.lastShout)} minutos.
            </p>
          )}
          <div className="sideline-choices">
            {shoutChoices.map((choice) => (
              <button
                key={choice.kind}
                disabled={match.lastShout !== undefined && match.minute - match.lastShout < 15}
                onClick={() => {
                  try {
                    onChange(shoutFromSideline(c, choice.kind));
                    setShout(false);
                  } catch (error) {
                    onError(error instanceof Error ? error.message : String(error));
                  }
                }}
              >
                <strong>{choice.label}</strong>
                <small>{choice.effect}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {tactic && (
        <Modal
          title="Ajustar o plano de jogo"
          onClose={() => setTactic(false)}
          className="match-tactic-modal"
          wide
        >
          <p className="muted">As mudanças afetam os próximos minutos. O jogo permanece pausado.</p>
          <div className="match-tactic">
            <div>
              <ChipGroup
                label="Formação"
                value={c.tactic.formation}
                options={Object.keys(formations).map((f) => ({ value: f as Formation, label: f }))}
                onChange={(formation) => onChange({ ...c, tactic: { ...c.tactic, formation } })}
              />
              <ChipGroup
                label="Mentalidade"
                value={c.tactic.mentality}
                options={(['Defensiva', 'Equilibrada', 'Ofensiva'] as const).map((m) => ({
                  value: m,
                  label: m,
                }))}
                onChange={(mentality) => onChange({ ...c, tactic: { ...c.tactic, mentality } })}
              />
              <div className="form-grid">
                {(
                  [
                    ['pressure', 'Pressão'],
                    ['tempo', 'Ritmo'],
                    ['line', 'Linha defensiva'],
                    ['width', 'Largura'],
                  ] as const
                ).map(([key, label]) => (
                  <TacticSlider
                    key={key}
                    label={label}
                    value={c.tactic[key]}
                    onChange={(v) => onChange({ ...c, tactic: { ...c.tactic, [key]: v } })}
                  />
                ))}
              </div>
            </div>
            <div>
              <span className="control-label">
                <Shield size={15} /> Capitão em campo
              </span>
              <div className="card-grid compact">
                {ownLineup.map((id, i) => (
                  <PlayerCard
                    key={id}
                    player={findPlayer(world, id)!}
                    career={c}
                    role={formations[c.tactic.formation][i]}
                    number={ownNumbers[id]}
                    active={c.roles['Capitão'] === id}
                    badge={c.roles['Capitão'] === id ? 'C' : undefined}
                    onClick={() => onChange({ ...c, roles: { ...c.roles, Capitão: id } })}
                  />
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
