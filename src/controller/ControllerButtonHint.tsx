import { useGamepad } from './GamepadProvider';
import { type xboxMapping } from './xboxMapping';

export function ControllerButtonHint({
  action,
  label,
}: {
  action: keyof typeof xboxMapping;
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
