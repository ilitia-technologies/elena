import type {ReactCatalogComponent} from '@a2ui/react';
import {Catalog, basicCatalog, type FunctionImplementation} from '@a2ui/web_core/v1_0';
import {CATALOG_ID, PROTOCOL_VERSION} from '../../../shared/catalog-apis';
import {CUSTOM_COMPONENTS} from './components';

/** Client catalog: every basic component and function, plus the ElectroHogar React components. */
export const clientCatalog = new Catalog<ReactCatalogComponent, FunctionImplementation>(
  CATALOG_ID,
  PROTOCOL_VERSION,
  [...(basicCatalog.components.values() as Iterable<ReactCatalogComponent>), ...CUSTOM_COMPONENTS],
  [...(basicCatalog.functions.values() as Iterable<FunctionImplementation>)],
);
