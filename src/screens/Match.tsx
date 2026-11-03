import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeftRight,
  Check,
  Pause,
  Play,
  Shield,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { available, npcFormation, stepMatch } from '../game/matches';
import { fixtureLabel } from '../game/calendar';
import { clubById, findPlayer } from '../game/npc';
import { shirtNumbers } from '../game/numbers';
import { formations, type Career, type Formation, type Player, type World } from '../game/types';
import { Badge, Modal } from '../components/ui';
import { ChipGroup } from '../components/controls';
import { LivePitch, type PitchTeam } from '../components/LivePitch';
import { byPosition, PlayerCard, PlayerPicker, roleFits } from '../components/PlayerCard';
import { useGamepad } from '../controller/GamepadProvider';

const fits = (p: Player, role: string) => (roleFits[role] || [role]).includes(p.position);

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
  const [outgoing, setOut] = useState('');
  const { rumble } = useGamepad();
  const latest = useRef(c);
  latest.current = c;
  const match = c.activeMatch!;
  const scoreRef = useRef({ home: match.homeGoals, away: match.awayGoals, minute: match.minute });
  const fixture = c.fixtures.find((f) => f.id === match.fixtureId)!;
  const home = clubById(world, fixture.homeId);
  const away = clubById(world, fixture.awayId);
  const label = fixtureLabel(fixture);
  const ownLineup = fixture.homeId === c.clubId ? match.homeLineup : match.awayLineup;
  const bench = world.players.filter(
    (p) =>
      c.players[p.id]?.clubId === c.clubId &&
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
      formation: clubId === c.clubId ? c.tactic.formation : npcFormation,
      color,
      ids,
      numbers,
      names: Object.fromEntries(ids.map((id) => [id, findPlayer(world, id)?.name || ''])),
    };
  };
  const goals = match.events.filter((e) => e.type === 'goal');
  const lastGoalEvent = goals.at(-1);
  const lastGoal = lastGoalEvent
    ? {
        side: (lastGoalEvent.clubId === fixture.homeId ? 0 : 1) as 0 | 1,
        key: `${goals.length}-${lastGoalEvent.minute}`,
      }
    : null;
  const phase =
    match.minute === 90
      ? 'FIM DE JOGO'
      : match.minute === 45
        ? 'INTERVALO'
        : playing
          ? 'AO VIVO'
          : 'PAUSADO';
  useEffect(() => {
    const before = scoreRef.current;
    const ownHome = fixture.homeId === c.clubId;
    if (match.homeGoals > before.home) rumble(ownHome ? 'goal' : 'concede');
    if (match.awayGoals > before.away) rumble(ownHome ? 'concede' : 'goal');
    if (match.minute !== before.minute && (match.minute === 45 || match.minute === 90))
      rumble('whistle');
    scoreRef.current = { home: match.homeGoals, away: match.awayGoals, minute: match.minute };
  }, [match.homeGoals, match.awayGoals, match.minute, fixture.homeId, c.clubId, rumble]);
  useEffect(() => {
    if (!playing || sub || tactic || paused) return;
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
  }, [playing, speed, sub, tactic, paused, world, onChange, onError]);
  return (
    <div className="screen match-screen">
      <div className="match-strip">
        <span>
          {label.name.toUpperCase()} · {label.stage.toUpperCase()}
        </span>
        <span>{home.stadium}</span>
      </div>
      <section className="scoreboard">
        <div>
          <Badge club={home} size="large" />
          <h2>{home.name}</h2>
        </div>
        <div className="score-center">
          <p className="eyebrow">
            <span className={`live-dot ${playing ? '' : 'paused'}`} /> {phase}
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
            playing={playing && !sub && !tactic && !paused && match.minute < 90}
            speed={speed}
            homePossession={match.home.possession || 50}
            goal={lastGoal}
          />
          <div className="match-timeline">
            <div className="timeline-track">
              <i style={{ width: `${(match.minute / 90) * 100}%` }} />
              {match.events
                .filter((e) => e.type === 'goal')
                .map((e, i) => (
                  <span
                    key={i}
                    style={{ left: `${(e.minute / 90) * 100}%` }}
                    title={`${e.minute}' ${e.text}`}
                  >
                    ●
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
              disabled={match.minute === 90}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
              {playing ? 'Pausar' : match.minute === 45 ? 'Segundo tempo' : 'Jogar'}
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
              onClick={() => {
                setPlaying(false);
                setSub(true);
              }}
            >
              <ArrowLeftRight size={16} /> Substituir
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
          </div>
          {match.minute === 90 && (
            <button className="primary finish-match" onClick={onFinish}>
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
                {match.home[key]}
                {suffix}
              </span>
              <span>{label}</span>
              <strong>
                {match.away[key]}
                {suffix}
              </strong>
              <meter min={0} max={match.home[key] + match.away[key] || 1} value={match.home[key]} />
            </div>
          ))}
          <p className="muted small">Seed {match.seed} · A engine decide. A narração descreve.</p>
          {match.minute === 90 && (
            <div className="match-ratings">
              <h3>Destaques</h3>
              {Object.entries(match.ratings)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, rating]) => (
                  <div key={id}>
                    <span>{findPlayer(world, id)!.name}</span>
                    <strong>{rating.toFixed(1)}</strong>
                  </div>
                ))}
            </div>
          )}
        </aside>
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
                    {e.type === 'goal' ? '⚽ ' : e.type === 'yellow' ? '🟨 ' : ''}
                    {e.text}
                  </span>
                </div>
              ))}
          </div>
        </section>
      </div>
      {sub && (
        <Modal
          title={outgoingPlayer ? `Quem entra no lugar de ${outgoingPlayer.name}?` : 'Quem sai?'}
          onClose={() => {
            setSub(false);
            setOut('');
          }}
          wide
        >
          <p className="muted">
            {match.usedSubs} de 5 substituições utilizadas ·{' '}
            {outgoing ? 'Escolha o reserva. B volta.' : 'Escolha o titular que deixa o campo.'}
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
                      note={`Cansaço ${Math.round(match.energySpent[id] || 0)}`}
                      autoFocus={i === 0}
                      onClick={() => setOut(id)}
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
                  disabled={match.usedSubs >= 5}
                  onClick={() => {
                    onSubstitute(outgoing, p.id);
                    setOut('');
                  }}
                />
              )}
            />
          )}
        </Modal>
      )}
      {tactic && (
        <Modal title="Ajustar o plano de jogo" onClose={() => setTactic(false)} wide>
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
                  <label key={key}>
                    {label} · {c.tactic[key]}
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={c.tactic[key]}
                      onChange={(e) =>
                        onChange({ ...c, tactic: { ...c.tactic, [key]: Number(e.target.value) } })
                      }
                    />
                  </label>
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
