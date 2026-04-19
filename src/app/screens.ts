/** Screen lifecycle: a mount function populates a root element and returns its own cleanup. */
export type MountFn = (root: HTMLElement) => () => void;

export function mountScreen(root: HTMLElement, mount: MountFn): () => void {
  root.replaceChildren();
  return mount(root);
}
