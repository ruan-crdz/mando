import { useEffect, useRef, useState } from 'react';
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
import { available, stepMatch } from '../game/matches';
import { formations, type Career, type Tactic, type World } from '../game/types';
import { Badge, Modal, SectionTitle } from '../components/ui';

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
  const [incoming, setIn] = useState('');
  const latest = useRef(c);
  latest.current = c;
  const match = c.activeMatch!;
  const fixture = c.fixtures.find((f) => f.id === match.fixtureId)!;
  const home = world.clubs.find((club) => club.id === fixture.homeId)!;
  const away = world.clubs.find((club) => club.id === fixture.awayId)!;
  const ownLineup = fixture.homeId === c.clubId ? match.homeLineup : match.awayLineup;
  const bench = world.players.filter(
    (p) =>
      c.players[p.id].clubId === c.clubId &&
      !ownLineup.includes(p.id) &&
      !match.replaced.includes(p.id) &&
      available(c, p.id),
  );
  const phase =
    match.minute === 90
      ? 'FIM DE JOGO'
      : match.minute === 45
        ? 'INTERVALO'
        : playing
          ? 'AO VIVO'
          : 'PAUSADO';
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
    <div className="screen-enter match-screen">
      <SectionTitle
        kicker={`BRASILEIRÃO SÉRIE ${fixture.league} / ${fixture.playoff ? 'PLAYOFF DE ACESSO' : `RODADA ${fixture.round}`}`}
        title="O plano encontra o jogo."
      >
        <span className="weather">{home.stadium}</span>
      </SectionTitle>
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
          <div
            className="live-field"
            role="img"
            aria-label="Visão tática 2D; as posições são ilustrativas e os lances são descritos na timeline"
          >
            <div className="field-half" />
            <div className="field-circle" />
            <div className="field-box left" />
            <div className="field-box right" />
            {[match.homeLineup, match.awayLineup].flatMap((ids, side) =>
              ids.map((id, i) => (
                <span
                  className={`field-dot ${side ? 'away' : 'home'}`}
                  key={id}
                  style={{
                    left: `${side ? 91 - (i % 4) * 10 : 9 + (i % 4) * 10}%`,
                    top: `${15 + Math.floor(i / 4) * 33 + (i % 2) * 7}%`,
                    background: side ? away.color : home.color,
                  }}
                >
                  {i + 1}
                </span>
              )),
            )}
            <span
              className="ball-dot"
              style={{
                left: `${20 + ((match.minute * 17) % 60)}%`,
                top: `${20 + ((match.minute * 13) % 60)}%`,
              }}
            />
          </div>
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
                    <span>{world.players.find((p) => p.id === id)!.name}</span>
                    <strong>{rating.toFixed(1)}</strong>
                  </div>
                ))}
            </div>
          )}
        </aside>
      </div>
      <section className="panel commentary-panel">
        <h2>
          <Volume2 size={19} /> Direto do campo
        </h2>
        <div className="commentary-feed" aria-live={playing ? 'off' : 'polite'}>
          {[...match.events]
            .reverse()
            .slice(0, 18)
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
      {sub && (
        <Modal title="Mudar a história do jogo" onClose={() => setSub(false)}>
          <p>{match.usedSubs} de 5 substituições utilizadas</p>
          <div className="form-grid">
            <label>
              Sai
              <select value={outgoing} onChange={(e) => setOut(e.target.value)}>
                <option value="">Escolher titular</option>
                {ownLineup.map((id) => (
                  <option key={id} value={id}>
                    {world.players.find((p) => p.id === id)!.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Entra
              <select value={incoming} onChange={(e) => setIn(e.target.value)}>
                <option value="">Escolher reserva</option>
                {bench.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.position}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="primary"
            disabled={!outgoing || !incoming || match.usedSubs >= 5}
            onClick={() => onSubstitute(outgoing, incoming)}
          >
            Confirmar substituição
          </button>
        </Modal>
      )}
      {tactic && (
        <Modal title="Ajustar o plano de jogo" onClose={() => setTactic(false)}>
          <p className="muted">As mudanças afetam os próximos minutos. O jogo permanece pausado.</p>
          <div className="form-grid">
            <label>
              Formação
              <select
                value={c.tactic.formation}
                onChange={(e) =>
                  onChange({
                    ...c,
                    tactic: { ...c.tactic, formation: e.target.value as Tactic['formation'] },
                  })
                }
              >
                {Object.keys(formations).map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Mentalidade
              <select
                value={c.tactic.mentality}
                onChange={(e) =>
                  onChange({
                    ...c,
                    tactic: { ...c.tactic, mentality: e.target.value as Tactic['mentality'] },
                  })
                }
              >
                {['Defensiva', 'Equilibrada', 'Ofensiva'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
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
          <h3>
            <Shield size={18} /> Capitão
          </h3>
          <select
            aria-label="Capitão durante a partida"
            value={c.roles['Capitão']}
            onChange={(e) => onChange({ ...c, roles: { ...c.roles, Capitão: e.target.value } })}
          >
            {ownLineup.map((id) => (
              <option key={id} value={id}>
                {world.players.find((p) => p.id === id)!.name}
              </option>
            ))}
          </select>
        </Modal>
      )}
    </div>
  );
}
