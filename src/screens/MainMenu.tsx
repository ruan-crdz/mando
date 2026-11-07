import { ArrowRight, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { Badge, dateLabel, ManagerPortrait } from '../components/ui';
import { type SavedCareer } from '../services/storage';

const clubOf = (s: SavedCareer) => s.world.clubs.find((c) => c.id === s.career.clubId)!;

export function MainMenu({
  saves,
  onContinue,
  onNew,
  onLoad,
}: {
  saves: SavedCareer[];
  onContinue: (save: SavedCareer) => void;
  onNew: () => void;
  onLoad: () => void;
}) {
  const recent = saves.length === 1 ? saves[0] : undefined;
  return (
    <div className="screen menu-screen">
      <div className="menu-heading">
        <img className="menu-logo" src={`${import.meta.env.BASE_URL}logo-mando.png`} alt="Mando" />
        <div className="menu-intro">
          <p className="eyebrow">CARREIRA DE MANAGER · FUTEBOL BRASILEIRO 2026</p>
          <h1>
            O clube é seu.
            <span>A história também.</span>
          </h1>
        </div>
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
        {saves.length > 1 && (
          <button className="tile tile-blue load-game-tile" data-autofocus onClick={onLoad}>
            <span className="tile-label">CARREGAR JOGO</span>
            <span className="tile-icon">
              <FolderOpen size={64} strokeWidth={2.4} />
            </span>
            <strong className="tile-title">Escolha sua carreira</strong>
            <span>{saves.length} carreiras salvas</span>
            <span className="tile-cta">
              CARREGAR <ArrowRight size={20} />
            </span>
          </button>
        )}
        <button
          className={`tile ${saves.length ? 'tile-green' : 'tile-blue'} new-career-tile`}
          data-autofocus={saves.length ? undefined : true}
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
      </div>
    </div>
  );
}

export function SavedGameList({
  saves,
  onContinue,
  onDelete,
}: {
  saves: SavedCareer[];
  onContinue: (save: SavedCareer) => void;
  onDelete: (save: SavedCareer) => void;
}) {
  return (
    <div className="save-picker">
      {saves.map((s, i) => (
        <div className="save-slot" key={s.career.id}>
          <button
            className={`tile ${['tile-orange', 'tile-purple', 'tile-pink'][i % 3]} slot-tile`}
            data-autofocus={i === 0 ? true : undefined}
            onClick={() => onContinue(s)}
          >
            <span className="tile-label">CARREGAR</span>
            <Badge club={clubOf(s)} size="large" />
            <strong className="tile-title">{clubOf(s).name}</strong>
            <span className="slot-meta">
              {s.career.manager.firstName} {s.career.manager.lastName} · {dateLabel(s.career.date)}
            </span>
          </button>
          <button
            className="slot-delete"
            aria-label={`Excluir carreira ${s.career.manager.firstName} ${s.career.manager.lastName}`}
            onClick={() => onDelete(s)}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
