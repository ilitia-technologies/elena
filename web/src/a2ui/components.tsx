/**
 * React implementations of the ElectroHogar A2UI components.
 * Every product fact is read from the server catalog by id (useProduct), never from the model.
 */
import {createComponentImplementation} from '@a2ui/react';
import {useState} from 'react';
import {
  BundleApi,
  ComparisonTableApi,
  EnergyCostApi,
  EnergyScaleApi,
  FinancingApi,
  FitCheckApi,
  HeadlineApi,
  ProductCardApi,
  ProductGridApi,
  ProsConsApi,
  SpecHighlightsApi,
  SuggestionsApi,
  TipApi,
  type SpecKey,
} from '../../../shared/catalog-apis';
import {
  CATEGORY_DEFAULT_SPECS,
  CATEGORY_LABELS,
  ENERGY_SCALES,
  SPEC_META,
  energyScaleOf,
  formatEur,
  formatList,
  formatNum,
  formatSpec,
  specRankValue,
  type Product,
} from '../../../shared/products';
import {BUNDLE_DISCOUNT, FINANCING, KWH_PRICE_EUR} from '../../../shared/store';
import {useDemo, useProduct} from '../demo-context';
import {Markdown} from './Markdown';
import {ENERGY_RAMP, EnergyBadge, energyInk, Icon, Missing, Price, ProductImage, Section, Stars, Stock} from './ui';

/** Up to three headline specs for a product card. */
function keySpecs(p: Product): SpecKey[] {
  return (CATEGORY_DEFAULT_SPECS[p.category] ?? []).filter((k) => !['price', 'dimensions', 'energyClass', 'rating', 'warrantyYears'].includes(k)).slice(0, 3);
}

function monthly(price: number, months: number) {
  if (months <= FINANCING.interestFreeMonths) return {fee: price / months, total: price, tin: 0};
  const r = FINANCING.tin / 100 / 12;
  const fee = (price * r) / (1 - Math.pow(1 + r, -months));
  return {fee, total: fee * months, tin: FINANCING.tin};
}

// ---------------------------------------------------------------- Headline
export const Headline = createComponentImplementation(HeadlineApi, ({props}) => (
  <header className="headline">
    {props.eyebrow && <div className="headline-eyebrow">{props.eyebrow}</div>}
    <h2 className="headline-title">{props.title}</h2>
    {props.subtitle && <p className="headline-sub">{props.subtitle}</p>}
  </header>
));

// ---------------------------------------------------------------- ProductCard
function CardBody({p, variant, badge, reason}: {p: Product; variant: 'compact' | 'detailed' | 'hero'; badge?: string; reason?: string}) {
  const {ask, addToCart} = useDemo();
  if (variant === 'compact') {
    const more = () => ask(`Cuéntame más del ${p.brand} ${p.name}`);
    return (
      <article
        className="pcard pcard-compact"
        role="button"
        tabIndex={0}
        onClick={more}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            more();
          }
        }}
      >
        <ProductImage p={p} />
        <div className="pcard-info">
          <div className="pcard-brand">{p.brand}</div>
          <div className="pcard-name">{p.name}</div>
          <div className="pcard-row">
            <Price p={p} size="s" />
            <EnergyBadge p={p} size="s" />
          </div>
        </div>
      </article>
    );
  }
  if (variant === 'hero') {
    const fin = monthly(p.price, FINANCING.interestFreeMonths);
    return (
      <div className="pcard-cq">
        <article className="pcard pcard-hero">
          {badge && <div className="ribbon">{badge}</div>}
          <ProductImage p={p} className="pimg-hero" />
          <div className="pcard-hero-info">
            <div className="pcard-brand">
              {p.brand} · {p.type}
            </div>
            <h3 className="pcard-hero-name">{p.name}</h3>
            <Stars value={p.rating} reviews={p.reviews} />
            <p className="pcard-desc">{p.description}</p>
            {reason && (
              <p className="pcard-reason">
                <Icon name="spark" /> {reason}
              </p>
            )}
            <ul className="feature-list">
              {p.features.map((f) => (
                <li key={f}>
                  <Icon name="check" /> {f}
                </li>
              ))}
            </ul>
            <div className="pcard-hero-buy">
              <div>
                <Price p={p} size="l" />
                <div className="fin-hint">
                  o {formatEur(fin.fee, 2)}/mes en {FINANCING.interestFreeMonths} meses sin intereses
                </div>
              </div>
              <div className="pcard-hero-meta">
                <EnergyBadge p={p} size="l" />
              </div>
            </div>
            <Stock p={p} />
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => addToCart(p.id)}>
                <Icon name="cart" /> Añadir al carrito
              </button>
              <button className="btn btn-ghost" onClick={() => ask(`¿Con qué otros modelos compararías el ${p.brand} ${p.name}?`)}>
                Comparar
              </button>
            </div>
          </div>
        </article>
      </div>
    );
  }
  return (
    <div className="pcard-cq">
      <article className="pcard pcard-detailed">
        {badge && <div className="ribbon">{badge}</div>}
        <ProductImage p={p} />
        <div className="pcard-info">
          <div className="pcard-top">
            <div className="pcard-brand">{p.brand}</div>
            <EnergyBadge p={p} />
          </div>
          <div className="pcard-name">{p.name}</div>
          <div className="pcard-type">{p.type}</div>
          <Stars value={p.rating} reviews={p.reviews} />
          <div className="chips">
            {keySpecs(p).map((k) => (
              <span key={k} className="chip">
                {formatSpec(p, k)}
              </span>
            ))}
          </div>
          {reason && (
            <p className="pcard-reason">
              <Icon name="spark" /> {reason}
            </p>
          )}
          <div className="pcard-bottom">
            <Price p={p} />
            <button className="btn btn-icon" title="Añadir al carrito" onClick={() => addToCart(p.id)}>
              <Icon name="cart" />
            </button>
          </div>
          <Stock p={p} />
        </div>
      </article>
    </div>
  );
}

export const ProductCard = createComponentImplementation(ProductCardApi, ({props}) => {
  const p = useProduct(props.productId);
  if (!p) return <Missing id={props.productId} />;
  return <CardBody p={p} variant={props.variant ?? 'detailed'} badge={props.badge} reason={props.reason} />;
});

// ---------------------------------------------------------------- ProductGrid
export const ProductGrid = createComponentImplementation(ProductGridApi, ({props}) => {
  const {products} = useDemo();
  const items = (props.items ?? []).filter((it) => products.has(it.productId));
  return (
    <Section title={props.title} className="grid-block">
      <div className="pgrid">
        {items.map((it) => (
          <CardBody key={it.productId} p={products.get(it.productId)!} variant="detailed" badge={it.badge} reason={it.reason} />
        ))}
      </div>
    </Section>
  );
});

// ---------------------------------------------------------------- ComparisonTable
export const ComparisonTable = createComponentImplementation(ComparisonTableApi, ({props}) => {
  const {products, addToCart} = useDemo();
  const list = (props.productIds ?? []).map((id) => products.get(id)).filter((p): p is Product => Boolean(p));
  if (!list.length) return null;
  const specs: SpecKey[] = props.specs?.length ? props.specs : (CATEGORY_DEFAULT_SPECS[list[0].category] ?? ['price', 'energyClass']);
  const best = (k: SpecKey) => {
    const meta = SPEC_META[k];
    if (!meta.better) return undefined;
    const vals = list.map((p) => specRankValue(p, k)).filter((v): v is number => v !== undefined && v >= 0);
    if (vals.length < 2) return undefined;
    const target = meta.better === 'higher' ? Math.max(...vals) : Math.min(...vals);
    if (vals.every((v) => v === target)) return undefined;
    return target;
  };
  return (
    <Section title={props.title} className="compare-block">
      <div className="compare-scroll">
        <table className="compare" style={{['--cols' as string]: list.length}}>
          <thead>
            <tr>
              <th />
              {list.map((p) => (
                <th key={p.id} className={p.id === props.winnerId ? 'is-winner' : ''}>
                  {p.id === props.winnerId && (
                    <div className="winner-tag">
                      <Icon name="trophy" /> Recomendado
                    </div>
                  )}
                  <ProductImage p={p} className="pimg-sm" />
                  <div className="compare-brand">{p.brand}</div>
                  <div className="compare-name">{p.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specs.map((k) => {
              const b = best(k);
              return (
                <tr key={k}>
                  <th scope="row">{SPEC_META[k]?.label ?? k}</th>
                  {list.map((p) => {
                    const isBest = b !== undefined && specRankValue(p, k) === b;
                    return (
                      <td key={p.id} className={`${p.id === props.winnerId ? 'is-winner' : ''} ${isBest ? 'is-best' : ''}`}>
                        {k === 'energyClass' ? <EnergyBadge p={p} size="s" /> : formatSpec(p, k)}
                        {isBest && <span className="best-dot" title="Mejor valor" />}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="compare-buy">
              <th />
              {list.map((p) => (
                <td key={p.id} className={p.id === props.winnerId ? 'is-winner' : ''}>
                  <button className={`btn ${p.id === props.winnerId ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => addToCart(p.id)}>
                    <Icon name="cart" /> Añadir
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {props.verdict && (
        <div className="verdict">
          <Icon name="spark" />
          <span>{props.verdict}</span>
        </div>
      )}
    </Section>
  );
});

// ---------------------------------------------------------------- EnergyCost
export const EnergyCost = createComponentImplementation(EnergyCostApi, ({props}) => {
  const {products} = useDemo();
  const years = props.years ?? 10;
  const rows = (props.productIds ?? [])
    .map((id) => products.get(id))
    .filter((p): p is Product => Boolean(p))
    .map((p) => {
      const energy = p.annualKwh * KWH_PRICE_EUR * years;
      return {p, energy, total: p.price + energy, perYear: p.annualKwh * KWH_PRICE_EUR};
    });
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.total));
  const cheapest = Math.min(...rows.map((r) => r.total));
  return (
    <Section title={props.title ?? `Coste real en ${years} años`} className="energy-block">
      <div className="tco">
        {rows.map((r) => (
          <div key={r.p.id} className={`tco-row ${r.total === cheapest && rows.length > 1 ? 'is-best' : ''}`}>
            <div className="tco-label">
              <span className="tco-name">
                {r.p.brand} {r.p.name}
              </span>
              <EnergyBadge p={r.p} size="s" />
            </div>
            <div className="tco-bar">
              <span className="tco-buy" style={{width: `${(r.p.price / max) * 100}%`}} title="Precio de compra" />
              <span className="tco-energy" style={{width: `${(r.energy / max) * 100}%`}} title="Electricidad" />
            </div>
            <div className="tco-total">
              {formatEur(r.total)}
              <small>{formatEur(r.perYear)}/año de luz</small>
            </div>
          </div>
        ))}
      </div>
      <div className="tco-legend">
        <span>
          <i className="tco-buy" /> Precio de compra
        </span>
        <span>
          <i className="tco-energy" /> Electricidad ({formatNum(KWH_PRICE_EUR)} €/kWh)
        </span>
        {rows.length > 1 && (
          <strong>
            Diferencia en {years} años: {formatEur(max - cheapest)}
          </strong>
        )}
      </div>
    </Section>
  );
});

// ---------------------------------------------------------------- Financing
export const Financing = createComponentImplementation(FinancingApi, ({props}) => {
  const p = useProduct(props.productId);
  const {addToCart} = useDemo();
  const [months, setMonths] = useState<number>(FINANCING.interestFreeMonths);
  if (!p) return <Missing id={props.productId} />;
  const f = monthly(p.price, months);
  return (
    <Section title={props.title ?? 'Págalo a tu ritmo'} className="fin-block">
      <div className="fin">
        <div className="fin-product">
          <ProductImage p={p} className="pimg-xs" />
          <div>
            <div className="pcard-brand">{p.brand}</div>
            <div className="pcard-name">{p.name}</div>
            <Price p={p} size="s" />
          </div>
        </div>
        <div className="fin-terms" role="radiogroup" aria-label="Plazo">
          {FINANCING.terms.map((m) => (
            <button key={m} className={`fin-term ${m === months ? 'is-on' : ''}`} onClick={() => setMonths(m)} role="radio" aria-checked={m === months}>
              {m} meses
              {m <= FINANCING.interestFreeMonths && <small>0 %</small>}
            </button>
          ))}
        </div>
        <div className="fin-result">
          <div className="fin-fee">
            {formatEur(f.fee, 2)}
            <span>/mes</span>
          </div>
          <div className="fin-detail">
            {f.tin === 0 ? (
              <>
                <strong>Sin intereses</strong> · Total {formatEur(f.total, 2)}
              </>
            ) : (
              <>
                TIN {formatNum(f.tin)} % · Total {formatEur(f.total, 2)} · Intereses {formatEur(f.total - p.price, 2)}
              </>
            )}
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => addToCart(p.id)}>
            <Icon name="cart" /> Añadir al carrito · {months} meses
          </button>
        </div>
      </div>
      <p className="fineprint">Simulación orientativa sujeta a aprobación de la entidad financiera.</p>
    </Section>
  );
});

// ---------------------------------------------------------------- FitCheck
export const FitCheck = createComponentImplementation(FitCheckApi, ({props}) => {
  const {products} = useDemo();
  const gap = {w: props.gapWidthCm, h: props.gapHeightCm, d: props.gapDepthCm};
  const list = (props.productIds ?? []).map((id) => products.get(id)).filter((p): p is Product => Boolean(p));
  /** Centimetres missing in each dimension the customer gave; empty when the product fits. */
  const shortfalls = (p: Product) =>
    (
      [
        ['ancho', p.dims.w - gap.w],
        ['alto', gap.h === undefined ? 0 : p.dims.h - gap.h],
        ['fondo', gap.d === undefined ? 0 : p.dims.d - gap.d],
      ] as const
    ).filter(([, cm]) => cm > 0);
  const cm = (v: number) => `${formatNum(Math.round(v * 10) / 10)} cm`;
  // Front view: gap and product share one scale and are both centred, so neither is clipped.
  const W = 120;
  const H = 120;
  const scaleW = Math.max(gap.w, ...list.map((p) => p.dims.w));
  const scaleH = Math.max(gap.h ?? 0, ...list.map((p) => p.dims.h));
  const k = Math.min(W / scaleW, H / Math.max(scaleH, 1));
  const gapH = gap.h ?? scaleH;
  return (
    <Section title={props.title ?? 'Comprobación de medidas'} className="fit-block">
      <div className="fit-gap">
        <Icon name="ruler" /> Tu hueco: <strong>{gap.w} cm</strong> de ancho
        {gap.h !== undefined && (
          <>
            {' '}
            · <strong>{gap.h} cm</strong> de alto
          </>
        )}
        {gap.d !== undefined && (
          <>
            {' '}
            · <strong>{gap.d} cm</strong> de fondo
          </>
        )}
      </div>
      <div className="fit-list">
        {list.map((p) => {
          const missing = shortfalls(p);
          const ok = missing.length === 0;
          return (
            <div key={p.id} className={`fit-item ${ok ? 'fit-ok' : 'fit-ko'}`}>
              <svg viewBox={`0 0 ${W + 10} ${H + 10}`} className="fit-svg" aria-hidden="true">
                <rect x={5 + (W - gap.w * k) / 2} y={5 + H - gapH * k} width={gap.w * k} height={gapH * k} className="fit-gap-rect" />
                <rect x={5 + (W - p.dims.w * k) / 2} y={5 + H - p.dims.h * k} width={p.dims.w * k} height={p.dims.h * k} className="fit-prod-rect" />
              </svg>
              <div className="fit-info">
                <div className="pcard-name">
                  {p.brand} {p.name}
                </div>
                <div className="fit-dims">
                  {p.dims.w} × {p.dims.h} × {p.dims.d} cm
                </div>
                <div className={`fit-verdict ${ok ? 'ok' : 'ko'}`}>
                  <Icon name={ok ? 'check' : 'cross'} />{' '}
                  {!ok
                    ? `No cabe · le faltan ${formatList(missing.map(([dim, v]) => `${cm(v)} de ${dim}`))}`
                    : gap.w - p.dims.w < 1
                      ? 'Cabe justo'
                      : `Cabe · sobran ${cm(gap.w - p.dims.w)}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
});

// ---------------------------------------------------------------- Bundle
export const Bundle = createComponentImplementation(BundleApi, ({props}) => {
  const {products, addToCart} = useDemo();
  const list = (props.productIds ?? []).map((id) => products.get(id)).filter((p): p is Product => Boolean(p));
  const subtotal = list.reduce((s, p) => s + p.price, 0);
  const discount = list.length >= BUNDLE_DISCOUNT.minItems ? Math.round(subtotal * BUNDLE_DISCOUNT.rate) : 0;
  const total = subtotal - discount;
  const budget = props.budget;
  return (
    <Section className="bundle-block">
      <div className="bundle">
        <div className="bundle-head">
          <div>
            <div className="headline-eyebrow">Pack a medida</div>
            <h3 className="bundle-title">{props.title}</h3>
          </div>
          <div className="bundle-total">
            {formatEur(total)}
            {discount > 0 && (
              <small>
                Ahorras {formatEur(discount)} con el pack (−{formatNum(BUNDLE_DISCOUNT.rate * 100)} %)
              </small>
            )}
          </div>
        </div>
        <div className="bundle-items">
          {list.map((p, i) => (
            <div key={`${p.id}-${i}`} className="bundle-item">
              <ProductImage p={p} className="pimg-xs" />
              <div className="bundle-item-info">
                <div className="pcard-type">{CATEGORY_LABELS[p.category]}</div>
                <div className="pcard-name">
                  {p.brand} {p.name}
                </div>
              </div>
              <EnergyBadge p={p} size="s" />
              <div className="bundle-item-price">{formatEur(p.price)}</div>
            </div>
          ))}
        </div>
        {budget !== undefined && (
          <div className="budget">
            <div className="budget-bar">
              <span className={total > budget ? 'over' : ''} style={{width: `${Math.min(100, (total / budget) * 100)}%`}} />
            </div>
            <div className="budget-text">
              {total <= budget ? (
                <>
                  Dentro de tu presupuesto de {formatEur(budget)} · te sobran <strong>{formatEur(budget - total)}</strong>
                </>
              ) : (
                <>
                  Supera tu presupuesto de {formatEur(budget)} en <strong>{formatEur(total - budget)}</strong>
                </>
              )}
            </div>
          </div>
        )}
        {props.note && <p className="bundle-note">{props.note}</p>}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => list.forEach((p) => addToCart(p.id))}>
            <Icon name="cart" /> Añadir el pack al carrito
          </button>
        </div>
      </div>
    </Section>
  );
});

// ---------------------------------------------------------------- SpecHighlights
export const SpecHighlights = createComponentImplementation(SpecHighlightsApi, ({props}) => {
  const p = useProduct(props.productId);
  if (!p) return <Missing id={props.productId} />;
  return (
    <div className="spec-tiles">
      {(props.specs ?? []).map((k) => (
        <div key={k} className="spec-tile">
          <div className="spec-value">{k === 'energyClass' ? <EnergyBadge p={p} size="l" /> : formatSpec(p, k)}</div>
          <div className="spec-label">{SPEC_META[k]?.label ?? k}</div>
        </div>
      ))}
    </div>
  );
});

// ---------------------------------------------------------------- ProsCons
export const ProsCons = createComponentImplementation(ProsConsApi, ({props}) => (
  <Section title={props.title} className="proscons-block">
    <div className="proscons">
      <ul className="pros">
        {(props.pros ?? []).map((t, i) => (
          <li key={i}>
            <Icon name="check" /> {t}
          </li>
        ))}
      </ul>
      <ul className="cons">
        {(props.cons ?? []).map((t, i) => (
          <li key={i}>
            <Icon name="cross" /> {t}
          </li>
        ))}
      </ul>
    </div>
  </Section>
));

// ---------------------------------------------------------------- EnergyScale
export const EnergyScale = createComponentImplementation(EnergyScaleApi, ({props}) => {
  // With a product, its real class and label scale come from the catalog; otherwise the model's highlight.
  const p = useProduct(props.productId);
  const highlight: string | undefined = p?.energyClass ?? props.highlight;
  const scale = p ? energyScaleOf(p) : highlight?.includes('+') ? 'previous' : 'current';
  const caption = props.caption ?? (p ? `${p.brand} ${p.name}: clase ${p.energyClass}` : undefined);
  return (
    <div className="escale" data-scale={scale}>
      <div className="escale-head">
        <Icon name="bolt" /> Etiqueta energética UE{scale === 'previous' ? ' · escala A+++ a D' : ''}
      </div>
      {ENERGY_SCALES[scale].map((c, i) => (
        <div key={c} className={`escale-row ${highlight === c ? 'is-on' : ''}`}>
          <span className="escale-bar" style={{width: `${38 + i * 9}%`, background: ENERGY_RAMP[i], color: energyInk(i)}}>
            {c}
          </span>
          {highlight === c && <span className="escale-pointer">{c}</span>}
        </div>
      ))}
      {caption && <p className="escale-caption">{caption}</p>}
    </div>
  );
});

// ---------------------------------------------------------------- Tip
export const Tip = createComponentImplementation(TipApi, ({props}) => {
  const tone = props.tone ?? 'tip';
  const icon = ({info: 'info', tip: 'bulb', warning: 'warn', success: 'ok'} as const)[tone];
  return (
    <aside className={`tip tip-${tone}`}>
      <Icon name={icon} />
      <div>
        <div className="tip-title">{props.title}</div>
        <Markdown markdown={props.text} />
      </div>
    </aside>
  );
});

// ---------------------------------------------------------------- Suggestions
export const Suggestions = createComponentImplementation(SuggestionsApi, ({props}) => {
  const {ask} = useDemo();
  const items = (props.suggestions ?? []).slice(0, 4);
  return (
    <nav className="suggest" aria-label="Preguntas sugeridas">
      <div className="suggest-title">{props.title ?? 'Sigue preguntando'}</div>
      <div className="suggest-list">
        {items.map((s, i) => (
          <button key={i} className="suggest-chip" onClick={() => ask(s)}>
            {s}
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </nav>
  );
});

export const CUSTOM_COMPONENTS = [
  Headline,
  ProductCard,
  ProductGrid,
  ComparisonTable,
  EnergyCost,
  Financing,
  FitCheck,
  Bundle,
  SpecHighlights,
  ProsCons,
  EnergyScale,
  Tip,
  Suggestions,
];
