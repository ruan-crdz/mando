import { type ReactNode, useEffect, useRef } from 'react';
import { ArrowUpRight, ChevronLeft } from 'lucide-react';
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
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const root = ref.current;
    (
      root?.querySelector<HTMLElement>('[data-autofocus]') ||
      root?.querySelector<HTMLElement>(
        '.dialog-body button:not(:disabled), .dialog-body input, .dialog-body select',
      ) ||
      root?.querySelector<HTMLElement>('button')
    )?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        ref={ref}
        className={`dialog ${wide ? 'wide' : ''}`}
        data-focus-scope="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="text-button" data-dialog-close onClick={onClose}>
            <ChevronLeft size={16} /> Voltar
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </section>
    </div>
  );
}
export function ManagerPortrait({ manager, large = false }: { manager: Manager; large?: boolean }) {
  if (manager.avatar)
    return (
      <img
        className={`manager-portrait photo ${large ? 'large' : ''}`}
        src={manager.avatar}
        alt={`Retrato de ${manager.firstName}`}
      />
    );
  const initials = `${manager.firstName[0] || 'M'}${manager.lastName[0] || ''}`.toUpperCase();
  const suit =
    manager.style === 'Agasalho'
      ? '#1b9e5a'
      : manager.style === 'Camisa social'
        ? '#e9eef7'
        : '#13285e';
  return (
    <svg
      className={`manager-portrait silhouette ${large ? 'large' : ''}`}
      viewBox="0 0 320 400"
      role="img"
      aria-label={`Silhueta de ${manager.firstName || 'manager'}; gere um retrato por IA`}
    >
      <defs>
        <linearGradient id="mp-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="1" stopColor="#9fd8ff" stopOpacity=".75" />
        </linearGradient>
        <linearGradient id="mp-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={suit} />
          <stop offset="1" stopColor="#050c2c" />
        </linearGradient>
      </defs>
      <path d="M40 400c4-78 40-118 120-126 80 8 116 48 120 126z" fill="url(#mp-body)" />
      <path d="M128 262h64l-6 34-26 22-26-22z" fill="url(#mp-skin)" opacity=".85" />
      <path d="M138 276l22 46 22-46 14 6-36 118-36-118z" fill="#ffffff" opacity=".9" />
      <path d="M156 296h8l6 90h-20z" fill={manager.style === 'Agasalho' ? 'none' : '#e5323b'} />
      <ellipse cx="160" cy="170" rx="66" ry="84" fill="url(#mp-skin)" />
      <path
        d="M94 160q-10-96 66-98 78 0 68 98-10-46-68-48-58 2-66 48z"
        fill="#0b1a46"
        opacity=".85"
      />
      <text
        x="160"
        y="196"
        textAnchor="middle"
        fontSize="54"
        fontWeight="800"
        fill="#0b1a46"
        opacity=".55"
      >
        {initials}
      </text>
    </svg>
  );
}
