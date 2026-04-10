type BrandMarkProps = {
  variant?: 'hero' | 'pause' | 'compact';
  className?: string;
};

export const BRAND = {
  nameRu: 'Барнаульская Школа Покера',
  nameEn: 'Barnaul School of Poker',
  shortRu: 'БШП',
  shortEn: 'BSP',
  product: 'BSP Timer',
} as const;

export function BrandMark({ variant = 'compact', className = '' }: BrandMarkProps) {
  const isHero = variant === 'hero';
  const isPause = variant === 'pause';

  const shellClass = [
    'flex items-center justify-center gap-4 text-center',
    isHero ? 'flex-col' : 'flex-col sm:flex-row',
    className,
  ].join(' ');

  const monogramClass = [
    'grid place-items-center rounded-lg border font-black leading-none shadow-[0_0_35px_rgba(220,38,38,0.28)]',
    isHero ? 'h-24 w-24 text-[34px]' : 'h-16 w-16 text-[22px]',
    'border-red-500/45 bg-gradient-to-br from-red-700 via-[#202020] to-amber-500/30 text-white',
  ].join(' ');

  return (
    <div className={shellClass} aria-label={`${BRAND.nameRu} (${BRAND.shortRu}), ${BRAND.nameEn} (${BRAND.shortEn})`}>
      <div className={monogramClass}>{BRAND.shortRu}</div>
      <div className={isHero || isPause ? 'text-center' : 'text-center sm:text-left'}>
        <div className="text-[11px] font-bold uppercase text-amber-300/80">{BRAND.product}</div>
        <div
          className={[
            'font-black leading-tight text-white',
            isHero ? 'text-[32px]' : isPause ? 'text-[28px]' : 'text-[18px]',
          ].join(' ')}
        >
          {BRAND.nameRu}
        </div>
        <div className={isHero ? 'mt-1 text-[14px] text-white/55' : 'mt-1 text-[12px] text-white/45'}>
          {BRAND.nameEn} · {BRAND.shortEn}
        </div>
      </div>
    </div>
  );
}
