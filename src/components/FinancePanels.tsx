import { clubById } from '../game/npc';
import { rivalry } from '../game/context';
import {
  capacityAt,
  crowdFor,
  economyOf,
  facilityPlans,
  memberTarget,
  priceBounds,
  refFee,
  refTicket,
  trainingEffect,
  upkeep,
  youthBonus,
} from '../game/economy';
import { facilityKinds, type Career, type FacilityKind, type Fixture, type World } from '../game/types';
import { dateLabel, money } from './ui';

const n = (value: number) => Math.round(value).toLocaleString('pt-BR');
const pct = (value: number) => `${Math.round(value * 100)}%`;

const clubName = (world: World, id: string) => {
  try {
    return clubById(world, id).name;
  } catch {
    return id;
  }
};

function useBasics(career: Career, world: World) {
  const club = world.clubs.find((x) => x.id === career.clubId)!;
  const e = economyOf(career, world);
  return { club, e, rep: club.reputation, cash: career.finances[career.clubId]?.cash ?? 0 };
}

/** Próximo jogo em casa (ou um jogo comum da liga, se não houver) para as estimativas de público. */
function previewFixture(career: Career, world: World): Fixture {
  const next = career.fixtures
    .filter((f) => !f.result && f.homeId === career.clubId && f.date >= career.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (next) return next;
  const club = world.clubs.find((x) => x.id === career.clubId)!;
  const rival = world.clubs.find((x) => x.league === club.league && x.id !== club.id) ?? club;
  return {
    id: 'previa',
    date: career.date,
    round: 0,
    homeId: club.id,
    awayId: rival.id,
    playoff: false,
  } as Fixture;
}

export function StadiumPanel({
  career,
  world,
  onPrices,
}: {
  career: Career;
  world: World;
  onPrices: (patch: { ticket?: number; fee?: number }) => void;
}) {
  const { e, rep } = useBasics(career, world);
  const fixture = previewFixture(career, world);
  const derby = Boolean(rivalry(fixture.homeId, fixture.awayId));
  const at = (ticket: number) =>
    crowdFor(
      { ...career, living: { ...career.living, economy: { ...e, ticket } } },
      world,
      fixture,
      derby,
    );
  const now = at(e.ticket);
  const bounds = priceBounds(career, world);
  const ref = refTicket(rep);
  const fee = refFee(rep);
  const avg = e.games.length
    ? e.games.reduce((sum, g) => sum + g.crowd / g.capacity, 0) / e.games.length
    : null;
  const avgGate = e.games.length
    ? e.games.reduce((sum, g) => sum + g.income, 0) / e.games.length
    : null;
  const target = memberTarget(career, world);
  const ticketPresets: [string, number][] = [
    ['Popular', Math.max(bounds.ticket[0], Math.round((ref * 0.7) / 5) * 5)],
    ['Médio', ref],
    ['Caro', Math.round((ref * 1.4) / 5) * 5],
  ];
  const feePresets: [string, number][] = [
    ['Básico', Math.max(bounds.fee[0], Math.round((fee * 0.75) / 5) * 5)],
    ['Padrão', fee],
    ['Premium', Math.round((fee * 1.4) / 5) * 5],
  ];
  const ratio = e.ticket / ref;
  return (
    <div className="club-living finance-living">
      <div className="club-kpis">
        <div className="club-kpi">
          <span>Capacidade</span>
          <strong>{n(now.capacity)}</strong>
          <small>estádio nível {e.facilities.stadium}/5</small>
        </div>
        <div className="club-kpi">
          <span>Ocupação média</span>
          <strong>{avg === null ? '—' : pct(avg)}</strong>
          <small>
            {avgGate === null
              ? 'aparece após o primeiro jogo em casa'
              : `bilheteria média ${money(avgGate)}`}
          </small>
        </div>
        <div className="club-kpi">
          <span>Sócios-torcedores</span>
          <strong>{n(e.members)}</strong>
          <small>
            meta {n(target)} · {target >= e.members ? 'crescendo' : 'caindo'}
          </small>
        </div>
        <div className="club-kpi">
          <span>Receita de sócios</span>
          <strong>{money(e.members * e.fee)}</strong>
          <small>por mês, todo dia 1º</small>
        </div>
      </div>
      <div className="club-grid" data-stick-scroll>
        <section className="panel">
          <h2>Ingresso · R$ {e.ticket}</h2>
          <p className="muted">
            Bilheteria = público pagante × ingresso. Sócios entram com check-in incluso na
            mensalidade. Preço de referência para a sua torcida: <strong>R$ {ref}</strong>.
          </p>
          <div className="training-options price-options" role="radiogroup" aria-label="Faixa do ingresso">
            {ticketPresets.map(([label, value]) => {
              const est = at(value);
              return (
                <button
                  key={label}
                  role="radio"
                  aria-checked={e.ticket === value}
                  className={e.ticket === value ? 'active' : ''}
                  onClick={() => onPrices({ ticket: value })}
                >
                  <strong>
                    {label} · R$ {value}
                  </strong>
                  <small>
                    Público {n(est.crowd)} ({pct(est.occupancy)})
                  </small>
                  <small>Bilheteria {money(est.income)}</small>
                </button>
              );
            })}
          </div>
          <div className="button-row price-stepper">
            <button
              disabled={e.ticket <= bounds.ticket[0]}
              onClick={() => onPrices({ ticket: e.ticket - 5 })}
            >
              − R$ 5
            </button>
            <span>
              R$ {e.ticket} · faixa R$ {bounds.ticket[0]}–{bounds.ticket[1]}
            </span>
            <button
              disabled={e.ticket >= bounds.ticket[1]}
              onClick={() => onPrices({ ticket: e.ticket + 5 })}
            >
              + R$ 5
            </button>
          </div>
          <ul className="club-rules">
            <li>
              Próximo jogo em casa
              {fixture.id === 'previa' ? ' (estimativa)' : ` · ${dateLabel(fixture.date)}`} contra{' '}
              {clubName(world, fixture.awayId)}: <strong>{n(now.crowd)}</strong> torcedores (
              {pct(now.occupancy)}), {n(now.members)} sócios, bilheteria{' '}
              <strong>{money(now.income)}</strong> e custo de operação {money(now.cost)}.
            </li>
            <li className="bad">
              Cada 10% acima da referência tira cerca de 7% dos pagantes. Ingresso 35% acima: −2
              de humor da torcida por mês.
            </li>
            <li className="good">
              Ingresso 20% abaixo ou mais: +1 de humor por mês. Estádio 92% cheio dá +1,5% de força
              em casa; abaixo de 40%, −0,5%.
            </li>
            <li>
              Público sobe com humor da torcida (+0,6 p.p. de demanda por ponto de humor), boa fase
              (últimos 5 jogos), clássico (+15%), copa (+6%) e adversário grande.
            </li>
          </ul>
          {ratio >= 1.35 && (
            <p className="living-headline">A torcida reclama do preço: −2 de humor no fim do mês.</p>
          )}
        </section>
        <section className="panel">
          <h2>Sócio-torcedor · R$ {e.fee}/mês</h2>
          <p className="muted">
            Os sócios garantem 55% de presença em cada jogo (70% em clássicos), até 60% da
            capacidade. Todo mês o quadro anda 12% em direção à meta.
          </p>
          <div className="training-options price-options" role="radiogroup" aria-label="Plano de sócio">
            {feePresets.map(([label, value]) => (
              <button
                key={label}
                role="radio"
                aria-checked={e.fee === value}
                className={e.fee === value ? 'active' : ''}
                onClick={() => onPrices({ fee: value })}
              >
                <strong>
                  {label} · R$ {value}
                </strong>
                <small>Meta {n(memberTarget(career, world, value))} sócios</small>
                <small>
                  Receita na meta {money(memberTarget(career, world, value) * value)}/mês
                </small>
              </button>
            ))}
          </div>
          <div className="button-row price-stepper">
            <button disabled={e.fee <= bounds.fee[0]} onClick={() => onPrices({ fee: e.fee - 5 })}>
              − R$ 5
            </button>
            <span>
              R$ {e.fee} · faixa R$ {bounds.fee[0]}–{bounds.fee[1]}
            </span>
            <button disabled={e.fee >= bounds.fee[1]} onClick={() => onPrices({ fee: e.fee + 5 })}>
              + R$ 5
            </button>
          </div>
          <ul className="club-rules">
            <li className="good">
              Torcida feliz amplia a meta (humor 50 → 100% da base; humor 90 → 136%). Cada título
              na temporada: +6% de sócios; acesso: +5%.
            </li>
            <li className="bad">
              Crise (humor abaixo de 25 ou salários atrasados): −3% por mês. Rebaixamento: −8%.
            </li>
          </ul>
          {e.games.length > 0 && (
            <>
              <h3>Últimos jogos em casa</h3>
              {e.games
                .slice(-5)
                .reverse()
                .map((g) => (
                  <p key={g.date} className="club-demand">
                    {dateLabel(g.date)} · {n(g.crowd)} ({pct(g.crowd / g.capacity)}) ·{' '}
                    {money(g.income)}
                  </p>
                ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export function SponsorPanel({
  career,
  world,
  onSponsor,
}: {
  career: Career;
  world: World;
  onSponsor: (index: number) => void;
}) {
  const { e } = useBasics(career, world);
  const s = e.sponsor;
  const active = s && s.until > career.date;
  return (
    <div className="club-living finance-living">
      <div className="club-kpis">
        <div className="club-kpi">
          <span>Patrocinador master</span>
          <strong>{active ? s!.name : 'Sem contrato'}</strong>
          <small>{active ? `até ${dateLabel(s!.until)}` : 'camisa livre'}</small>
        </div>
        <div className="club-kpi">
          <span>Valor fixo</span>
          <strong>{active ? money(s!.monthly) : '—'}</strong>
          <small>por mês, todo dia 1º</small>
        </div>
        <div className="club-kpi">
          <span>Perfil</span>
          <strong>{active ? s!.style : '—'}</strong>
          <small>{active ? `${s!.months} meses de contrato` : 'aguardando propostas'}</small>
        </div>
        <div className="club-kpi">
          <span>Propostas</span>
          <strong>{e.offers.length}</strong>
          <small>
            {e.offersExpire ? `escolha até ${dateLabel(e.offersExpire)}` : 'nenhuma na mesa'}
          </small>
        </div>
      </div>
      <div className="club-grid" data-stick-scroll>
        <section className="panel">
          <h2>Contrato atual</h2>
          {s ? (
            <>
              <p className="muted">
                {s.name} desde {dateLabel(s.since)}. Bônus pagos na virada da temporada, se a meta
                for batida.
              </p>
              <ul className="club-rules">
                <li className="good">Título (qualquer taça fora do Estadual): {money(s.title)}</li>
                <li className="good">Acesso à Série A: {money(s.access)}</li>
                <li className="good">G4 da Série A: {money(s.g4)}</li>
              </ul>
            </>
          ) : (
            <p className="muted">A camisa está sem patrocinador master.</p>
          )}
          <ul className="club-rules">
            <li>
              Dez dias antes do fim do contrato, o comercial traz três propostas no Escritório.
              Sem escolha em 10 dias, a diretoria assina a primeira.
            </li>
            <li>
              O valor-base sobe com reputação, divisão (Série B paga 75%) e humor da torcida.
            </li>
            <li>Diretoria (finanças): Fixo +3, Equilibrado +1, Desempenho −1.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>Propostas na mesa</h2>
          {e.offers.length ? (
            <div className="sponsor-offers">
              {e.offers.map((o, i) => (
                <article key={o.name} className="sponsor-offer">
                  <p className="eyebrow">{o.style.toUpperCase()}</p>
                  <h3>{o.name}</h3>
                  <p>
                    <strong>{money(o.monthly)}</strong>/mês · {o.months} meses
                  </p>
                  <small>
                    Bônus: título {money(o.title)} · acesso {money(o.access)} · G4 {money(o.g4)}
                  </small>
                  <button className={i === 0 ? 'primary' : ''} onClick={() => onSponsor(i)}>
                    Assinar com {o.name}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">
              Nenhuma proposta agora.{' '}
              {s ? `Novas ofertas chegam por volta de ${dateLabel(s.until)}.` : ''}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

const effectText = (kind: FacilityKind, level: number, rep: number, clubId: string) => {
  if (kind === 'stadium') return `${n(capacityAt(level, rep, clubId))} lugares`;
  if (kind === 'training') {
    const t = trainingEffect(level);
    return level === 1
      ? 'Sem bônus'
      : `Evolução +${pct(t.growth)} · ritmo cai ${pct(1 - t.decay / 0.15)} mais devagar · lesões −${pct(t.injury)}`;
  }
  return level === 1 ? 'Sem bônus' : `+${youthBonus(level)} de potencial nos jovens revelados`;
};

const facilityHow: Record<FacilityKind, string> = {
  stadium: 'Cada nível acima do original amplia a capacidade em 8%. Ao concluir: +4 de humor da torcida.',
  training: 'Vale para o seu elenco: evolução diária, perda de ritmo sem jogar e chance/tempo de lesão.',
  youth: 'Na virada da temporada, os três jovens revelados pelo clube recebem o bônus de potencial (máx. 94).',
};

export function FacilitiesPanel({
  career,
  world,
  onWork,
}: {
  career: Career;
  world: World;
  onWork: (kind: FacilityKind) => void;
}) {
  const { e, rep, cash } = useBasics(career, world);
  return (
    <div className="club-living finance-living">
      <div className="club-kpis">
        {facilityKinds.map((kind) => {
          const work = e.works.find((w) => w.kind === kind);
          return (
            <div className="club-kpi" key={kind}>
              <span>{facilityPlans[kind].label}</span>
              <strong>Nível {e.facilities[kind]}/5</strong>
              <small>{work ? `obra até ${dateLabel(work.done)}` : effectText(kind, e.facilities[kind], rep, career.clubId)}</small>
            </div>
          );
        })}
        <div className="club-kpi">
          <span>Manutenção</span>
          <strong>{money(upkeep(e))}</strong>
          <small>por mês, somada à operação</small>
        </div>
      </div>
      <div className="club-grid facilities-grid" data-stick-scroll>
        {facilityKinds.map((kind) => {
          const plan = facilityPlans[kind];
          const level = e.facilities[kind];
          const work = e.works.find((w) => w.kind === kind);
          const cost = level < 5 ? plan.cost[level + 1] : 0;
          return (
            <section key={kind} className="panel analyst-ladder" aria-label={plan.label}>
              <h2>{plan.label}</h2>
              <p className="muted small">
                {facilityHow[kind]} Manutenção: {money(plan.upkeep)} por nível/mês.
              </p>
              {[1, 2, 3, 4, 5].map((lv) => {
                const state =
                  lv === level
                    ? 'current'
                    : lv < level
                      ? 'past'
                      : lv === level + 1
                        ? 'next'
                        : 'locked';
                return (
                  <div key={lv} className={`analyst-step ${state}`}>
                    <b>{lv}</b>
                    <span>{effectText(kind, lv, rep, career.clubId)}</span>
                    {state === 'current' && <em>ATUAL</em>}
                    {state === 'next' &&
                      (work ? (
                        <em>OBRA ATÉ {dateLabel(work.done)}</em>
                      ) : (
                        <button
                          className="primary"
                          disabled={cash < cost}
                          title={cash < cost ? 'Caixa insuficiente' : undefined}
                          onClick={() => onWork(kind)}
                        >
                          Obra · {money(cost)} · {plan.days[lv]} dias
                        </button>
                      ))}
                    {state === 'locked' && (
                      <small>
                        {money(plan.cost[lv])} · {plan.days[lv]} dias
                      </small>
                    )}
                  </div>
                );
              })}
              {level >= 5 && <p className="muted">Estrutura de ponta: nível máximo.</p>}
            </section>
          );
        })}
      </div>
      <p className="muted small finance-note">
        Obras são pagas à vista do caixa ({money(cash)}). A diretoria reage ao tamanho do gasto:
        investimentos que comprometem o caixa derrubam a nota de finanças; deixar o caixa abaixo
        de metade do orçamento custa −6 extra. Uma obra por área de cada vez.
      </p>
    </div>
  );
}
