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
