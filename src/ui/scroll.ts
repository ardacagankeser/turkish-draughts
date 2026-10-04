/**
 * Scrolls `container` just enough to show `element`. Unlike `scrollIntoView`, it never
 * scrolls the page itself: on a phone, where the move list sits below the board, that
 * pushed the board off the top of the screen after every move.
 */
export function revealWithin(container: HTMLElement, element: HTMLElement): void {
  const box = container.getBoundingClientRect();
  const item = element.getBoundingClientRect();
  if (item.top < box.top) container.scrollTop -= box.top - item.top;
  else if (item.bottom > box.bottom) container.scrollTop += item.bottom - box.bottom;
}
