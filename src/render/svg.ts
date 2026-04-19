/** Low-level SVG element creation and client-to-SVG coordinate conversion. */

export function createSvg<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

export function localSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): DOMPoint | SVGPoint | null {
  const inverse = svg.getScreenCTM()?.inverse();
  if (!inverse) {
    return null;
  }
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(inverse);
}
