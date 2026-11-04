import { describe, expect, it } from 'vitest';
import {
  beginInternationalWindow,
  internationalCountry,
  internationalWindows,
} from './international';
import { createCareer, validateCareerForWorld } from './engine';
import { available } from './matches';
import {
  acceptNationalJob,
  beginNationalMatch,
  finishNationalMatch,
  nationalMatchCareer,
  toggleNationalCallup,
} from './national';
import { BRAZIL_NATIONAL_ID } from './npc';
import { type Manager } from './types';
import { createDemoWorld } from './world';

const world = createDemoWorld();
const manager: Manager = {
  firstName: 'Alex',
  lastName: 'Silva',
  age: 30,
  nationality: 'Brasil',
  style: 'Terno azul',
  appearance: '',
};
const start = () => createCareer(world, manager, 'sao-paulo', 'Amador', 'Realista', 42);
const nationalCareer = () => {
  const career = start();
  career.living.nationalInvite = true;
  return acceptNationalJob(career, world);
};

describe('convocações e Seleção', () => {
  it('mantém onze atletas e um goleiro disponíveis em cada clube após a convocação automática', () => {
    const career = start();
    career.date = internationalWindows(career.season)[0].from;
    beginInternationalWindow(career, world);
    expect(Object.keys(career.international!.players).length).toBeGreaterThan(0);
    for (const club of world.clubs) {
      const availablePlayers = world.players.filter(
        (player) => career.players[player.id].clubId === club.id && available(career, player.id),
      );
      expect(availablePlayers.length, club.name).toBeGreaterThanOrEqual(11);
      expect(availablePlayers.some((player) => player.position === 'GK'), club.name).toBe(true);
    }
  });

  it('recusa convocação manual que deixaria o clube sem onze jogadores', () => {
    let career = nationalCareer();
    career.national!.callups = [];
    career.national!.lineup = [];
    const outfield = world.players.filter(
      (player) => player.clubId === career.clubId && player.position !== 'GK',
    );
    for (const player of outfield.slice(0, 17))
      career = toggleNationalCallup(career, world, player.id);
    expect(() => toggleNationalCallup(career, world, outfield[17].id)).toThrow('onze atletas');
  });

  it('revê a lista se lesões deixarem um clube sem cobertura na janela', () => {
    const career = nationalCareer();
    const squad = world.players.filter((player) => player.clubId === career.clubId);
    const keepers = squad.filter((player) => player.position === 'GK').slice(0, 2);
    const outfield = squad.filter((player) => player.position !== 'GK').slice(0, 10);
    const healthy = new Set([...keepers, ...outfield].map((player) => player.id));
    for (const player of squad)
      if (!healthy.has(player.id)) career.players[player.id].injuryDays = 30;
    career.national!.callups = [outfield[0].id, outfield[1].id];
    career.date = internationalWindows(career.season)[0].from;

    beginInternationalWindow(career, world);

    expect(career.national!.callups).toEqual([outfield[0].id]);
    expect(internationalCountry(career, outfield[0].id)).toBe('Brasil');
    expect(internationalCountry(career, outfield[1].id)).toBeUndefined();
    expect(career.messages.some((message) => message.title === 'Convocação precisa de ajustes')).toBe(true);
  });

  it('separa clube e suspensão doméstica dos efeitos de uma partida internacional', () => {
    let career = nationalCareer();
    const playerId = career.national!.lineup[1];
    const originalClub = career.players[playerId].clubId;
    career.players[playerId].suspension = 2;
    career.date = career.national!.fixtures[0].date;
    career = beginNationalMatch(career, world);
    const projected = nationalMatchCareer(career);
    expect(projected.players[playerId].clubId).toBe(BRAZIL_NATIONAL_ID);
    expect(projected.players[playerId].suspension).toBe(0);

    const match = career.national!.activeMatch!;
    const fitness = career.players[playerId].fitness;
    match.minute = 90;
    match.minutesPlayed[playerId] = 90;
    match.energySpent[playerId] = 8;
    match.events.push({
      minute: 80,
      type: 'red',
      clubId: BRAZIL_NATIONAL_ID,
      playerId,
      text: 'Expulso.',
    });
    career = finishNationalMatch(career, world);

    expect(career.players[playerId].clubId).toBe(originalClub);
    expect(career.players[playerId].suspension).toBe(2);
    expect(career.players[playerId].fitness).toBe(fitness - 8);
    expect(career.national!.suspensions[playerId]).toBe(1);
    expect(career.national!.fixtures[0].result).toBeDefined();
    expect(() => validateCareerForWorld(career, world)).not.toThrow();
  });
});
