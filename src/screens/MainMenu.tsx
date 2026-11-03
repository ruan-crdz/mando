import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Badge, dateLabel, ManagerPortrait } from '../components/ui';
import { type SavedCareer } from '../services/storage';

export function MainMenu({
  saves,
  onContinue,
  onNew,
  onDelete,
}: {
  saves: SavedCareer[];
  onContinue: (save: SavedCareer) => void;
  onNew: () => void;
  onDelete: (save: SavedCareer) => void;
}) {
  const [recent, ...others] = saves;
  const clubOf = (s: SavedCareer) => s.world.clubs.find((c) => c.id === s.career.clubId)!;
  return (
    <div className="screen menu-screen">
      <div className="menu-heading">
        <p className="eyebrow">CARREIRA DE MANAGER · FUTEBOL BRASILEIRO 2026</p>
        <h1>
          O clube é seu.
          <span>A história também.</span>
        </h1>
      </div>
      <div className="menu-row carousel">
        {recent && (
          <button
            className="tile tile-blue continue-tile"
            data-autofocus
            onClick={() => onContinue(recent)}
          >
            <span className="tile-label">CONTINUAR CARREIRA</span>
            <span className="continue-body">
              <Badge club={clubOf(recent)} size="large" />
              <span className="continue-text">
                <strong>{clubOf(recent).name}</strong>
                <span>
                  {recent.career.manager.firstName} {recent.career.manager.lastName}
                </span>
                <em>{dateLabel(recent.career.date)}</em>
              </span>
            </span>
            <span className="tile-cta">
              JOGAR <ArrowRight size={20} />
            </span>
            <ManagerPortrait manager={recent.career.manager} />
          </button>
        )}
        <button
          className={`tile ${recent ? 'tile-green' : 'tile-blue'} new-career-tile`}
          data-autofocus={recent ? undefined : true}
          onClick={onNew}
        >
          <span className="tile-label">NOVA CARREIRA</span>
          <span className="tile-icon">
            <Plus size={64} strokeWidth={2.4} />
          </span>
          <strong className="tile-title">Nova carreira de manager</strong>
          <span className="tile-cta">
            COMEÇAR <ArrowRight size={20} />
          </span>
        </button>
        {others.map((s, i) => (
          <div className="save-slot" key={s.career.id}>
            <button
              className={`tile ${['tile-orange', 'tile-purple', 'tile-pink'][i % 3]} slot-tile`}
              onClick={() => onContinue(s)}
            >
              <span className="tile-label">CARREGAR</span>
              <Badge club={clubOf(s)} size="large" />
              <strong className="tile-title">{clubOf(s).name}</strong>
              <span className="slot-meta">
                {s.career.manager.firstName} · {dateLabel(s.career.date)}
              </span>
            </button>
            <button
              className="slot-delete"
              aria-label={`Excluir carreira ${s.career.manager.firstName}`}
              onClick={() => onDelete(s)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}