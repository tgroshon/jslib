export function getOwnerDocument(element) {
  if (element instanceof Node) return element.ownerDocument;

  // eslint-disable-next-line no-prototype-builtins
  if (element?.hasOwnProperty("current")) {
    if (element.current instanceof Node) return element.current.ownerDocument;
  }

  return document;
}
