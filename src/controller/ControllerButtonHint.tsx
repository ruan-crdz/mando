import { useGamepad } from './GamepadProvider';

export function ControllerButtonHint({
  action,
  label,
}: {
  action: 'confirm' | 'back' | 'secondary' | 'info' | 'previousTab' | 'nextTab' | 'menu';
  label: string;
}) {
  const { input, hints } = useGamepad();
  return (
    <span className="control-hint">
      {(input === 'xbox' || input === 'playstation') && (
        <kbd className={`pad-${action}`}>{hints[action]}</kbd>
      )}
      {label}
    </span>
  );
}
