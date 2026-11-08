import { useGamepad } from '../controller/GamepadProvider';
import { ageAt } from '../game/random';
import { overall } from '../game/ratings';
import { knownPositions } from '../game/positions';
import { marketValue } from '../game/transfers';
import { attributeKeys, type Attributes, type Career, type Player } from '../game/types';
import { cardTier } from './cardTier';
import { shortName } from './PlayerCard';
import { PlayerFace } from './PlayerFace';
import { HeatMap } from './HeatMap';
import { dateLabel, money } from './ui';

const attributeLabels: Record<keyof Attributes, string> = {
  pace: 'Velocidade',
  acceleration: 'Aceleração',
  finishing: 'Finalização',
  shortPass: 'Passe curto',
  longPass: 'Passe longo',
  vision: 'Visão',
  dribbling: 'Drible',
  control: 'Controle',
  strength: 'Força',
  stamina: 'Resistência',
  positioning: 'Posicionamento',
  marking: 'Marcação',
  tackling: 'Desarme',
  interception: 'Interceptação',
  heading: 'Cabeceio',
  composure: 'Compostura',
  reflexes: 'Reflexos',
  handling: 'Segurança',
  diving: 'Elasticidade',
};

export function PlayerStatsPanel({
  player,
  career,
  shirtNumber,
}: {
  player: Player;
  career: Career;
  shirtNumber?: number | null;
}) {
  const { input } = useGamepad();
  const state = career.players[player.id];
  const positions = knownPositions(player, state)
    .sort((a, b) => (a === player.position ? -1 : b === player.position ? 1 : 0))
    .join(' · ');
  return (
    <section className="panel player-stats" data-stick-scroll aria-label="Ficha do jogador">
      {(input === 'xbox' || input === 'playstation') && (
        <span className="stats-scroll-hint">Analógico direito · Rolar ficha</span>
      )}
      <div className="stats-head">
        <div className={`hub-card ${cardTier(overall(player, player.position, state))}`}>
          <span className="hub-card-top">
            <strong>{overall(player, player.position, state)}</strong>
            <span>{state.position ?? player.position}</span>
          </span>
          <PlayerFace key={player.id} player={player} className="hub-card-face" />
          <strong className="hub-card-name">{shortName(player.name)}</strong>
        </div>
        <div className="stats-info">
          <h2>{player.name}</h2>
          <p className="eyebrow">
            {positions || player.position} · {state.role} · {state.personality}
          </p>
          <div className="hub-facts">
            {shirtNumber !== undefined && (
              <span>
                Camisa <strong>{shirtNumber ?? '—'}</strong>
              </span>
            )}
            <span>
              Idade <strong>{ageAt(player.birthDate, career.date)}</strong>
            </span>
            <span>
              Overall <strong>{overall(player, player.position, state)}</strong>
            </span>
            <span>
              Potencial{' '}
              <strong>
                {Math.max(
                  1,
                  Math.round(player.potential + state.potentialDelta - player.uncertainty),
                )}
                –
                {Math.min(
                  99,
                  Math.round(player.potential + state.potentialDelta + player.uncertainty),
                )}
              </strong>
            </span>
            <span>
              Condição <strong>{Math.round(state.fitness)}%</strong>
            </span>
            <span>
              Evolução{' '}
              <strong>
                {state.growth >= 0 ? '+' : ''}
                {state.growth.toFixed(2)}
              </strong>
            </span>
            <span>
              Moral <strong>{Math.round(state.morale)}</strong>
            </span>
            <span>
              Ritmo <strong>{Math.round(state.sharpness)}%</strong>
            </span>
            <span>
              Valor <strong>{money(marketValue(career, player))}</strong>
            </span>
            <span>
              Salário <strong>{money(state.wage)}</strong>
            </span>
            <span>
              Contrato <strong>{dateLabel(state.contractEnd)}</strong>
            </span>
            <span>
              Temporada{' '}
              <strong>
                {state.goals} gols · {state.minutes} min
              </strong>
            </span>
          </div>
          {state.listed ? <p className="pill hub-flag">À VENDA · {money(state.listed)}</p> : null}
        </div>
      </div>
      <div className="hub-summary">
        <div className="attribute-grid">
          {attributeKeys.map((key) => {
            const value = player.attributes[key];
            return (
              <div key={key} className={value >= 80 ? 'high' : value >= 65 ? 'mid' : 'low'}>
                <span>
                  {attributeLabels[key]}: <strong>{value}</strong>
                </span>
                <i className="attr-bar">
                  <b style={{ width: `${value}%` }} />
                </i>
              </div>
            );
          })}
        </div>
        <HeatMap
          player={player}
          position={state.position ?? player.position}
          state={state}
          compact
        />
      </div>
    </section>
  );
}
