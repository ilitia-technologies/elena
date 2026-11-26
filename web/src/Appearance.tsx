/** Top-bar menu to pick the theme (light, dark, system) and the visual style. */
import {useCallback, useRef, useState} from 'react';
import {Icon} from './a2ui/ui';
import {useDismiss} from './dismiss';
import {resolveTheme, STYLE_OPTIONS, THEME_OPTIONS, useAppearance} from './theme';

export function AppearanceMenu() {
  const [appearance, update] = useAppearance();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, wrap, button);

  const mode = resolveTheme(appearance.theme);
  return (
    <div className="appearance" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="icon-btn appearance-btn"
        aria-label="Apariencia"
        title="Apariencia: tema y estilo"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="palette" />
      </button>
      {open && (
        <div className="appearance-pop" role="dialog" aria-label="Apariencia">
          <div className="ap-label" id="ap-theme">
            Tema
          </div>
          <div className="seg" role="radiogroup" aria-labelledby="ap-theme">
            {THEME_OPTIONS.map((o) => {
              const on = appearance.theme === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} className={`seg-btn ${on ? 'is-on' : ''}`} data-theme-option={o.id} onClick={() => update({theme: o.id})}>
                  <Icon name={o.icon} /> {o.label}
                </button>
              );
            })}
          </div>
          <div className="ap-label" id="ap-style">
            Estilo
          </div>
          <div className="style-list" role="radiogroup" aria-labelledby="ap-style">
            {STYLE_OPTIONS.map((s) => {
              const on = appearance.style === s.id;
              const sw = s.swatch[mode];
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} className={`style-opt ${on ? 'is-on' : ''}`} data-style-option={s.id} onClick={() => update({style: s.id})}>
                  <span className="style-swatch" style={{background: sw.bg, color: sw.ink, fontFamily: s.font}} aria-hidden="true">
                    Aa
                    <i style={{background: sw.primary}} />
                  </span>
                  <span className="style-text">
                    <strong>{s.name}</strong>
                    <small>{s.description}</small>
                  </span>
                  {on && <Icon name="check" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
