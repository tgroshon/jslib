/**
 * Credit to TailwindLabs HeadlessUI project
 */
import { disposables } from "./disposables";
import { match } from "./match";
import { getOwnerDocument } from "./owner";

// Credit:
//  - https://stackoverflow.com/a/30753870
const FOCUSABLE_SELECTORS = [
  "[contentEditable=true]",
  "[tabindex]",
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "iframe",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
]
  .map((selector) => `${selector}:not([tabindex='-1'])`)
  .join(",");

export var Focus;
(function (Focus) {
  /** Focus the first non-disabled element */
  Focus[(Focus["First"] = 1)] = "First";
  /** Focus the previous non-disabled element */
  Focus[(Focus["Previous"] = 2)] = "Previous";
  /** Focus the next non-disabled element */
  Focus[(Focus["Next"] = 4)] = "Next";
  /** Focus the last non-disabled element */
  Focus[(Focus["Last"] = 8)] = "Last";
  /** Wrap tab around */
  Focus[(Focus["WrapAround"] = 16)] = "WrapAround";
  /** Prevent scrolling the focusable elements into view */
  Focus[(Focus["NoScroll"] = 32)] = "NoScroll";
})(Focus || (Focus = {}));

export var FocusResult;
(function (FocusResult) {
  /** Something went wrong while trying to focus. */
  FocusResult[(FocusResult["Error"] = 0)] = "Error";
  /** When `Focus.WrapAround` is enabled, going from position `N` to `N+1` where `N` is the last index in the array, then we overflow. */
  FocusResult[(FocusResult["Overflow"] = 1)] = "Overflow";
  /** Focus was successful. */
  FocusResult[(FocusResult["Success"] = 2)] = "Success";
  /** When `Focus.WrapAround` is enabled, going from position `N` to `N-1` where `N` is the first index in the array, then we underflow. */
  FocusResult[(FocusResult["Underflow"] = 3)] = "Underflow";
})(FocusResult || (FocusResult = {}));

export var FocusableMode;
(function (FocusableMode) {
  /** The element itself must be focusable. */
  FocusableMode[(FocusableMode["Strict"] = 0)] = "Strict";
  /** The element should be inside of a focusable element. */
  FocusableMode[(FocusableMode["Loose"] = 1)] = "Loose";
})(FocusableMode || (FocusableMode = {}));

var Direction;
(function (Direction) {
  Direction[(Direction["Previous"] = -1)] = "Previous";
  Direction[(Direction["Next"] = 1)] = "Next";
})(Direction || (Direction = {}));

export function getFocusableElements(container = document.body) {
  if (container == null) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
}

export function isFocusableElement(element, mode = FocusableMode.Strict) {
  if (element === getOwnerDocument(element)?.body) return false;

  return match(mode, {
    [FocusableMode.Strict]() {
      return element.matches(FOCUSABLE_SELECTORS);
    },
    [FocusableMode.Loose]() {
      let next = element;
      while (next !== null) {
        if (next.matches(FOCUSABLE_SELECTORS)) return true;
        next = next.parentElement;
      }
      return false;
    },
  });
}

export function restoreFocusIfNecessary(element) {
  const ownerDocument = getOwnerDocument(element);
  disposables().nextFrame(() => {
    if (
      ownerDocument &&
      !isFocusableElement(ownerDocument.activeElement, FocusableMode.Strict)
    ) {
      focusElement(element);
    }
  });
}

export function focusElement(element) {
  element?.focus({ preventScroll: true });
}

// https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select
const selectableSelector = ["textarea", "input"].join(",");
function isSelectableElement(element) {
  return element?.matches?.(selectableSelector) ?? false;
}

export function sortByDomNode(nodes, resolveKey = (i) => i) {
  return nodes.slice().sort((aItem, zItem) => {
    const a = resolveKey(aItem);
    const z = resolveKey(zItem);

    if (a === null || z === null) return 0;

    const position = a.compareDocumentPosition(z);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

export function focusFrom(current, focus) {
  return focusIn(getFocusableElements(), focus, true, current);
}

export function focusIn(container, focus, sorted = true, active = null) {
  const ownerDocument = Array.isArray(container)
    ? container.length > 0
      ? container[0].ownerDocument
      : document
    : container.ownerDocument;

  const elements = Array.isArray(container)
    ? sorted
      ? sortByDomNode(container)
      : container
    : getFocusableElements(container);

  active =
    active !== null && active !== void 0 ? active : ownerDocument.activeElement;

  const direction = (() => {
    if (focus & (Focus.First | Focus.Next)) return Direction.Next;
    if (focus & (Focus.Previous | Focus.Last)) return Direction.Previous;
    throw new Error(
      "Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last"
    );
  })();

  const startIndex = (() => {
    if (focus & Focus.First) return 0;
    if (focus & Focus.Previous)
      return Math.max(0, elements.indexOf(active)) - 1;
    if (focus & Focus.Next) return Math.max(0, elements.indexOf(active)) + 1;
    if (focus & Focus.Last) return elements.length - 1;
    throw new Error(
      "Missing Focus.First, Focus.Previous, Focus.Next or Focus.Last"
    );
  })();

  const focusOptions = focus & Focus.NoScroll ? { preventScroll: true } : {};
  const total = elements.length;

  let offset = 0;
  let next = undefined;

  do {
    // Guard against infinite loops
    if (offset >= total || offset + total <= 0) return FocusResult.Error;
    let nextIdx = startIndex + offset;
    if (focus & Focus.WrapAround) {
      nextIdx = (nextIdx + total) % total;
    } else {
      if (nextIdx < 0) return FocusResult.Underflow;
      if (nextIdx >= total) return FocusResult.Overflow;
    }
    next = elements[nextIdx];
    // Try the focus the next element, might not work if it is "hidden" to the user.
    next === null || next === void 0 ? void 0 : next.focus(focusOptions);
    // Try the next one in line
    offset += direction;
  } while (next !== ownerDocument.activeElement);
  // By default if you <Tab> to a text input or a textarea, the browser will
  // select all the text once the focus is inside these DOM Nodes. However,
  // since we are manually moving focus this behaviour is not happening. This
  // code will make sure that the text gets selected as-if you did it manually.
  // Note: We only do this when going forward / backward. Not for the
  // Focus.First or Focus.Last actions. This is similar to the `autoFocus`
  // behaviour on an input where the input will get focus but won't be
  // selected.
  if (focus & (Focus.Next | Focus.Previous) && isSelectableElement(next)) {
    next.select();
  }
  // This is a little weird, but let me try and explain: There are a few scenario's
  // in chrome for example where a focused `<a>` tag does not get the default focus
  // styles and sometimes they do. This highly depends on whether you started by
  // clicking or by using your keyboard. When you programmatically add focus `anchor.focus()`
  // then the active element (document.activeElement) is this anchor, which is expected.
  // However in that case the default focus styles are not applied *unless* you
  // also add this tabindex.
  if (!next.hasAttribute("tabindex")) next.setAttribute("tabindex", "0");

  return FocusResult.Success;
}
