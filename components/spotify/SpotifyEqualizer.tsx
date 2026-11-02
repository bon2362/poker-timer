// Three green bars; they bounce while music plays here and stand still otherwise.
const bar = 'origin-bottom [transform-box:fill-box] motion-reduce:animate-none';

export function SpotifyEqualizer({ playing }: { playing: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="#1db954" className="shrink-0 opacity-60" aria-hidden="true">
      <rect x="1" y="5" width="3" height="8" className={`${bar} ${playing ? 'animate-eq-bar [animation-delay:-0.3s]' : ''}`} />
      <rect x="5.5" y="1" width="3" height="12" className={`${bar} ${playing ? 'animate-eq-bar [animation-delay:-0.6s] [animation-duration:0.7s]' : ''}`} />
      <rect x="10" y="7" width="3" height="6" className={`${bar} ${playing ? 'animate-eq-bar [animation-duration:1.1s]' : ''}`} />
    </svg>
  );
}
