/**
 * Server-side product catalog loader.
 *
 * The generated image prompt is retained only in data/products.json and is
 * removed before products are exposed to the app or model.
 */
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import type {Product} from '../shared/products.js';
import {projectRoot} from './paths.js';

const root = projectRoot();
export const PRODUCTS_PATH = path.join(root, 'data', 'products.json');

const productSchema = z.object({
  id: z.string().trim().min(1),
  category: z.string().trim().min(1),
  type: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price: z.number().finite(),
  oldPrice: z.number().finite().nullable(),
  rating: z.number().finite(),
  reviews: z.number().int().nonnegative(),
  energyClass: z.string().trim().min(1),
  annualKwh: z.number().finite(),
  dims: z.object({
    w: z.number().finite(),
    h: z.number().finite(),
    d: z.number().finite(),
  }),
  color: z.string().trim().min(1),
  stock: z.number().int().nonnegative(),
  deliveryDays: z.number().int().nonnegative(),
  warrantyYears: z.number().int().nonnegative(),
  specs: z.record(z.union([z.number(), z.boolean()])),
  features: z.array(z.string()),
  description: z.string(),
  imagePrompt: z.string().optional(),
}).strip();

type SeedProduct = z.infer<typeof productSchema>;

export function validateProducts(value: unknown): SeedProduct[] {
  const parsed = z.array(productSchema).parse(value);
  const ids = new Set<string>();

  for (const product of parsed) {
    if (ids.has(product.id)) {
      throw new Error(`Duplicate product id: ${product.id}`);
    }
    ids.add(product.id);
  }

  return parsed;
}

export function loadProducts(productsPath = PRODUCTS_PATH): Product[] {
  const parsed = JSON.parse(fs.readFileSync(productsPath, 'utf8')) as unknown;
  const seed = validateProducts(parsed);

  return seed
    .map(({imagePrompt: _imagePrompt, ...product}) => ({
      ...product,
      image: `/products/${product.id}.webp`,
    }))
    .sort((a, b) => a.category.localeCompare(b.category, 'en') || a.price - b.price);
}
