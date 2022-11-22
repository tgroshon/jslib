/**
 * A relatively clean approach to managing focus in a ergonomic, programmatic way
 *
 * Credit to TailwindLabs HeadlessUI project
 * https://github.com/tailwindlabs/headlessui
 *
 * MIT License
 *
 * Copyright (c) 2020 Tailwind Labs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { disposables } from "./disposables";

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

/**
 * Enum to indicate what direction to move focus; also used as a bitmask
 */
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

/**
 * Enum to indicate result of focus move attempt
 */
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

/**
 * Enum of rules to follow when selecting how to move focus
 */
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

/**
 * Helper: Poor-man pattern matching in javascript
 */
function match(value, lookup, ...args) {
  if (value in lookup) {
    let returnValue = lookup[value];
    return typeof returnValue === "function"
      ? returnValue(...args)
      : returnValue;
  }

  let error = new Error(
    `Tried to handle "${value}" but there is no handler defined. Only defined handlers are: ${Object.keys(
      lookup
    )
      .map((key) => `"${key}"`)
      .join(", ")}.`
  );
  if (Error.captureStackTrace) Error.captureStackTrace(error, match);
  throw error;
}

/**
 * Helper: get the element's ownerDocument with fallback to traverse element.current
 */
function getOwnerDocument(element) {
  if (element instanceof Node) return element.ownerDocument;

  // eslint-disable-next-line no-prototype-builtins
  if (element?.hasOwnProperty("current")) {
    if (element.current instanceof Node) return element.current.ownerDocument;
  }

  return document;
}

/**
 * Query an Array of all known focusable elements in the document
 */
export function getFocusableElements(container = document.body) {
  if (container == null) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS));
}

/**
 * Is the given element a known focusable type of element?
 */
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

/**
 * Restore focus to given element if it's owning document's active element is not "focusable"
 */
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

/**
 * Focus given element, prevent scroll
 */
export function focusElement(element) {
  element?.focus({ preventScroll: true });
}

// https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/select
const selectableSelector = ["textarea", "input"].join(",");
function isSelectableElement(element) {
  return element?.matches?.(selectableSelector) ?? false;
}

/**
 * Return shallow copy of node array, sorted by DOM position first to last
 */
export function sortByDomNode(nodes, resolveKey = (i) => i) {
  return nodes.slice().sort((aItem, zItem) => {
    const a = resolveKey(aItem);
    const z = resolveKey(zItem);

    if (a === null || z === null) return 0;

    // Position of Node Z relative to Node A; position = bitmask
    // MDN: https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
    const position = a.compareDocumentPosition(z);

    if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });
}

/**
 * Relative move the focus from a given Node according to a Focus-enum
 * indicator: i.e. Next, Last, Previous, etc.
 *
 * Convenience function for calling focusIn()
 */
export function focusFrom(current, focus) {
  return focusIn(getFocusableElements(), focus, true, current);
}

/**
 * Move focus to an element in a given container according to a
 * Focus-enum indicator: i.e. Next, Last, Previous, etc.
 *
 * Defaults to using the document's current active element
 */
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
