// Polyfill
export function microTask(cb) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(cb);
  } else {
    Promise.resolve()
      .then(cb)
      .catch((e) =>
        setTimeout(() => {
          throw e;
        })
      );
  }
}
