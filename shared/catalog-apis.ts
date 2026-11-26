/**
 * Custom A2UI component APIs for the appliance store ("ElectroHogar").
 *
 * Shared by the server (prompt + validation through @a2ui/agent) and the web client
 * (React implementations). Components receive product ids only: names, prices, specs and
 * images are always read from the server product catalog, never written by the model.
 */
import {z} from 'zod';
import {ENERGY_CLASSES} from './products.js';

export const CATALOG_ID = 'https://demo.electrohogar.local/catalogs/electro/v1/catalog.json';
export const PROTOCOL_VERSION = '1.0';

/** Spec keys the comparison and highlight components understand. */
export const SPEC_KEYS = [
  'price',
  'energyClass',
  'annualKwh',
  'capacityKg',
  'dryCapacityKg',
  'spinRpm',
  'noiseDb',
  'volumeLiters',
  'placeSettings',
  'noFrost',
  'dimensions',
  'zones',
  'powerW',
  'airflowM3h',
  'coolingKw',
  'coverageM2',
  'batteryMin',
  'suctionPa',
  'pressureBar',
  'programs',
  'warrantyYears',
  'rating',
] as const;
export type SpecKey = (typeof SPEC_KEYS)[number];

const productId = z.string().describe('Product id from the catalog, e.g. "LAV-002". Never invent ids.');
const productIds = z.array(productId);

export const ProductCardApi = {
  name: 'ProductCard',
  schema: z
    .object({
      productId,
      variant: z
        .enum(['compact', 'detailed', 'hero'])
        .optional()
        .describe('compact: small tile. detailed: card with key specs. hero: large featured card for a single top pick.'),
      badge: z.string().optional().describe('Short ribbon text such as "Mejor opción", "Más vendido", "Ahorro".'),
      reason: z.string().optional().describe('One sentence (Spanish) on why this product fits the customer.'),
    })
    .strict(),
};

export const ProductGridApi = {
  name: 'ProductGrid',
  schema: z
    .object({
      title: z.string().optional(),
      items: z
        .array(
          z
            .object({
              productId,
              badge: z.string().optional(),
              reason: z.string().optional().describe('One short sentence on why it is listed.'),
            })
            .strict(),
        )
        .describe('2 to 8 products shown as a responsive grid of cards.'),
    })
    .strict(),
};

export const ComparisonTableApi = {
  name: 'ComparisonTable',
  schema: z
    .object({
      title: z.string().optional(),
      productIds: productIds.describe('2 to 4 products of the same category.'),
      specs: z
        .array(z.enum(SPEC_KEYS))
        .optional()
        .describe(`Rows to show, most relevant first, as spec keys (not labels): ${SPEC_KEYS.join(', ')}. Omit to use the category defaults.`),
      winnerId: z.string().optional().describe('Product id to highlight as the recommended choice.'),
      verdict: z.string().optional().describe('One or two sentences (Spanish) explaining the recommendation.'),
    })
    .strict(),
};

export const EnergyCostApi = {
  name: 'EnergyCost',
  schema: z
    .object({
      title: z.string().optional(),
      productIds: productIds.describe('1 to 4 products whose running cost to compare.'),
      years: z.number().int().min(1).max(15).optional().describe('Horizon for the total cost of ownership. Default 10.'),
    })
    .strict(),
};

export const FinancingApi = {
  name: 'Financing',
  schema: z
    .object({
      productId,
      title: z.string().optional(),
    })
    .strict(),
};

export const FitCheckApi = {
  name: 'FitCheck',
  schema: z
    .object({
      title: z.string().optional(),
      productIds: productIds.describe('Products to check against the gap.'),
      gapWidthCm: z.number().describe('Width of the customer gap in cm.'),
      gapHeightCm: z.number().optional().describe('Height of the gap in cm, if known.'),
      gapDepthCm: z.number().optional().describe('Depth of the gap in cm, if known.'),
    })
    .strict(),
};

export const BundleApi = {
  name: 'Bundle',
  schema: z
    .object({
      title: z.string().describe('Bundle name, e.g. "Cocina completa".'),
      productIds: productIds.describe('2 to 6 products of different categories.'),
      budget: z.number().optional().describe('Customer budget in EUR, if stated.'),
      note: z.string().optional(),
    })
    .strict(),
};

export const SpecHighlightsApi = {
  name: 'SpecHighlights',
  schema: z
    .object({
      productId,
      specs: z.array(z.enum(SPEC_KEYS)).describe(`2 to 4 headline specs shown as big tiles, as spec keys: ${SPEC_KEYS.join(', ')}.`),
    })
    .strict(),
};

export const ProsConsApi = {
  name: 'ProsCons',
  schema: z
    .object({
      title: z.string().optional(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
    })
    .strict(),
};

export const EnergyScaleApi = {
  name: 'EnergyScale',
  schema: z
    .object({
      productId: productId
        .optional()
        .describe('Product whose energy label to show: its class and label scale are read from the catalog. Use it whenever the screen is about one product.'),
      highlight: z
        .enum(ENERGY_CLASSES)
        .optional()
        .describe('Class to point at when no product is given, e.g. to explain the label. A+++, A++ and A+ belong to the previous A+++ to D label.'),
      caption: z.string().optional(),
    })
    .strict(),
};

export const TipApi = {
  name: 'Tip',
  schema: z
    .object({
      tone: z.enum(['info', 'tip', 'warning', 'success']).optional(),
      title: z.string(),
      text: z.string().describe('Short Spanish text; simple Markdown allowed.'),
    })
    .strict(),
};

export const HeadlineApi = {
  name: 'Headline',
  schema: z
    .object({
      eyebrow: z.string().optional().describe('Tiny label above the title, e.g. the category.'),
      title: z.string(),
      subtitle: z.string().optional(),
    })
    .strict(),
};

export const SuggestionsApi = {
  name: 'Suggestions',
  schema: z
    .object({
      title: z.string().optional(),
      suggestions: z.array(z.string()).describe('2 to 4 follow-up questions the customer can tap, in Spanish.'),
    })
    .strict(),
};

export const CUSTOM_APIS = [
  HeadlineApi,
  ProductCardApi,
  ProductGridApi,
  ComparisonTableApi,
  EnergyCostApi,
  FinancingApi,
  FitCheckApi,
  BundleApi,
  SpecHighlightsApi,
  ProsConsApi,
  EnergyScaleApi,
  TipApi,
  SuggestionsApi,
] as const;

/**
 * Basic catalog components the assistant may use; the rest are pruned from the prompt.
 * Image is left out so the model cannot place arbitrary URLs (product photos come from the
 * product components), and Icon because its icon font is not part of this app.
 */
export const BASIC_COMPONENTS_KEPT = ['Text', 'Row', 'Column', 'List', 'Card', 'Tabs', 'Divider'];

export const CATALOG_INSTRUCTIONS = `
## ElectroHogar components

- Product facts (name, brand, price, specs, image) are rendered by the components from the product database.
  Pass product ids only. Never write prices, specs or product names inside Text components.
- Start every surface with a Headline. End it with Suggestions (2 to 4 follow-up questions).
- Pick the layout that fits the question:
  * browsing or "show me" -> ProductGrid (optionally a Tip)
  * one clear best pick -> ProductCard variant "hero" + SpecHighlights + ProsCons or Financing
  * "compare" / "difference between" -> ComparisonTable (+ EnergyCost when efficiency matters)
  * a gap or measurements -> FitCheck, then the products that fit
  * a budget for several appliances -> Bundle
  * a concept question (energy label, inverter, no frost...) -> Tip and EnergyScale or Text, products optional
  * monthly payments -> Financing
- Compose the screen like a magazine page, not a plain list: put two medium, complementary blocks side by side in a Row
  (Tip + EnergyScale, Financing + ProsCons, FitCheck + Tip, SpecHighlights + ProsCons, Bundle + Tip).
  Keep wide blocks (ProductGrid, ComparisonTable, ProductCard "hero", EnergyCost) on their own line in the Column.
  Use Tabs only to split clearly separate groups.
- Write all visible text in Spanish (Spain).
`.trim();
