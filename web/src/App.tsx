import {A2uiSurface, MarkdownComponentContext, type ReactCatalogComponent} from '@a2ui/react';
import {MessageProcessor, type SurfaceModel} from '@a2ui/web_core/v1_0';
import {useCallback, useEffect, useMemo, useRef, useState, type FormEvent} from 'react';
import {formatEur, formatNum, type Product} from '../../shared/products';
import {BUNDLE_DISCOUNT, FINANCING, HISTORY_TURNS} from '../../shared/store';
import {AppearanceMenu} from './Appearance';
import {HistoryBar} from './History';
import {clientCatalog} from './a2ui/catalog';
import {Markdown} from './a2ui/Markdown';
import {Icon, type IconName} from './a2ui/ui';
import {DemoContext, type DemoApi} from './demo-context';

interface TurnMeta {
  ms: number;
  inputTokens: number;
  outputTokens: number;
  repaired: boolean;
  fallback: boolean;
  droppedIds: string[];
}

interface Turn {
  id: number;
  question: string;
  processor: MessageProcessor<ReactCatalogComponent>;
  status: 'thinking' | 'done' | 'error';
  /** Progress events received: one when the model starts, one when it starts the screen, one per repair. */
  steps: number;
  say: string;
  error?: string;
  quotaLimited?: boolean;
  meta?: TurnMeta;
  express?: string;
  /** Elena's final sentence, sent back with `express` as conversation history. */
  finalSay?: string;
  messages?: unknown[];
}

/** The last answered turns, in the shape the API expects as history (it keeps no sessions). */
function historyOf(turns: Turn[]) {
  return turns
    .filter((t) => t.status === 'done' && t.express && !t.meta?.fallback)
    .slice(-HISTORY_TURNS)
    .map((t) => ({question: t.question, answer: `${t.finalSay ?? ''}\n<a2ui>\n${t.express}\n</a2ui>`}));
}

const STARTERS: {text: string; icon: IconName}[] = [
  {text: 'Busco una lavadora para 4 personas por menos de 600 €', icon: 'spark'},
  {text: 'Compara los frigoríficos combi más eficientes', icon: 'trophy'},
  {text: 'Tengo un hueco de 45 cm para un lavavajillas, ¿cuál me cabe?', icon: 'ruler'},
  {text: 'Quiero equipar la cocina entera con 2.500 €', icon: 'cart'},
  {text: '¿Qué significa la etiqueta energética? ¿Merece la pena una clase A?', icon: 'bolt'},
  {text: '¿Cuánto pagaría al mes por el robot aspirador más top?', icon: 'card'},
];

const MarkdownBridge = ({markdown}: {markdown: string}) => <Markdown markdown={markdown} />;

/**
 * A progress bar instead of status sentences. Each milestone of the answer sets a target that the
 * bar eases towards: request sent, model started, Elena's sentence, screen being written, repair.
 */
function Progress({turn}: {turn: Turn}) {
  const value = turn.steps >= 3 ? 93 : turn.steps >= 2 ? 82 : turn.say ? 50 : turn.steps >= 1 ? 32 : 12;
  return (
    <div className="progress" role="progressbar" aria-label="Preparando la respuesta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span style={{width: `${value}%`}} />
    </div>
  );
}

/** GET JSON, retrying for a few seconds if the server is temporarily unavailable. */
async function getJson<T>(url: string, attempts = 8): Promise<T> {
  for (let i = 1; ; i++) {
    const r = await fetch(url).catch(() => null);
    if (r?.ok) return (await r.json()) as T;
    if (i >= attempts) throw new Error(r ? `HTTP ${r.status}` : 'sin conexión');
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
}

function SurfaceView({processor}: {processor: MessageProcessor<ReactCatalogComponent>}) {
  const [surfaces, setSurfaces] = useState<SurfaceModel<ReactCatalogComponent>[]>(() => [...processor.getSurfaces().values()]);
  useEffect(() => {
    const sync = () => setSurfaces([...processor.getSurfaces().values()]);
    sync();
    const created = processor.onSurfaceCreated(sync);
    const deleted = processor.onSurfaceDeleted(sync);
    return () => {
      created.unsubscribe();
      deleted.unsubscribe();
    };
  }, [processor]);
  return (
    <>
      {surfaces.map((s) => (
        <A2uiSurface key={s.id} surface={s} />
      ))}
    </>
  );
}

async function* readSse(res: Response): AsyncGenerator<{event: string; data: unknown}> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    buf += decoder.decode(value, {stream: true});
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      yield {event, data: data ? JSON.parse(data) : null};
    }
  }
}

export function App() {
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [cart, setCart] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [model, setModel] = useState('');
  const [catalogError, setCatalogError] = useState(false);
  const nextId = useRef(1);
  const inFlight = useRef(new Map<number, AbortController>());
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;
  const busy = turns.some((t) => t.status === 'thinking');

  useEffect(() => {
    getJson<Product[]>('/api/products')
      .then((list) => setProducts(new Map(list.map((p) => [p.id, p]))))
      .catch(() => setCatalogError(true));
    getJson<{model?: string}>('/api/health')
      .then((h) => {
        setModel(h.model ?? '');
      })
      .catch(() => {});
  }, []);

  const patch = useCallback((id: number, change: Partial<Turn> | ((t: Turn) => Partial<Turn>)) => {
    setTurns((all) => all.map((t) => (t.id === id ? {...t, ...(typeof change === 'function' ? change(t) : change)} : t)));
  }, []);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;
      const id = nextId.current++;
      const history = historyOf(turnsRef.current);
      const processor = new MessageProcessor<ReactCatalogComponent>([clientCatalog]);
      setTurns((all) => [...all, {id, question: q, processor, status: 'thinking', steps: 0, say: ''}]);
      setActiveId(id);
      setDraft('');
      window.scrollTo({top: 0, behavior: 'smooth'});
      const controller = new AbortController();
      inFlight.current.set(id, controller);
      try {
        const request = () => fetch('/api/ask', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({question: q, history, surfaceId: `turn-${id}`}),
          signal: controller.signal,
        });
        let res = await request();
        // Establish the signed browser cookie before admitting a billable question.
        if (res.status === 428) {
          await res.arrayBuffer();
          res = await request();
        }
        if (res.status === 428) throw new Error('Activa las cookies para poder hacer preguntas');
        if (res.status === 429) {
          const seconds = Number(res.headers.get('Retry-After'));
          const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 60;
          patch(id, {status: 'error', quotaLimited: true, error: `Límite de 10 preguntas por hora alcanzado. Vuelve a intentarlo en ${minutes} min.`});
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        for await (const {event, data} of readSse(res)) {
          const d = data as Record<string, unknown>;
          if (event === 'step') patch(id, (t) => ({steps: t.steps + 1}));
          else if (event === 'say') patch(id, {say: String(d.text)});
          else if (event === 'a2ui') {
            processor.processMessages(d.messages as never);
            patch(id, {messages: d.messages as unknown[], express: String(d.express ?? ''), finalSay: String(d.say ?? '')});
          } else if (event === 'done') patch(id, {status: 'done', meta: d as unknown as TurnMeta});
          else if (event === 'error') patch(id, {status: 'error', error: String(d.message)});
        }
        patch(id, (t) => (t.status === 'thinking' ? {status: 'done'} : {}));
      } catch (e) {
        // A new conversation cancels the request (and, on the server, the model call): nothing to show.
        if (!controller.signal.aborted) patch(id, {status: 'error', error: (e as Error).message});
      } finally {
        inFlight.current.delete(id);
      }
    },
    [busy, patch],
  );

  /** The start screen; the conversation stays in the history bar. */
  const goHome = useCallback(() => {
    setActiveId(null);
    setShowDebug(false);
    window.scrollTo({top: 0});
  }, []);

  /** Forgets the conversation (the API keeps no session: the history it gets comes from `turns`). */
  const newConversation = useCallback(() => {
    inFlight.current.forEach((c) => c.abort());
    inFlight.current.clear();
    setTurns([]);
    setDraft('');
    goHome();
  }, [goHome]);

  const addToCart = useCallback(
    (productId: string) => {
      setCart((c) => [...c, productId]);
      const p = products.get(productId);
      setToast(p ? `${p.brand} ${p.name} añadido al carrito` : 'Añadido al carrito');
    },
    [products],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const api: DemoApi = useMemo(() => ({products, ask, addToCart}), [products, ask, addToCart]);
  const active = turns.find((t) => t.id === activeId);
  const cartTotal = cart.reduce((s, id) => s + (products.get(id)?.price ?? 0), 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  return (
    <DemoContext.Provider value={api}>
      <MarkdownComponentContext.Provider value={MarkdownBridge}>
        <div className={`app ${active ? 'has-answer' : 'is-empty'}`}>
          <header className="topbar">
            <a
              className="brand"
              href="/"
              title="Volver al inicio"
              onClick={(e) => {
                e.preventDefault();
                goHome();
              }}
            >
              <span className="brand-mark" aria-hidden="true">
                E
              </span>
              <span className="brand-name">
                Electro<b>Hogar</b>
              </span>
              <span className="brand-sub">Asesora IA</span>
            </a>
            <div className="topbar-right">
              <AppearanceMenu />
              <span className="cart-pill" title={`${cart.length} productos`}>
                <Icon name="cart" /> {cart.length} · {formatEur(cartTotal)}
              </span>
            </div>
          </header>
          {/* The store's promises, from the same rules the prompt and components use (shown by the Tienda style). */}
          <div className="usp-bar">
            <span>
              <Icon name="card" /> Hasta {FINANCING.interestFreeMonths} meses sin intereses
            </span>
            <span>
              <Icon name="cart" /> {formatNum(BUNDLE_DISCOUNT.rate * 100)} % de descuento en packs de {BUNDLE_DISCOUNT.minItems} o más
            </span>
            <span>
              <Icon name="spark" /> Una pantalla a medida para cada pregunta
            </span>
          </div>

          <section className="ask">
            {catalogError && (
              <div className="error-box catalog-error" role="alert">
                No he podido cargar el catálogo de productos. Comprueba que el servidor está en marcha y{' '}
                <button className="link" onClick={() => window.location.reload()}>
                  recarga la página
                </button>
                .
              </div>
            )}
            {!active && (
              <div className="ask-intro">
                <div className="avatar avatar-l">
                  E<span className="avatar-dot" aria-hidden="true" />
                </div>
                <h1>
                  Hola, soy Elena. <span>¿Qué electrodoméstico buscas?</span>
                </h1>
                <p>Pregúntame lo que quieras y te preparo una pantalla a medida: comparativas, medidas, presupuestos o financiación.</p>
              </div>
            )}
            <form className="ask-form" onSubmit={submit}>
              <input
                className="ask-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ej.: lavadora silenciosa de 9 kg para un piso con niños"
                aria-label="Tu pregunta"
                disabled={busy}
                autoFocus
              />
              <button className="ask-btn" disabled={busy || !draft.trim()} aria-label="Preguntar">
                {busy ? (
                  <span className="spinner" />
                ) : (
                  <>
                    <span className="ask-btn-label">Preguntar</span>
                    <Icon name="arrow" />
                  </>
                )}
              </button>
            </form>
            {!active && (
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s.text} className="starter" onClick={() => void ask(s.text)}>
                    <Icon name={s.icon} />
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            )}
            {!active && products.size > 0 && (
              <div className="showcase" aria-hidden="true">
                <div className="showcase-track">
                  {[...products.values(), ...products.values()].map((p, i) => (
                    <div key={`${p.id}-${i}`} className="showcase-item">
                      {/* Eager: a lazy image only starts loading once it slides into view, so tiles showed up empty.
                          All 47 photos weigh under 1 MB and the answers reuse them from the cache. */}
                      <img src={p.image} alt="" decoding="async" />
                    </div>
                  ))}
                </div>
                <div className="showcase-caption">
                  {products.size} electrodomésticos en catálogo · cada respuesta es una pantalla nueva diseñada por la IA
                </div>
              </div>
            )}
            {turns.length > 0 && <HistoryBar items={turns} activeId={activeId} onPick={setActiveId} onNew={newConversation} />}
          </section>

          {active && (
            <main className="canvas" key={active.id}>
              <div className="question-echo">“{active.question}”</div>
              {(active.say || active.status === 'thinking') && (
                <div className="say">
                  <div className="avatar">E</div>
                  <div className="say-bubble">{active.say || <span className="typing"><i /><i /><i /></span>}</div>
                </div>
              )}
              {active.status === 'thinking' && !active.messages && (
                <div className="skeleton">
                  <Progress turn={active} />
                  <div className="sk sk-title" />
                  <div className="sk-row">
                    <div className="sk sk-card" />
                    <div className="sk sk-card" />
                    <div className="sk sk-card" />
                  </div>
                  <div className="sk sk-line" />
                </div>
              )}
              {active.status === 'error' && (
                <div className="error-box" role="alert">
                  {active.quotaLimited ? active.error : <>No he podido preparar la respuesta ({active.error}). Prueba a reformular la pregunta.</>}
                </div>
              )}
              <div className="surface-wrap">
                <SurfaceView processor={active.processor} />
              </div>
              {active.meta && (
                <footer className="meta">
                  <span>
                    Pantalla diseñada por IA en {(active.meta.ms / 1000).toFixed(1).replace('.', ',')} s · {active.meta.inputTokens.toLocaleString('es-ES')} tokens de entrada ·{' '}
                    {active.meta.outputTokens.toLocaleString('es-ES')} de salida
                    {active.meta.repaired ? ' · reparada 1 vez' : ''}
                    {active.meta.fallback ? ' · diseño de respaldo' : ''}
                  </span>
                  <button className="link" onClick={() => setShowDebug((v) => !v)}>
                    {showDebug ? 'Ocultar' : 'Ver'} A2UI
                  </button>
                </footer>
              )}
              {showDebug && active.messages && (
                <div className="debug">
                  <div>
                    <h4>Lo que escribió el modelo (A2UI Express)</h4>
                    <pre>{active.express}</pre>
                  </div>
                  <div>
                    <h4>Mensajes A2UI v1.0 validados</h4>
                    <pre>{JSON.stringify(active.messages, null, 2)}</pre>
                  </div>
                </div>
              )}
            </main>
          )}
          {toast && (
            <div className="toast" role="status">
              <Icon name="check" /> {toast}
            </div>
          )}
        </div>
      </MarkdownComponentContext.Provider>
    </DemoContext.Provider>
  );
}
