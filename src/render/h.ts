/** HTML and SVG element constructors. Not reactive — just a constructor shorthand. */

type Renderable = Node | string | null | undefined | false;

function isRenderable(v: Renderable): v is Node | string {
  return v !== null && v !== undefined && v !== false;
}

function toNode(v: Node | string): Node {
  return typeof v === 'string' ? document.createTextNode(v) : v;
}

type HProps<E extends HTMLElement> = Partial<
  Pick<E, { [K in keyof E]: E[K] extends string | boolean | number ? K : never }[keyof E]>
> & {
  class?: string;
  dataset?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  on?: Partial<{ [K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void }>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: HProps<HTMLElementTagNameMap[K]>,
  children?: Renderable[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    const { class: cls, dataset, style, on, ...rest } = props as Record<string, unknown> & {
      class?: string;
      dataset?: Record<string, string>;
      style?: Partial<CSSStyleDeclaration>;
      on?: Record<string, (e: Event) => void>;
    };
    if (cls !== undefined) el.className = cls;
    if (dataset) Object.assign(el.dataset, dataset);
    if (style) Object.assign(el.style, style);
    if (on) {
      for (const [event, handler] of Object.entries(on)) {
        el.addEventListener(event, handler as EventListener);
      }
    }
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) (el as Record<string, unknown>)[k] = v;
    }
  }
  if (children) el.append(...children.filter(isRenderable).map(toNode));
  return el;
}

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | undefined>,
  children?: (Node | null | undefined)[],
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined) el.setAttribute(k, typeof v === 'number' ? v.toFixed(2) : v);
    }
  }
  if (children) {
    for (const child of children) {
      if (child != null) el.append(child);
    }
  }
  return el;
}
