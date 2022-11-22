/**
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

export var Focus;
(function (Focus) {
  /** Focus the first non-disabled item. */
  Focus[(Focus["First"] = 0)] = "First";
  /** Focus the previous non-disabled item. */
  Focus[(Focus["Previous"] = 1)] = "Previous";
  /** Focus the next non-disabled item. */
  Focus[(Focus["Next"] = 2)] = "Next";
  /** Focus the last non-disabled item. */
  Focus[(Focus["Last"] = 3)] = "Last";
  /** Focus a specific item based on the `id` of the item. */
  Focus[(Focus["Specific"] = 4)] = "Specific";
  /** Focus no items at all. */
  Focus[(Focus["Nothing"] = 5)] = "Nothing";
})(Focus || (Focus = {}));

export function calculateActiveIndex(action, resolvers) {
  const items = resolvers.resolveItems();
  if (items.length <= 0) return null;

  const currentActiveIndex = resolvers.resolveActiveIndex();
  const activeIndex =
    currentActiveIndex !== null && currentActiveIndex !== void 0
      ? currentActiveIndex
      : -1;

  const nextActiveIndex = (() => {
    switch (action.focus) {
      case Focus.First:
        return items.findIndex((item) => !resolvers.resolveDisabled(item));
      case Focus.Previous: {
        const idx = items
          .slice()
          .reverse()
          .findIndex((item, idx, all) => {
            if (activeIndex !== -1 && all.length - idx - 1 >= activeIndex)
              return false;
            return !resolvers.resolveDisabled(item);
          });
        if (idx === -1) return idx;
        return items.length - 1 - idx;
      }
      case Focus.Next:
        return items.findIndex((item, idx) => {
          if (idx <= activeIndex) return false;
          return !resolvers.resolveDisabled(item);
        });
      case Focus.Last: {
        const idx = items
          .slice()
          .reverse()
          .findIndex((item) => !resolvers.resolveDisabled(item));
        if (idx === -1) return idx;
        return items.length - 1 - idx;
      }
      case Focus.Specific:
        return items.findIndex(
          (item) => resolvers.resolveId(item) === action.id
        );
      case Focus.Nothing:
        return null;
      default:
        throw new Error("Unexpected object: " + action);
    }
  })();

  return nextActiveIndex === -1 ? currentActiveIndex : nextActiveIndex;
}
