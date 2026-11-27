/**
 * The questions of the conversation as chips, plus "Nueva conversación". The most recent questions
 * that fit are shown; older ones go into an "Anteriores" dropdown, and the open question always
 * stays visible.
 */
import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {Icon} from './a2ui/ui';
import {useDismiss} from './dismiss';

interface Item {
  id: number;
  question: string;
}

const GAP = 6;

export function HistoryBar({items, activeId, onPick, onNew}: {items: Item[]; activeId: number | null; onPick: (id: number) => void; onNew: () => void}) {
  const bar = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const moreWrap = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [fit, setFit] = useState(items.length);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, moreWrap, moreButton);

  // Re-measure when the questions change (not on every streamed event) and when the bar resizes.
  const key = items.map((t) => `${t.id}:${t.question}`).join('|');
  useLayoutEffect(() => {
    const el = bar.current;
    const m = measure.current;
    if (!el || !m) return;
    const compute = () => {
      const [newButton, moreBtn, ...chips] = [...m.children].map((c) => (c as HTMLElement).offsetWidth);
      const room = el.clientWidth - newButton - GAP;
      if (chips.reduce((s, w) => s + w + GAP, 0) <= room) return setFit(chips.length);
      let used = moreBtn + GAP;
      let n = 0;
      for (let i = chips.length - 1; i >= 0 && used + chips[i] + GAP <= room; i--) {
        used += chips[i] + GAP;
        n++;
      }
      setFit(Math.max(1, n));
    };
    compute();
    void document.fonts.ready.then(compute);
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [key]);

  let visible = items.slice(items.length - fit);
  const active = items.find((t) => t.id === activeId);
  if (active && !visible.includes(active)) visible = [active, ...visible.slice(1)];
  const hidden = items.filter((t) => !visible.includes(t)).reverse();

  return (
    <div className="history" ref={bar}>
      <button type="button" className="history-new" onClick={onNew} title="Empezar una conversación nueva">
        <Icon name="plus" />
        <span className="history-new-label">Nueva conversación</span>
      </button>
      {hidden.length > 0 && (
        <div className="history-more-wrap" ref={moreWrap}>
          <button ref={moreButton} type="button" className="history-more" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            Anteriores ({hidden.length}) <Icon name="chevron" />
          </button>
          {open && (
            <div className="history-menu" role="menu">
              {hidden.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="menuitem"
                  title={t.question}
                  onClick={() => {
                    onPick(t.id);
                    setOpen(false);
                  }}
                >
                  {t.question}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {visible.map((t) => (
        <button key={t.id} type="button" className={`history-chip ${t.id === activeId ? 'is-on' : ''}`} onClick={() => onPick(t.id)} title={t.question}>
          {t.question}
        </button>
      ))}
      {/* Invisible copies at natural width, to know what fits. */}
      <div className="history-measure" ref={measure} aria-hidden="true">
        <span className="history-new">
          <Icon name="plus" />
          <span className="history-new-label">Nueva conversación</span>
        </span>
        <span className="history-more">
          Anteriores (99) <Icon name="chevron" />
        </span>
        {items.map((t) => (
          <span key={t.id} className="history-chip-m">
            {t.question}
          </span>
        ))}
      </div>
    </div>
  );
}
