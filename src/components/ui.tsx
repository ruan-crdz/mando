import { type ReactNode, useEffect, useRef } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { type Club, type Manager } from '../game/types';
import { clubLogo } from '../game/realWorld';

export const money = (value: number, compact = true) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
export const dateLabel = (date: string, long = false) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: long ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
export function Badge({
  club,
  size = 'normal',
}: {
  club: Pick<Club, 'name' | 'short' | 'color'> & { id?: string };
  size?: 'normal' | 'large' | 'small';
}) {
  const logo = club.id ? clubLogo(club.id) : null;
  if (logo)
    return (
      <span className={`club-badge has-logo ${size}`} aria-label={club.name}>
        <img src={logo} alt="" loading="lazy" decoding="async" draggable={false} />
      </span>
    );
  return (
    <span
      className={`club-badge ${size}`}
      style={{ '--club-color': club.color } as React.CSSProperties}
      aria-label={club.name}
    >
      <span>{club.short}</span>
      <small>• • •</small>
    </span>
  );
}
export function Tile({
  children,
  className = '',
  onClick,
  label,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  label?: string;
}) {
  return onClick ? (
    <button className={`tile ${className}`} onClick={onClick} aria-label={label}>
      {children}
      <ArrowUpRight className="tile-arrow" size={22} />
    </button>
  ) : (
    <section className={`tile ${className}`} aria-label={label}>
      {children}
    </section>
  );
}
export function SectionTitle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <p className="eyebrow">{kicker}</p>
        <h1>
          {title}
          {!/[.!?]$/.test(title) && <span className="title-dot">.</span>}
        </h1>
      </div>
      {children}
    </div>
  );
}
export function Metric({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        className="dialog"
        data-focus-scope="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="text-button" data-dialog-close onClick={onClose}>
            Voltar <ChevronRight size={16} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function ManagerPortrait({ manager, large = false }: { manager: Manager; large?: boolean }) {
  if (manager.avatar)
    return (
      <img
        className={`manager-portrait ${large ? 'large' : ''}`}
        src={manager.avatar}
        alt={`Retrato de ${manager.firstName}`}
      />
    );
  return (
    <svg
      className={`manager-portrait ${large ? 'large' : ''}`}
      viewBox="0 0 320 400"
      role="img"
      aria-label="Ilustração original do manager; retrato por IA disponível após conexão"
    >
      <defs>
        <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#28445c" />
          <stop offset="1" stopColor="#102d43" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="382" rx="135" ry="17" fill="#122d42" opacity=".1" />
      <path d="M56 389l13-117 51-30h80l51 30 13 117z" fill="url(#jacket)" />
      <path d="M132 216h56v57l-28 25-28-25z" fill="#b88261" />
      <path d="M126 249l34 25 34-25-10 140h-47z" fill="#f3f5f3" />
      <path
        d="M151 283h18l-3 20 12 86h-35l13-86z"
        fill={manager.style === 'Terno azul' ? '#7c333b' : '#68877b'}
      />
      <path
        d="M121 241l39 148-55-93 17-11-24-20zM199 241l-39 148 55-93-17-11 24-20z"
        fill="#3c5669"
      />
      <ellipse cx="160" cy="158" rx="61" ry="78" fill="#cc9b77" />
      <path d="M101 149q-14-87 53-89 77-3 66 99l-18-53q-56 27-85 0z" fill="#263540" />
      <path d="M131 157h17m26 0h17" stroke="#3b3b38" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M157 164l-6 28h16m-24 19q17 8 34-1"
        fill="none"
        stroke="#94664e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M112 192q7 51 48 48 45 0 49-50-14 40-49 37-30 4-48-35"
        fill="#534638"
        opacity=".65"
      />
      <path d="M230 315l-20 54m-115-54l15 54" stroke="#173246" strokeWidth="4" />
    </svg>
  );
}
