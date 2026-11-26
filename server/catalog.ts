/**
 * Builds the agent-side A2UI catalog: the kept basic components plus the ElectroHogar APIs.
 *
 * The basic components are loaded from their JSON definitions (a copy of the v1.0 basic
 * catalog shipped in @a2ui/web_core) rather than from `basicCatalog`, whose implementations
 * are Lit custom elements that need a DOM. That keeps this module runnable in Node.
 */
import {A2uiGenerator, CatalogConfig, type RendererCapabilities} from '@a2ui/agent';
import {Catalog, type ComponentApi, type FunctionApi} from '@a2ui/web_core/catalog';
import basicCatalogJson from '../shared/a2ui-basic-catalog.v1_0.json';
import {
  BASIC_COMPONENTS_KEPT,
  CATALOG_ID,
  CATALOG_INSTRUCTIONS,
  CUSTOM_APIS,
  PROTOCOL_VERSION,
} from '../shared/catalog-apis.js';

export function buildAgentCatalog() {
  const basicCatalog = Catalog.fromJson(basicCatalogJson as Record<string, unknown>);
  const basic = BASIC_COMPONENTS_KEPT.map((name) => {
    const api = basicCatalog.components.get(name);
    if (!api) throw new Error(`Basic component ${name} not found`);
    return api as ComponentApi;
  });
  const functions = ['formatString', 'formatNumber', 'formatCurrency', 'pluralize']
    .map((name) => basicCatalog.functions.get(name))
    .filter((f): f is FunctionApi => Boolean(f));
  // The basic catalog's own instructions carry Direct JSON examples, which conflict with the
  // Express format the model writes, so only our own instructions are used.
  return new Catalog<ComponentApi, FunctionApi>(
    CATALOG_ID,
    PROTOCOL_VERSION,
    [...basic, ...(CUSTOM_APIS as unknown as ComponentApi[])],
    functions,
    {instructions: CATALOG_INSTRUCTIONS, title: 'ElectroHogar catalog'},
  );
}

/** A single capabilities entry; the SDK applies it to the catalogs' protocol version (1.0). */
export const RENDERER_CAPABILITIES = {
  supportedCatalogIds: [CATALOG_ID],
} as RendererCapabilities;

export function createGenerator() {
  return new A2uiGenerator([new CatalogConfig(buildAgentCatalog() as never)]);
}
