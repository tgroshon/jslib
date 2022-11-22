/**
 * Is the current device an iOS device?
 *
 * An OK way to detect iOS given the following:
 *   - `window.platform` is deprecated
 *   - `window.userAgent` doesn't contain the required information
 *   - `window.userAgentData.platform` is still experimental
 *     (https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/platform)
 */
export function isIOS() {
  return (
    // Check if it is an iPhone
    /iPhone/gi.test(window.navigator.platform) ||
    // Check if an iPad which reports itself as "MacIntel", but we can check if it is a touchscreen.
    (/Mac/gi.test(window.navigator.platform) &&
      window.navigator.maxTouchPoints > 0)
  );
}
