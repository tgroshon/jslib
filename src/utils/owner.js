export function getOwnerDocument(element) {
  if (element instanceof Node) return element.ownerDocument;
  if (element?.hasOwnProperty("current")) {
    if (element.current instanceof Node) return element.current.ownerDocument;
  }

  return document;
}
