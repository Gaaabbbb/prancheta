/** Ícones pequenos em SVG (herdam a cor do texto). */

export function HomeIcon({ size = 12, title = 'Em casa' }: { size?: number; title?: string }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M8 1.6 1 7.7l1.1 1.2.9-.8V14.4h3.8v-4.2h2.4v4.2H13V8.1l.9.8L15 7.7Z" fill="currentColor" />
    </svg>
  );
}

export function PlaneIcon({ size = 12, title = 'Fora de casa' }: { size?: number; title?: string }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 16 16" role="img" aria-label={title}>
      <title>{title}</title>
      <path
        d="M15.2 7.1c.5.3.5 1.5 0 1.8l-5 .9-3 5.1H5.6l1.3-4.8-3.2.6-1.2 1.6H1.2l.7-3.3-.7-3.3h1.3l1.2 1.6 3.2.6L5.6 1.1h1.6l3 5.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Casa, avião ou "campo neutro" para um jogo. */
export function VenueIcon({ home, neutral, size = 12 }: { home: boolean; neutral?: boolean; size?: number }) {
  if (neutral)
    return (
      <svg className="ico" width={size} height={size} viewBox="0 0 16 16" role="img" aria-label="Campo neutro">
        <title>Campo neutro</title>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M2 8h12" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  return home ? <HomeIcon size={size} /> : <PlaneIcon size={size} />;
}
