import { clamp, hash } from './random';
import { clubById, findPlayer, isForeign } from './npc';
import { type Career, type Living, type Message, type World } from './types';

/** Mensagem na caixa de entrada do técnico (fora da engine principal). */
export function notify(
  c: Career,
  data: Pick<Message, 'from' | 'title' | 'body' | 'kind'> & Partial<Message>,
) {
  c.messages.unshift({
    id: `msg-${hash(`${c.id}:${c.date}:${data.title}:${c.messages.length}`)}`,
    date: c.date,
    important: false,
    read: false,
    resolved: false,
    ...data,
  });
}

export function remember(c: Career, kind: Living['timeline'][number]['kind'], text: string) {
  c.living.timeline.push({ date: c.date, kind, text });
  if (c.living.timeline.length > 200) c.living.timeline.splice(0, c.living.timeline.length - 200);
}

const money = (n: number) =>
  n >= 1e6 ? `R$ ${(n / 1e6).toFixed(1).replace('.', ',')} mi` : `R$ ${Math.round(n / 1000)} mil`;

/** Registra uma movimentação de mercado e aplica as consequências humanas. */
export function recordMove(
  c: Career,
  world: World,
  playerId: string,
  from: string,
  to: string,
  fee: number,
  kind: Living['transfers'][number]['kind'],
) {
  c.living.transfers.push({ date: c.date, playerId, from, to, fee, kind });
  if (c.living.transfers.length > 400) c.living.transfers.splice(0, c.living.transfers.length - 400);
  const player = findPlayer(world, playerId);
  if (!player) return;
  if (to === c.clubId) {
    remember(c, 'contratacao', `Contratou ${player.name} (${clubById(world, from).name}) por ${money(fee)}`);
    return;
  }
  if (from !== c.clubId) return;
  remember(
    c,
    'venda',
    `Vendeu ${player.name} ao ${clubById(world, to).name}${isForeign(to) ? ' (exterior)' : ''} por ${money(fee)}`,
  );
  // O vestiário reage: amigos sentem, e a saída do líder abala o grupo.
  const friends = c.living.relations.filter(
    (r) => r.kind === 'amizade' && (r.a === playerId || r.b === playerId),
  );
  for (const r of friends) {
    const other = c.players[r.a === playerId ? r.b : r.a];
    if (other) other.morale = clamp(other.morale - 6);
  }
  c.living.relations = c.living.relations.filter((r) => r.a !== playerId && r.b !== playerId);
  const leader =
    c.players[playerId]?.personality === 'Líder' || c.roles['Capitão'] === playerId;
  if (leader) {
    for (const s of Object.values(c.players))
      if (s.clubId === c.clubId) s.morale = clamp(s.morale - 5);
    notify(c, {
      kind: 'staff',
      from: 'Auxiliar técnico',
      title: 'O vestiário sentiu a saída',
      body: `${player.name} era uma liderança do grupo. O ambiente ficou mais pesado e a moral do elenco caiu.`,
    });
  } else if (friends.length)
    notify(c, {
      kind: 'staff',
      from: 'Auxiliar técnico',
      title: `Amigos de ${player.name} abalados`,
      body: `${friends.length} atleta(s) próximos de ${player.name} ficaram chateados com a venda.`,
    });
}
