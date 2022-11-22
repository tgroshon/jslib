// Borrowed from https://github.com/floating-ui/floating-ui/

/**
 * Computes the `x` and `y` coordinates that will place the floating element
 * next to a reference element when it is given a certain positioning strategy.
 *
 * The `platform` interface logic is to abstract platforms like react-native, web, etc.
 */
export const computePosition = async (reference, floating, config) => {
  const {
    placement = "bottom",
    strategy = "absolute",
    middleware = [],
    platform,
  } = config;
  const validMiddleware = middleware.filter(Boolean);
  const rtl = getComputedStyle(floating).direction === "rtl";
  let rects = await platform.getElementRects({ reference, floating, strategy });

  let { x, y } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;

  let middlewareData = {};
  let resetCount = 0;
  for (let i = 0; i < validMiddleware.length; i++) {
    const { name, fn } = validMiddleware[i];

    const {
      x: nextX,
      y: nextY,
      data,
      reset,
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform,
      elements: { reference, floating },
    });

    x = nextX ?? x;
    y = nextY ?? y;

    middlewareData = {
      ...middlewareData,
      [name]: {
        ...middlewareData[name],
        ...data,
      },
    };

    if (reset && resetCount <= 50) {
      resetCount++;
      if (typeof reset === "object") {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects =
            reset.rects === true
              ? await platform.getElementRects({
                  reference,
                  floating,
                  strategy,
                })
              : reset.rects;
        }
        ({ x, y } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
      continue;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData,
  };
};

function computeCoordsFromPlacement({ reference, floating }, placement, rtl) {
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const mainAxis = getMainAxisFromPlacement(placement);
  const length = getLengthFromAxis(mainAxis);
  const commonAlign = reference[length] / 2 - floating[length] / 2;
  const side = getSide(placement);
  const isVertical = mainAxis === "x";
  let coords;
  switch (side) {
    case "top":
      coords = { x: commonX, y: reference.y - floating.height };
      break;
    case "bottom":
      coords = { x: commonX, y: reference.y + reference.height };
      break;
    case "right":
      coords = { x: reference.x + reference.width, y: commonY };
      break;
    case "left":
      coords = { x: reference.x - floating.width, y: commonY };
      break;
    default:
      coords = { x: reference.x, y: reference.y };
  }
  switch (getAlignment(placement)) {
    case "start":
      coords[mainAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
      break;
    case "end":
      coords[mainAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
      break;
    default:
  }
  return coords;
}

export function createPlatform() {
  return {
    getClippingRect,
    convertOffsetParentRelativeRectToViewportRelativeRect,
    isElement,
    getDimensions,
    getOffsetParent,
    getDocumentElement,
    getElementRects: ({ reference, floating, strategy }) => ({
      reference: getRectRelativeToOffsetParent(
        reference,
        getOffsetParent(floating),
        strategy
      ),
      floating: { ...getDimensions(floating), x: 0, y: 0 },
    }),
    getClientRects: (element) => Array.from(element.getClientRects()),
    isRTL: (element) => getComputedStyle(element).direction === "rtl",
  };
}

function getDimensions(element) {
  if (isHTMLElement(element)) {
    return {
      width: element.offsetWidth,
      height: element.offsetHeight,
    };
  }
  const rect = getBoundingClientRect(element);
  return { width: rect.width, height: rect.height };
}

function getBoundingClientRect(
  element,
  includeScale = false,
  isFixedStrategy = false
) {
  const clientRect = element.getBoundingClientRect();

  let scaleX = 1;
  let scaleY = 1;

  if (includeScale && isHTMLElement(element)) {
    scaleX =
      element.offsetWidth > 0
        ? Math.round(clientRect.width) / element.offsetWidth || 1
        : 1;
    scaleY =
      element.offsetHeight > 0
        ? Math.round(clientRect.height) / element.offsetHeight || 1
        : 1;
  }

  const win = isElement(element) ? getWindow(element) : window;
  const addVisualOffsets = !isLayoutViewport() && isFixedStrategy;

  const x =
    (clientRect.left +
      (addVisualOffsets ? win.visualViewport?.offsetLeft ?? 0 : 0)) /
    scaleX;
  const y =
    (clientRect.top +
      (addVisualOffsets ? win.visualViewport?.offsetTop ?? 0 : 0)) /
    scaleY;
  const width = clientRect.width / scaleX;
  const height = clientRect.height / scaleY;

  return {
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    x,
    y,
  };
}

function isHTMLElement(value) {
  return value instanceof getWindow(value).HTMLElement;
}
function isElement(value) {
  return value instanceof getWindow(value).Element;
}
function isNode(value) {
  return value instanceof getWindow(value).Node;
}
function isShadowRoot(node) {
  // Browsers without `ShadowRoot` support
  if (typeof ShadowRoot === "undefined") {
    return false;
  }
  const OwnElement = getWindow(node).ShadowRoot;
  return node instanceof OwnElement || node instanceof ShadowRoot;
}
function isOverflowElement(element) {
  // Firefox wants us to check `-x` and `-y` variations as well
  const { overflow, overflowX, overflowY, display } = getComputedStyle(element);
  return (
    /auto|scroll|overlay|hidden/.test(overflow + overflowY + overflowX) &&
    !["inline", "contents"].includes(display)
  );
}
function isTableElement(element) {
  return ["table", "td", "th"].includes(getNodeName(element));
}
function isContainingBlock(element) {
  // TODO: Try and use feature detection here instead
  const isFirefox = /firefox/i.test(getUAString());
  const css = getComputedStyle(element);
  const backdropFilter = css.backdropFilter || css.WebkitBackdropFilter;
  // This is non-exhaustive but covers the most common CSS properties that
  // create a containing block.
  // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
  return (
    css.transform !== "none" ||
    css.perspective !== "none" ||
    (backdropFilter ? backdropFilter !== "none" : false) ||
    (isFirefox && css.willChange === "filter") ||
    (isFirefox && (css.filter ? css.filter !== "none" : false)) ||
    ["transform", "perspective"].some((value) =>
      css.willChange.includes(value)
    ) ||
    ["paint", "layout", "strict", "content"].some(
      // TS 4.1 compat
      (value) => {
        const contain = css.contain;
        return contain != null ? contain.includes(value) : false;
      }
    )
  );
}
function isLayoutViewport() {
  // Not Safari
  return !/^((?!chrome|android).)*safari/i.test(getUAString());
  // Feature detection for this fails in various ways
  // • Always-visible scrollbar or not
  // • Width of <html>, etc.
  // const vV = win.visualViewport;
  // return vV ? Math.abs(win.innerWidth / vV.scale - vV.width) < 0.5 : true;
}
function isLastTraversableNode(node) {
  return ["html", "body", "#document"].includes(getNodeName(node));
}

function isWindow(value) {
  return (
    value &&
    value.document &&
    value.location &&
    value.alert &&
    value.setInterval
  );
}
function getWindow(node) {
  if (node == null) {
    return window;
  }
  if (!isWindow(node)) {
    const ownerDocument = node.ownerDocument;
    return ownerDocument ? ownerDocument.defaultView || window : window;
  }
  return node;
}

function getUAString() {
  const uaData = navigator.userAgentData;
  if (uaData === null || uaData === void 0 ? void 0 : uaData.brands) {
    return uaData.brands
      .map((item) => `${item.brand}/${item.version}`)
      .join(" ");
  }
  return navigator.userAgent;
}

function getParentNode(node) {
  if (getNodeName(node) === "html") {
    return node;
  }
  const result =
    // Step into the shadow DOM of the parent of a slotted node
    node.assignedSlot ||
    // DOM Element detected
    node.parentNode ||
    // ShadowRoot detected
    (isShadowRoot(node) ? node.host : null) ||
    // Fallback
    getDocumentElement(node);
  return isShadowRoot(result) ? result.host : result;
}

function getNodeName(node) {
  return isWindow(node) ? "" : node ? (node.nodeName || "").toLowerCase() : "";
}

function getDocumentElement(node) {
  return (
    (isNode(node) ? node.ownerDocument : node.document) || window.document
  ).documentElement;
}

function getTrueOffsetParent(element) {
  if (
    !isHTMLElement(element) ||
    getComputedStyle(element).position === "fixed"
  ) {
    return null;
  }
  return element.offsetParent;
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else {
      currentNode = getParentNode(currentNode);
    }
  }
  return null;
}
// Gets the closest ancestor positioned element. Handles some edge cases,
// such as table ancestors and cross browser bugs.
function getOffsetParent(element) {
  const window = getWindow(element);
  let offsetParent = getTrueOffsetParent(element);
  while (
    offsetParent &&
    isTableElement(offsetParent) &&
    getComputedStyle(offsetParent).position === "static"
  ) {
    offsetParent = getTrueOffsetParent(offsetParent);
  }
  if (
    offsetParent &&
    (getNodeName(offsetParent) === "html" ||
      (getNodeName(offsetParent) === "body" &&
        getComputedStyle(offsetParent).position === "static" &&
        !isContainingBlock(offsetParent)))
  ) {
    return window;
  }
  return offsetParent || getContainingBlock(element) || window;
}

function isScaled(element) {
  const rect = getBoundingClientRect(element);
  return (
    Math.round(rect.width) !== element.offsetWidth ||
    Math.round(rect.height) !== element.offsetHeight
  );
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const rect = getBoundingClientRect(
    element,
    // @ts-ignore - checked above (TS 4.1 compat)
    isOffsetParentAnElement && isScaled(offsetParent),
    strategy === "fixed"
  );
  let scroll = { scrollLeft: 0, scrollTop: 0 };
  const offsets = { x: 0, y: 0 };
  if (
    isOffsetParentAnElement ||
    (!isOffsetParentAnElement && strategy !== "fixed")
  ) {
    if (
      getNodeName(offsetParent) !== "body" ||
      isOverflowElement(documentElement)
    ) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      const offsetRect = getBoundingClientRect(offsetParent, true);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    } else if (documentElement) {
      offsets.x = getWindowScrollBarX(documentElement);
    }
  }
  return {
    x: rect.left + scroll.scrollLeft - offsets.x,
    y: rect.top + scroll.scrollTop - offsets.y,
    width: rect.width,
    height: rect.height,
  };
}

function getWindowScrollBarX(element) {
  // If <html> has a CSS width greater than the viewport, then this will be
  // incorrect for RTL.
  return (
    getBoundingClientRect(getDocumentElement(element)).left +
    getNodeScroll(element).scrollLeft
  );
}

function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    };
  }
  return {
    scrollLeft: element.pageXOffset,
    scrollTop: element.pageYOffset,
  };
}

function convertOffsetParentRelativeRectToViewportRelativeRect({
  rect,
  offsetParent,
  strategy,
}) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  if (offsetParent === documentElement) {
    return rect;
  }
  let scroll = { scrollLeft: 0, scrollTop: 0 };
  const offsets = { x: 0, y: 0 };
  if (
    isOffsetParentAnElement ||
    (!isOffsetParentAnElement && strategy !== "fixed")
  ) {
    if (
      getNodeName(offsetParent) !== "body" ||
      isOverflowElement(documentElement)
    ) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      const offsetRect = getBoundingClientRect(offsetParent, true);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
    // This doesn't appear to be need to be negated.
    // else if (documentElement) {
    //   offsets.x = getWindowScrollBarX(documentElement);
    // }
  }
  return Object.assign(Object.assign({}, rect), {
    x: rect.x - scroll.scrollLeft + offsets.x,
    y: rect.y - scroll.scrollTop + offsets.y,
  });
}

// Returns the inner client rect, subtracting scrollbars if present
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(
    element,
    false,
    strategy === "fixed"
  );
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  return {
    top,
    left,
    x: left,
    y: top,
    right: left + element.clientWidth,
    bottom: top + element.clientHeight,
    width: element.clientWidth,
    height: element.clientHeight,
  };
}
function getClientRectFromClippingAncestor(
  element,
  clippingAncestor,
  strategy
) {
  if (clippingAncestor === "viewport") {
    return rectToClientRect(getViewportRect(element, strategy));
  }
  if (isElement(clippingAncestor)) {
    return getInnerBoundingClientRect(clippingAncestor, strategy);
  }
  return rectToClientRect(getDocumentRect(getDocumentElement(element)));
}
// A "clipping ancestor" is an overflowable container with the characteristic of
// clipping (or hiding) overflowing elements with a position different from
// `initial`
function getClippingElementAncestors(element) {
  let result = getOverflowAncestors(element).filter(
    (el) => isElement(el) && getNodeName(el) !== "body"
  );
  let currentNode = element;
  let currentContainingBlockComputedStyle = null;
  // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle(currentNode);
    if (
      computedStyle.position === "static" &&
      currentContainingBlockComputedStyle &&
      ["absolute", "fixed"].includes(
        currentContainingBlockComputedStyle.position
      ) &&
      !isContainingBlock(currentNode)
    ) {
      // Drop non-containing blocks
      result = result.filter((ancestor) => ancestor !== currentNode);
    } else {
      // Record last containing block for next iteration
      currentContainingBlockComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  return result;
}
// Gets the maximum area that the element is visible in due to any number of
// clipping ancestors
function getClippingRect({ element, boundary, rootBoundary, strategy }) {
  const elementClippingAncestors =
    boundary === "clippingAncestors"
      ? getClippingElementAncestors(element)
      : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstClippingAncestor = clippingAncestors[0];
  const clippingRect = clippingAncestors.reduce((accRect, clippingAncestor) => {
    const rect = getClientRectFromClippingAncestor(
      element,
      clippingAncestor,
      strategy
    );
    accRect.top = Math.max(rect.top, accRect.top);
    accRect.right = Math.min(rect.right, accRect.right);
    accRect.bottom = Math.min(rect.bottom, accRect.bottom);
    accRect.left = Math.max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromClippingAncestor(element, firstClippingAncestor, strategy));
  return {
    width: clippingRect.right - clippingRect.left,
    height: clippingRect.bottom - clippingRect.top,
    x: clippingRect.left,
    y: clippingRect.top,
  };
}

function getViewportRect(element, strategy) {
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    const layoutViewport = isLayoutViewport();
    if (layoutViewport || (!layoutViewport && strategy === "fixed")) {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  return { width, height, x, y };
}

// Gets the entire size of the scrollable document area, even extending outside
// of the `<html>` and `<body>` rect bounds if horizontally scrollable
function getDocumentRect(element) {
  var _a;
  const html = getDocumentElement(element);
  const scroll = getNodeScroll(element);
  const body =
    (_a = element.ownerDocument) === null || _a === void 0 ? void 0 : _a.body;
  const width = Math.max(
    html.scrollWidth,
    html.clientWidth,
    body ? body.scrollWidth : 0,
    body ? body.clientWidth : 0
  );
  const height = Math.max(
    html.scrollHeight,
    html.clientHeight,
    body ? body.scrollHeight : 0,
    body ? body.clientHeight : 0
  );
  let x = -scroll.scrollLeft + getWindowScrollBarX(element);
  const y = -scroll.scrollTop;
  if (getComputedStyle(body || html).direction === "rtl") {
    x += Math.max(html.clientWidth, body ? body.clientWidth : 0) - width;
  }
  return { width, height, x, y };
}

function getOverflowAncestors(node, list = []) {
  var _a;
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody =
    scrollableAncestor ===
    ((_a = node.ownerDocument) === null || _a === void 0 ? void 0 : _a.body);
  const win = getWindow(scrollableAncestor);
  const target = isBody
    ? [win].concat(
        win.visualViewport || [],
        isOverflowElement(scrollableAncestor) ? scrollableAncestor : []
      )
    : scrollableAncestor;
  const updatedList = list.concat(target);
  return isBody
    ? updatedList
    : // @ts-ignore: isBody tells us target will be an HTMLElement here
      updatedList.concat(getOverflowAncestors(target));
}

function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    // @ts-ignore assume body is always available
    return node.ownerDocument.body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}

function getMainAxisFromPlacement(placement) {
  return ["top", "bottom"].includes(getSide(placement)) ? "x" : "y";
}

function getSide(placement) {
  return placement.split("-")[0];
}

function getLengthFromAxis(axis) {
  return axis === "y" ? "height" : "width";
}

function getAlignment(placement) {
  return placement.split("-")[1];
}

function rectToClientRect(rect) {
  return {
    ...rect,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
  };
}
