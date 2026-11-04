import { clubById, findPlayer } from '../game/npc';
import { analystCost } from '../game/living';
import { winProbability } from '../game/tactics';
import { dateLabel, money } from './ui';
import {
  trainingFocus,
  type Career,
  type Fixture,
  type Living,
  type Match,
  type World,
} from '../game/types';

const clubName = (world: World, id: string) => {
  try {
    return clubById(world, id).name;
  } catch {
    return id;
  }
};
const playerName = (_career: Career, world: World, id: string) =>
  findPlayer(world, id)?.name || 'Atleta';

const Bar = ({ label, value }: { label: string; value: number }) => (
  <div className="living-bar">
    <span>{label}</span>
    <meter min={0} max={100} low={35} high={65} optimum={90} value={value} />
    <strong>{Math.round(value)}</strong>
  </div>
);

export function MarketFeed({ career, world }: { career: Career; world: World }) {
  const l = career.living;
  const moves = l.transfers.slice(-6).reverse();
  return (
    <section className="panel living-feed">
      <h2>Mercado da Bola</h2>
      {l.headline && l.headline.until >= career.date && (
        <p className="living-headline">{l.headline.text}</p>
      )}
      <Bar label="Torcida" value={l.fans} />
      {moves.length ? (
        <ul>
          {moves.map((m, i) => (
            <li key={`${m.playerId}-${i}`}>
              <strong>{playerName(career, world, m.playerId)}</strong> {clubName(world, m.from)} →{' '}
              {clubName(world, m.to)}
              {m.fee > 0 ? ` · ${money(m.fee)}` : ' · livre'}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhuma movimentação recente no mercado.</p>
      )}
    </section>
  );
}

export function ClubPanel({
  career,
  world,
  onUpdate,
  onUpgradeAnalyst,
}: {
  career: Career;
  world: World;
  onUpdate: (patch: Partial<Living>) => void;
  onUpgradeAnalyst: () => void;
}) {
  const l = career.living;
  const rivals = Object.entries(l.coaches)
    .filter(([id]) =>
      world.clubs.some(
        (c) => c.id === id && c.league === world.clubs.find((x) => x.id === career.clubId)?.league,
      ),
    )
    .slice(0, 20);
  const reporters = Object.entries(l.media);
  return (
    <div className="staff-layout">
      <section className="panel">
        <h2>Diretoria e torcida</h2>
        <Bar label="Resultados" value={l.board.results} />
        <Bar label="Finanças" value={l.board.finances} />
        <Bar label="Base" value={l.board.youth} />
        <Bar label="Estilo" value={l.board.style} />
        <Bar label="Clássicos" value={l.board.derbies} />
        <Bar label="Torcida" value={l.fans} />
        <p>
          Gestão: <strong>{l.owner}</strong>
          {l.wagesLate && <span className="pill danger"> Salários atrasados</span>}
          {l.transferBan && l.transferBan >= career.date && (
            <span className="pill danger"> Transfer ban até {dateLabel(l.transferBan)}</span>
          )}
        </p>
        {l.election && (
          <p>
            Eleição em {dateLabel(l.election.date)}: oposição de {l.election.rival} (
            {l.election.threat}% de chance de vencer e te demitir).
          </p>
        )}
        <h3>Exigências</h3>
        {l.demands.filter((d) => !d.done).length ? (
          l.demands
            .filter((d) => !d.done)
            .map((d) => (
              <p key={d.id}>
                {d.text} <span className="muted">· prazo {dateLabel(d.deadline)}</span>
              </p>
            ))
        ) : (
          <p className="muted">Nenhuma exigência em aberto.</p>
        )}
        {l.nationalInvite && (
          <p className="living-headline">A CBF quer você no comando da Seleção!</p>
        )}
      </section>
      <section className="panel">
        <h2>Comissão e preparação</h2>
        <label className="living-row">
          Treino semanal
          <select
            value={l.training}
            onChange={(e) => onUpdate({ training: e.target.value as Living['training'] })}
          >
            {trainingFocus.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="living-row">
          Marcação individual no craque rival
          <button onClick={() => onUpdate({ marking: !l.marking })}>
            {l.marking ? 'Ligada' : 'Desligada'}
          </button>
        </label>
        <p>
          Analista de desempenho: nível <strong>{l.analyst}</strong>/5
        </p>
        {l.analyst < 5 && (
          <button onClick={onUpgradeAnalyst}>
            Contratar nível {l.analyst + 1} · {money(analystCost(l.analyst + 1))}
          </button>
        )}
        <h3>Vestiário</h3>
        {l.relations.length ? (
          l.relations.map((r) => (
            <p key={`${r.a}-${r.b}`}>
              {r.kind === 'amizade' ? '🤝' : '⚡'} {playerName(career, world, r.a)} e{' '}
              {playerName(career, world, r.b)}
              <span className="muted"> · {r.kind}</span>
            </p>
          ))
        ) : (
          <p className="muted">Sem grupos marcantes no elenco.</p>
        )}
        {reporters.length > 0 && <h3>Imprensa</h3>}
        {reporters.map(([name, v]) => (
          <Bar key={name} label={name} value={v} />
        ))}
      </section>
      <section className="panel">
        <h2>Técnicos rivais</h2>
        {rivals.map(([id, coach]) => (
          <p key={id}>
            <strong>{clubName(world, id)}</strong> · {coach.name}{' '}
            <span className="muted">
              ({coach.style}, nível {coach.skill}
              {coach.winless >= 3 ? `, ${coach.winless} sem vencer` : ''})
            </span>
          </p>
        ))}
      </section>
    </div>
  );
}

export function MatchOdds({
  career,
  world,
  fixture,
}: {
  career: Career;
  world: World;
  fixture: Fixture;
}) {
  const odds = winProbability(career, world, fixture);
  if (!odds) return null;
  return (
    <div className="living-odds">
      <div>
        <span>Vitória</span>
        <strong>{odds.win}%</strong>
      </div>
      <div>
        <span>Empate</span>
        <strong>{odds.draw}%</strong>
      </div>
      <div>
        <span>Derrota</span>
        <strong>{odds.loss}%</strong>
      </div>
      <p className="muted">
        xG esperado {odds.xgFor} × {odds.xgAgainst}
        {odds.studied ? ' · o técnico rival estudou seus últimos jogos' : ''}
      </p>
      {odds.notes.map((n) => (
        <p key={n} className="muted">
          {n}
        </p>
      ))}
    </div>
  );
}

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
  const l = career.living;
  const hall = Object.entries(l.clubStats)
    .sort((a, b) => b[1].games + b[1].goals * 3 - (a[1].games + a[1].goals * 3))
    .slice(0, 10);
  const sales = l.transfers
    .filter((t) => t.from === career.clubId)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);
  const buys = l.transfers
    .filter((t) => t.to === career.clubId)
    .sort((a, b) => b.fee - a.fee)
    .slice(0, 5);
  return (
    <div className="staff-layout">
      <section className="panel">
        <h2>Linha do tempo</h2>
        {l.nationalInvite && (
          <p className="living-headline">Convidado para treinar a Seleção Brasileira</p>
        )}
        {l.timeline.length ? (
          [...l.timeline]
            .reverse()
            .slice(0, 40)
            .map((e, i) => (
              <p key={i}>
                {kindIcon[e.kind]} <span className="muted">{dateLabel(e.date)}</span> {e.text}
              </p>
            ))
        ) : (
          <p className="muted">A história ainda está sendo escrita.</p>
        )}
      </section>
      <section className="panel">
        <h2>Hall da fama</h2>
        {hall.map(([id, s]) => (
          <p key={id}>
            <strong>{playerName(career, world, id)}</strong>{' '}
            <span className="muted">
              {s.games} jogos · {s.goals} gols · {s.assists} assist.
            </span>
          </p>
        ))}
        {!hall.length && <p className="muted">Jogue partidas para formar ídolos.</p>}
      </section>
      <section className="panel">
        <h2>Maiores negócios</h2>
        <h3>Vendas</h3>
        {sales.map((t, i) => (
          <p key={i}>
            {playerName(career, world, t.playerId)} → {clubName(world, t.to)} · {money(t.fee)}
          </p>
        ))}
        <h3>Contratações</h3>
        {buys.map((t, i) => (
          <p key={i}>
            {playerName(career, world, t.playerId)} ← {clubName(world, t.from)} · {money(t.fee)}
          </p>
        ))}
      </section>
    </div>
  );
}

/** Pós-jogo: xG acumulado e explicação do resultado a partir dos números. */
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
  const ownId = clubId;
  let a = 0,
    b = 0;
  const ours: string[] = ['0,90'];
  const theirs: string[] = ['0,90'];
  for (const e of match.events) {
    if (!e.xg) continue;
    if (e.clubId === ownId) a += e.xg;
    else b += e.xg;
    ours.push(`${(e.minute / 90) * 300},${90 - a * 25}`);
    theirs.push(`${(e.minute / 90) * 300},${90 - b * 25}`);
  }
  ours.push(`300,${90 - a * 25}`);
  theirs.push(`300,${90 - b * 25}`);
  const us = ownHome ? match.home : match.away;
  const them = ownHome ? match.away : match.home;
  const gf = ownHome ? match.homeGoals : match.awayGoals;
  const ga = ownHome ? match.awayGoals : match.homeGoals;
  const why: string[] = [];
  if (gf > ga)
    why.push(
      us.xg >= them.xg
        ? 'Vitória construída: criamos mais chances claras.'
        : 'Vitória com eficiência: o rival criou mais, mas fomos letais.',
    );
  else if (gf < ga)
    why.push(
      us.xg > them.xg
        ? 'Derrota injusta pelos números: criamos mais e faltou pontaria.'
        : 'Derrota merecida: o rival criou chances melhores.',
    );
  else why.push('Empate equilibrado nas chances.');
  if (us.possession >= 58) why.push(`Dominamos a bola (${us.possession}%).`);
  if (us.possession <= 42) why.push(`Cedemos a posse (${us.possession}%).`);
  if (match.studied) why.push('O técnico rival estudou nossos jogos e montou um plano específico.');
  if (match.marked)
    why.push('A marcação individual travou o principal jogador deles, ao custo de força no meio.');
  for (const n of match.conditions?.notes || []) why.push(n);
  return (
    <div className="match-analysis">
      <h3>Por que {gf > ga ? 'vencemos' : gf < ga ? 'perdemos' : 'empatamos'}</h3>
      <svg viewBox="0 0 300 95" preserveAspectRatio="none" aria-label="xG acumulado">
        <polyline points={ours.join(' ')} fill="none" stroke="#22c55e" strokeWidth="3" />
        <polyline points={theirs.join(' ')} fill="none" stroke="#ef4444" strokeWidth="3" />
      </svg>
      <p className="muted small">
        xG acumulado: nós {a.toFixed(2)} (verde) × {b.toFixed(2)} rival (vermelho)
      </p>
      {why.map((w) => (
        <p key={w} className="small">
          {w}
        </p>
      ))}
    </div>
  );
}
