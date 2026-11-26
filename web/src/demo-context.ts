import {createContext, useContext} from 'react';
import type {Product} from '../../shared/products';

/** App services the A2UI components need: the product catalog and "ask a follow-up". */
export interface DemoApi {
  products: ReadonlyMap<string, Product>;
  ask: (question: string) => void;
  addToCart: (productId: string) => void;
}

export const DemoContext = createContext<DemoApi>({
  products: new Map(),
  ask: () => {},
  addToCart: () => {},
});

export const useDemo = () => useContext(DemoContext);
export const useProduct = (id: string | undefined) => {
  const {products} = useDemo();
  return id ? products.get(id) : undefined;
};
