/** Product model and spec metadata shared by the server and the web client. */
import type {SpecKey} from './catalog-apis.js';

export interface Product {
  id: string;
  category: string;
  type: string;
  brand: string;
  name: string;
  price: number;
  oldPrice: number | null;
  rating: number;
  reviews: number;
  energyClass: string;
  annualKwh: number;
  dims: {w: number; h: number; d: number};
  color: string;
  stock: number;
  deliveryDays: number;
  warrantyYears: number;
  specs: Partial<Record<SpecKey, number | boolean>>;
  features: string[];
  description: string;
  image: string;
}

export const CATEGORY_LABELS: Record<string, string> = {
  lavadoras: 'Lavadoras',
  secadoras: 'Secadoras',
  frigorificos: 'Frigoríficos',
  lavavajillas: 'Lavavajillas',
  hornos: 'Hornos',
  placas: 'Placas de cocina',
  microondas: 'Microondas',
  campanas: 'Campanas',
  aspiradores: 'Aspiradores',
  climatizacion: 'Climatización',
  cafeteras: 'Cafeteras',
  pae: 'Pequeño electrodoméstico',
};

interface SpecMeta {
  label: string;
  unit?: string;
  /** Which direction is better, for highlighting the best value in comparisons. */
  better?: 'higher' | 'lower';
}

export const SPEC_META: Record<SpecKey, SpecMeta> = {
  price: {label: 'Precio', unit: '€', better: 'lower'},
  energyClass: {label: 'Clase energética', better: 'lower'},
  annualKwh: {label: 'Consumo anual', unit: 'kWh', better: 'lower'},
  capacityKg: {label: 'Capacidad', unit: 'kg', better: 'higher'},
  dryCapacityKg: {label: 'Capacidad de secado', unit: 'kg', better: 'higher'},
  spinRpm: {label: 'Centrifugado', unit: 'rpm', better: 'higher'},
  noiseDb: {label: 'Ruido', unit: 'dB', better: 'lower'},
  volumeLiters: {label: 'Capacidad', unit: 'L', better: 'higher'},
  placeSettings: {label: 'Capacidad', unit: 'cubiertos', better: 'higher'},
  noFrost: {label: 'No Frost'},
  dimensions: {label: 'Medidas (an × al × fo)'},
  zones: {label: 'Zonas', better: 'higher'},
  powerW: {label: 'Potencia', unit: 'W', better: 'higher'},
  airflowM3h: {label: 'Caudal de extracción', unit: 'm³/h', better: 'higher'},
  coolingKw: {label: 'Potencia frigorífica', unit: 'kW', better: 'higher'},
  coverageM2: {label: 'Superficie recomendada', unit: 'm²', better: 'higher'},
  batteryMin: {label: 'Autonomía', unit: 'min', better: 'higher'},
  suctionPa: {label: 'Succión', unit: 'Pa', better: 'higher'},
  pressureBar: {label: 'Presión', unit: 'bar', better: 'higher'},
  programs: {label: 'Programas', better: 'higher'},
  warrantyYears: {label: 'Garantía', unit: 'años', better: 'higher'},
  rating: {label: 'Valoración', unit: '★', better: 'higher'},
};

/** Default comparison rows per category. */
export const CATEGORY_DEFAULT_SPECS: Record<string, SpecKey[]> = {
  lavadoras: ['price', 'capacityKg', 'spinRpm', 'energyClass', 'annualKwh', 'noiseDb', 'dimensions', 'warrantyYears'],
  secadoras: ['price', 'capacityKg', 'energyClass', 'annualKwh', 'noiseDb', 'dimensions', 'warrantyYears'],
  frigorificos: ['price', 'volumeLiters', 'energyClass', 'annualKwh', 'noiseDb', 'noFrost', 'dimensions'],
  lavavajillas: ['price', 'placeSettings', 'energyClass', 'annualKwh', 'noiseDb', 'dimensions'],
  hornos: ['price', 'volumeLiters', 'programs', 'energyClass', 'dimensions', 'warrantyYears'],
  placas: ['price', 'zones', 'powerW', 'dimensions', 'warrantyYears'],
  microondas: ['price', 'volumeLiters', 'powerW', 'programs', 'dimensions'],
  campanas: ['price', 'airflowM3h', 'noiseDb', 'energyClass', 'dimensions'],
  aspiradores: ['price', 'suctionPa', 'batteryMin', 'noiseDb', 'rating'],
  climatizacion: ['price', 'coolingKw', 'coverageM2', 'energyClass', 'annualKwh', 'noiseDb'],
  cafeteras: ['price', 'pressureBar', 'powerW', 'rating'],
  pae: ['price', 'volumeLiters', 'powerW', 'programs', 'rating'],
};

/** Every energy class in the catalog, best first. */
export const ENERGY_CLASSES = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const ENERGY_ORDER: readonly string[] = ENERGY_CLASSES;

/**
 * EU energy label scales, best class first: the current A–G label and the previous A+++–D one,
 * which this catalog uses for ovens, range hoods and air conditioners.
 */
export const ENERGY_SCALES = {
  current: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  previous: ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D'],
} as const;
export type EnergyScaleName = keyof typeof ENERGY_SCALES;
/** Categories whose products carry the previous A+++–D label (the prompt tells the model so). */
export const PREVIOUS_LABEL_CATEGORIES = ['hornos', 'campanas', 'climatizacion'] as const;
const previousLabel = new Set<string>(PREVIOUS_LABEL_CATEGORIES);

/** The label scale a product's class belongs to. */
export function energyScaleOf(p: Product): EnergyScaleName {
  return previousLabel.has(p.category) || p.energyClass.includes('+') ? 'previous' : 'current';
}

/** Numeric value of a spec for ranking, or undefined when not comparable. */
export function specRankValue(p: Product, key: SpecKey): number | undefined {
  switch (key) {
    case 'price':
      return p.price;
    case 'energyClass':
      return ENERGY_ORDER.indexOf(p.energyClass);
    case 'annualKwh':
      return p.annualKwh;
    case 'warrantyYears':
      return p.warrantyYears;
    case 'rating':
      return p.rating;
    case 'dimensions':
    case 'noFrost':
      return undefined;
    default: {
      const v = p.specs[key];
      return typeof v === 'number' ? v : undefined;
    }
  }
}

const eur0 = new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0});
const eur2 = new Intl.NumberFormat('es-ES', {style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2});
const num = new Intl.NumberFormat('es-ES');
const conjunction = new Intl.ListFormat('es-ES', {type: 'conjunction'});

export const formatEur = (v: number, decimals = 0) => (decimals ? eur2 : eur0).format(v);
export const formatNum = (v: number) => num.format(v);
/** "a, b y c" */
export const formatList = (items: string[]) => conjunction.format(items);

/** Display string for a spec value. */
export function formatSpec(p: Product, key: SpecKey): string {
  const meta = SPEC_META[key];
  switch (key) {
    case 'price':
      return formatEur(p.price);
    case 'energyClass':
      return p.energyClass;
    case 'annualKwh':
      return `${formatNum(p.annualKwh)} kWh/año`;
    case 'warrantyYears':
      return `${p.warrantyYears} años`;
    case 'rating':
      return `${p.rating.toFixed(1).replace('.', ',')} ★ (${formatNum(p.reviews)})`;
    case 'dimensions':
      return `${p.dims.w} × ${p.dims.h} × ${p.dims.d} cm`;
    case 'noFrost': {
      const v = p.specs.noFrost;
      return v === undefined ? '—' : v ? 'Sí' : 'No';
    }
    default: {
      const v = p.specs[key];
      if (v === undefined || typeof v === 'boolean') return '—';
      return `${formatNum(v)}${meta.unit ? ` ${meta.unit}` : ''}`;
    }
  }
}
