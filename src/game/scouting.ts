import type { Career, Fixture, Message, World } from './types';
import { fixtureLabel } from './calendar';
import { clubById } from './npc';
import { overall } from './ratings';
import { positionNames, roleOf } from './positions';
import {
  describeTactic,
  lineupSlots,
  misplaced,
  npcTactic,
  winProbability,
  profile,
  recommendTactic,
} from './tactics';

const signed = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`;

/** Relatório do auxiliar sobre o próximo adversário, calculado pela mesma conta da engine. */
export function scoutReport(
  career: Career,
  world: World,
  fixture: Fixture,
): Pick<Message, 'id' | 'from' | 'title' | 'body' | 'kind' | 'tactic'> | null {
  if (career.lineup.length < 11) return null;
  const home = fixture.homeId === career.clubId;
  const opponentId = home ? fixture.awayId : fixture.homeId;
  const opponent = clubById(world, opponentId);
  const ours = profile(career, world, career.lineup, career.tactic.formation);
  const plan = npcTactic(career, world, opponentId, ours.ovr);
  if (plan.lineup.length < 11) return null;
  const theirs = profile(career, world, plan.lineup, plan.tactic.formation);
  const stars = lineupSlots(world, plan.lineup, plan.tactic.formation)
    .map(({ player, role }) => ({ player, role, ovr: overall(player, role) }))
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 3);
  const rec = recommendTactic(career, world, { clubId: opponentId, ...plan }, home);
  const traits: string[] = [];
  if (theirs.paceDef <= 60) traits.push('a defesa deles é lenta — bola nas costas machuca');
  else if (theirs.paceDef >= 72) traits.push('a zaga deles é rápida, cuidado com lançamento longo');
  if (theirs.stamina <= 64) traits.push('o time cansa cedo, pressionar no segundo tempo rende');
  if (theirs.pressRes >= 74) traits.push('saem bem jogando sob pressão');
  else if (theirs.pressRes <= 62) traits.push('erram muito quando são pressionados');
  if (theirs.flankDef <= 62) traits.push('os laterais deles são o ponto fraco');
  if (theirs.centralDef >= 74)
    traits.push('o miolo de zaga é muito forte, por dentro vai ser difícil');
  const gap = Math.round(ours.ovr - theirs.ovr);
  const first = career.manager.firstName;
  const lines = [
    `E aí, ${first}, beleza? Próximo jogo: ${opponent.name} (${home ? 'em casa' : 'fora'}) pela ${fixtureLabel(fixture).name}.`,
    '',
    `Como eles jogam: ${describeTactic(plan.tactic)}.`,
    `Força: overall ${Math.round(theirs.ovr)} contra o nosso ${Math.round(ours.ovr)} (${gap >= 0 ? '+' : ''}${gap}).`,
    `Fique de olho: ${stars.map((s) => `${s.player.name} (${positionNames[roleOf(s.role)] || s.role}, ${s.ovr})`).join(', ')}.`,
  ];
  if (traits.length)
    lines.push(`Pontos observados: ${traits.slice(0, 2).join('; ')}.`);
  const odds = winProbability(career, world, fixture);
  if (odds)
    lines.push(
      `Nosso modelo: ${odds.win}% vitória, ${odds.draw}% empate, ${odds.loss}% derrota (xG ${odds.xgFor} × ${odds.xgAgainst}).`,
    );
  lines.push('');
  const change = rec.balance - rec.current;
  if (change > 0.1) {
    lines.push(`Minha sugestão: ${describeTactic(rec.tactic)}.`);
    if (rec.notes.length) lines.push(`Por quê: ${rec.notes.map((n) => n.text).join('; ')}.`);
    lines.push(
      `Nas minhas contas, esse encaixe vale uns ${signed(change)} gol de saldo por jogo em relação ao plano atual.`,
    );
  } else lines.push('Do jeito que estamos, o plano já encaixa bem contra eles. Eu manteria.');
  const lost = misplaced(career, world);
  if (lost.length)
    lines.push(
      `Atenção: ${lost.map((l) => `${l.player.name} está improvisado de ${l.role}`).join(', ')}. Isso derruba o rendimento e o atleta pode reclamar.`,
    );
  lines.push('', 'Você que manda, professor.');
  return {
    id: `scout-${fixture.id}`,
    from: 'Auxiliar técnico',
    kind: 'staff',
    title: `Relatório: ${opponent.name}`,
    body: lines.join('\n'),
    ...(change > 0.1 ? { tactic: rec.tactic } : {}),
  };
}
