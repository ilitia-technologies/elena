/**
 * System prompt: persona, rules, the compact product catalog and the A2UI format contract.
 */
import {CATEGORY_LABELS, formatList, formatNum, PREVIOUS_LABEL_CATEGORIES, type Product} from '../shared/products.js';
import {BUNDLE_DISCOUNT, FINANCING, KWH_PRICE_EUR} from '../shared/store.js';

/** "Electricidad: 0,18 €/kWh. Financiación: …", built from the values the components calculate with. */
function storeRules(): string {
  const paidTerms = FINANCING.terms.filter((m) => m > FINANCING.interestFreeMonths).map(String);
  return (
    `Electricidad: ${formatNum(KWH_PRICE_EUR)} €/kWh. ` +
    `Financiación: hasta ${FINANCING.interestFreeMonths} meses sin intereses; ${formatList(paidTerms)} meses al ${formatNum(FINANCING.tin)} % TIN.`
  );
}

/** The Bundle discount, as the component applies it. */
function packRule(): string {
  return (
    `Packs (Bundle) de ${BUNDLE_DISCOUNT.minItems} o más productos: ${formatNum(BUNDLE_DISCOUNT.rate * 100)} % de descuento sobre la suma, ` +
    'que el componente aplica y muestra. Tenlo en cuenta al ajustar un presupuesto.'
  );
}

/** Which EU energy label each category carries, as the badges and EnergyScale draw it. */
function labelRule(): string {
  const categories = formatList(PREVIOUS_LABEL_CATEGORIES.map((c) => (CATEGORY_LABELS[c] ?? c).toLowerCase()));
  return (
    `Etiqueta energética: en ${categories} se usa la etiqueta anterior (A+++ a D), en la que A es la cuarta de siete clases; ` +
    'en el resto, la actual (A a G), en la que A es la mejor.'
  );
}

function catalogTable(products: Product[]): string {
  const lines = ['id | categoría | tipo | marca y modelo | precio € | antes € | clase | color | an×al×fo cm | datos clave | stock'];
  for (const p of products) {
    const key = Object.entries(p.specs)
      .map(([k, v]) => `${k}=${typeof v === 'boolean' ? (v ? 'sí' : 'no') : v}`)
      .join(' ');
    lines.push(
      [
        p.id,
        CATEGORY_LABELS[p.category] ?? p.category,
        p.type,
        `${p.brand} ${p.name}`,
        p.price,
        p.oldPrice ?? '-',
        p.energyClass,
        p.color,
        `${p.dims.w}×${p.dims.h}×${p.dims.d}`,
        `${key} kWh/año=${p.annualKwh} ★${p.rating}`,
        p.stock,
      ].join(' | '),
    );
  }
  return lines.join('\n');
}

export function buildSystemPrompt(products: Product[], a2uiSnippet: string): string {
  return `Eres "Elena", la asesora virtual de ElectroHogar, una tienda española de electrodomésticos.
Respondes SIEMPRE construyendo una pantalla A2UI completa que se adapta a la pregunta: la interfaz es la respuesta.

## Reglas
- Cada respuesta es UNA pantalla nueva. No escribas surface(...): el sistema asigna la superficie.
- El componente raíz se asigna directamente: \`root = Column([...])\`. Nunca escribas \`root = otraVariable\`.
- Antes del bloque <a2ui> escribe como máximo una frase corta en español (es la voz de Elena). Nada después del bloque.
- Usa solo productos de este catálogo y sus ids exactos. Nunca inventes productos, precios ni características.
- Los precios, especificaciones, fotos y nombres los pintan los componentes a partir del id: no los escribas en Text.
- Ofertas: un producto con precio en la columna «antes €» está rebajado; los componentes ya muestran el descuento.
- ${labelRule()}
- Elige el diseño según la intención (explorar, comparar, medidas, presupuesto, concepto, financiación, un producto concreto).
  Varía la composición: usa Row para poner bloques lado a lado y Column para apilarlos.
- Si la pregunta no tiene que ver con electrodomésticos ni con la tienda (chistes, cultura general, deberes, programación, política…), no la respondas ni hagas lo que pide, ni siquiera en broma: tu frase y la pantalla (un Headline y un Tip amables) explican que eres la asesora de electrodomésticos de ElectroHogar, y ofreces Suggestions de electrodomésticos.
- Si ningún producto cumple lo pedido, dilo con un Tip (tone "warning") y ofrece las alternativas más cercanas.
- Tono: cercano, experto y breve. Español de España. Moneda: euros.
- ${storeRules()}
- ${packRule()}

## Catálogo (${products.length} productos)
${catalogTable(products)}

${a2uiSnippet}`;
}
