import { useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';
import { Badge } from './ui';
import { PlayerFace } from './PlayerFace';
import { ControllerButtonHint } from '../controller/ControllerButtonHint';
import { useGamepad } from '../controller/GamepadProvider';
import { championFanfare, defeatLament, stopCeremony } from '../audio/sound';
import type { Club, Player } from '../game/types';

/**
 * Desfecho de uma final: troféu erguido, papel picado e fogos quando o título vem; chuva fina,
 * cabeças baixas e o estádio esvaziando quando escapa.
 */
export function FinalOutcome({
  competition,
  club,
  rival,
  color,
  won,
  score,
  players,
  onDone,
}: {
  competition: string;
  club: Pick<Club, 'name' | 'short' | 'color'> & { id: string };
  rival: Pick<Club, 'name' | 'short' | 'color'> & { id: string };
  color: string;
  won: boolean;
  score: string;
  players: Player[];
  onDone: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const { rumble } = useGamepad();
  useEffect(() => {
    if (won) {
      void championFanfare();
      rumble('goal');
    } else void defeatLament();
    const timer = window.setTimeout(() => button.current?.focus(), 400);
    return () => {
      clearTimeout(timer);
      stopCeremony();
    };
  }, [won, rumble]);
  const finish = () => {
    stopCeremony();
    onDone();
  };
  return (
    <div
      className={`final-outcome ${won ? 'won' : 'lost'}`}
      role="dialog"
      aria-modal="true"
      data-focus-scope="modal"
      aria-label={won ? `${club.name} campeão` : `${club.name} vice-campeão`}
      style={{ ['--club' as string]: color }}
    >
      <div className="fo-sky" />
      {won ? (
        <>
          {Array.from({ length: 8 }, (_, i) => (
            <i
              key={`fw${i}`}
              className="fo-firework"
              style={{
                left: `${10 + ((i * 37) % 80)}%`,
                top: `${8 + ((i * 23) % 35)}%`,
                animationDelay: `${0.6 + i * 0.55}s`,
              }}
            />
          ))}
          {Array.from({ length: 90 }, (_, i) => (
            <i
              key={`c${i}`}
              className="fo-confetti"
              style={{
                left: `${(i * 13.7) % 100}%`,
                background: ['#f3c64f', color, '#ffffff', '#5fd1ff'][i % 4],
                animationDelay: `${(i * 0.07) % 3}s`,
                animationDuration: `${2.6 + (i % 5) * 0.5}s`,
              }}
            />
          ))}
        </>
      ) : (
        Array.from({ length: 80 }, (_, i) => (
          <i
            key={`r${i}`}
            className="fo-rain"
            style={{
              left: `${(i * 11.3) % 100}%`,
              animationDelay: `${(i * 0.11) % 1.8}s`,
              animationDuration: `${0.8 + (i % 4) * 0.2}s`,
            }}
          />
        ))
      )}
      <section className="fo-content">
        <p className="fo-competition">{competition.toUpperCase()}</p>
        <div className="fo-trophy">
          <Trophy size={won ? 120 : 84} strokeWidth={1.4} />
        </div>
        <div className="fo-badges">
          <Badge club={club} />
          <span>{score}</span>
          <Badge club={rival} />
        </div>
        <h1>{won ? 'É CAMPEÃO!' : 'NÃO FOI DESSA VEZ'}</h1>
        <p className="fo-line">
          {won
            ? `O ${club.name} levanta a taça! A torcida invade a madrugada, o elenco pula abraçado e o seu nome entra para a história do clube.`
            : `O ${rival.name} comemora no gramado enquanto os jogadores do ${club.name} olham para o chão. O vice dói… mas a próxima temporada começa amanhã.`}
        </p>
        <ol className="fo-squad">
          {players.slice(0, 11).map((player, i) => (
            <li key={player.id} style={{ animationDelay: `${(i % 4) * 0.12}s` }}>
              <PlayerFace player={player} size="md" />
              <small>{player.name.split(' ').at(-1)}</small>
            </li>
          ))}
        </ol>
        <button ref={button} className="primary" type="button" onClick={finish}>
          {won ? 'Comemorar na central' : 'Voltar à central'}
          <ControllerButtonHint action="confirm" label="" />
        </button>
      </section>
    </div>
  );
}
