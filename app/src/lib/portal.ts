/** Moves the node to the end of the body, out of any ancestor that drags, clips or transforms what is inside it. */
export function portal(node: HTMLElement): { destroy(): void } {
  document.body.append(node)
  return { destroy: () => node.remove() }
}
