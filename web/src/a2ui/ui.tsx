/** Small presentational pieces shared by the custom A2UI components. */
import type {ReactNode} from 'react';
import {ENERGY_SCALES, energyScaleOf, formatEur, type Product} from '../../../shared/products';

/** The seven colours of an EU energy label, best class to worst (both scales have seven classes). */
export const ENERGY_RAMP = ['#00a651', '#50b848', '#bed630', '#fff200', '#fdb913', '#f37021', '#ed1c24'];
/** Text colour that stays readable on ENERGY_RAMP[step] (the yellow steps need dark text). */
export const energyInk = (step: number) => (step >= 2 && step <= 4 ? '#1b1b1b' : '#fff');

/** The product's class, coloured by its position on the product's own label scale. */
export function EnergyBadge({p, size = 'm'}: {p: Product; size?: 's' | 'm' | 'l'}) {
  const step = (ENERGY_SCALES[energyScaleOf(p)] as readonly string[]).indexOf(p.energyClass);
  return (
    <span className={`energy-badge energy-${size}`} style={{background: step < 0 ? '#999' : ENERGY_RAMP[step], color: step < 0 ? '#fff' : energyInk(step)}}>
      {p.energyClass}
    </span>
  );
}

export function Stars({value, reviews}: {value: number; reviews?: number}) {
  const full = Math.round(value * 2) / 2;
  return (
    <span className="stars" aria-label={`${value} de 5`}>
      <span className="stars-track">
        <span className="stars-fill" style={{width: `${(full / 5) * 100}%`}} />
      </span>
      <span className="stars-num">{value.toFixed(1).replace('.', ',')}</span>
      {reviews !== undefined && <span className="stars-rev">({reviews.toLocaleString('es-ES')})</span>}
    </span>
  );
}

export function Price({p, size = 'm'}: {p: Product; size?: 's' | 'm' | 'l'}) {
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return (
    <div className={`price price-${size}`}>
      <span className="price-now">{formatEur(p.price)}</span>
      {p.oldPrice && (
        <>
          <span className="price-old">{formatEur(p.oldPrice)}</span>
          <span className="price-off">−{discount}%</span>
        </>
      )}
    </div>
  );
}

export function Stock({p}: {p: Product}) {
  const low = p.stock <= 10;
  return (
    <div className={`stock ${low ? 'stock-low' : ''}`}>
      <span className="stock-dot" />
      {low ? `¡Últimas ${p.stock} unidades!` : 'En stock'} · Entrega en {p.deliveryDays === 1 ? '24 h' : `${p.deliveryDays} días`}
    </div>
  );
}

export function ProductImage({p, className = ''}: {p: Product; className?: string}) {
  return (
    <div className={`pimg ${className}`}>
      <img
        src={p.image}
        alt={`${p.brand} ${p.name}`}
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
          e.currentTarget.parentElement?.classList.add('pimg-missing');
        }}
      />
    </div>
  );
}

export function Section({title, children, className = ''}: {title?: string; children: ReactNode; className?: string}) {
  return (
    <section className={`block ${className}`}>
      {title && <h3 className="block-title">{title}</h3>}
      {children}
    </section>
  );
}

/** Shown where the model named a product id that is not in the catalog. */
export function Missing({id}: {id: string}) {
  return (
    <div className="missing" data-product-id={id}>
      Este producto ya no está disponible
    </div>
  );
}

export type IconName =
  | 'spark'
  | 'check'
  | 'cross'
  | 'info'
  | 'warn'
  | 'bulb'
  | 'ok'
  | 'cart'
  | 'bolt'
  | 'ruler'
  | 'trophy'
  | 'arrow'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'palette'
  | 'card'
  | 'plus'
  | 'chevron';

const line = {fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

export function Icon({name}: {name: IconName}) {
  const paths: Record<IconName, ReactNode> = {
    spark: <path d="M12 2l1.8 5.5L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.5z" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
    cross: <path d="M6.5 6.5l11 11m0-11l-11 11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
    info: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2zm0-8h-2V7h2z" />,
    warn: <path d="M12 2L1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z" />,
    bulb: <path d="M9 21h6v-1H9zm3-19a7 7 0 00-4 12.7V17a1 1 0 001 1h6a1 1 0 001-1v-2.3A7 7 0 0012 2z" />,
    ok: <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.5 14.5L6 12l1.4-1.4 3.1 3.1 6.1-6.1L18 9z" />,
    cart: <path d="M7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM5.2 4l.9 2H21l-3.6 7H8.1l-.9 2H19v2H4l2.2-4L3.6 4H1V2h3.8z" />,
    bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
    ruler: <path d="M3 17l14-14 4 4L7 21zm4.2-1.8l1.4 1.4 1.4-1.4-1.4-1.4zm2.8-2.8l1.4 1.4 1.4-1.4-1.4-1.4zm2.8-2.8l1.4 1.4 1.4-1.4-1.4-1.4z" />,
    trophy: <path d="M7 3h10v2h3v3a4 4 0 01-4 4h-.3A5 5 0 0113 14.9V18h3v3H8v-3h3v-3.1A5 5 0 018.3 12H8a4 4 0 01-4-4V5h3zm0 4H6v1a2 2 0 001 1.7zm10 0v2.7A2 2 0 0018 8V7z" />,
    arrow: <path d="M5 12h13m-5-6 6 6-6 6" {...line} strokeWidth={2.4} />,
    sun: (
      <g {...line}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2m0 15v2M4.6 4.6 6 6m12 12 1.4 1.4M2.5 12h2m15 0h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </g>
    ),
    moon: <path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z" {...line} />,
    monitor: (
      <g {...line}>
        <rect x="3" y="4" width="18" height="12.5" rx="2" />
        <path d="M8.5 20.5h7M12 16.5v4" />
      </g>
    ),
    palette: (
      <>
        <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4.1-4-7.2-9-7.2z" {...line} />
        <circle cx="7.5" cy="11.5" r="1.4" />
        <circle cx="10.5" cy="7.5" r="1.4" />
        <circle cx="15.2" cy="8" r="1.4" />
      </>
    ),
    card: (
      <g {...line}>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6.5 15h4" />
      </g>
    ),
    plus: <path d="M12 5v14M5 12h14" {...line} strokeWidth={2.4} />,
    chevron: <path d="m6 9 6 6 6-6" {...line} strokeWidth={2.4} />,
  };
  return (
    <svg className={`ico ico-${name}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
