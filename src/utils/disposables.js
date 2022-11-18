export function disposables() {
  let disposables = [];
  let queue = [];

  let api = {
    enqueue(fn) {
      queue.push(fn);
    },

    addEventListener(
      element /* HTMLElement | Document */,
      name,
      listener /*(event: WindowEventMap[TEventName]) => any*/,
      options /* boolean | AddEventListenerOptions */
    ) {
      element.addEventListener(name, listener, options);
      return api.add(() =>
        element.removeEventListener(name, listener, options)
      );
    },

    requestAnimationFrame(...args) {
      let raf = requestAnimationFrame(...args);
      return api.add(() => cancelAnimationFrame(raf));
    },

    nextFrame(...args) {
      return api.requestAnimationFrame(() => {
        return api.requestAnimationFrame(...args);
      });
    },

    setTimeout(...args) {
      let timer = setTimeout(...args);
      return api.add(() => clearTimeout(timer));
    },

    microTask(...args) {
      let task = { current: true };
      microTask(() => {
        if (task.current) {
          args[0]();
        }
      });
      return api.add(() => {
        task.current = false;
      });
    },

    add(cb) {
      disposables.push(cb);
      return () => {
        let idx = disposables.indexOf(cb);
        if (idx >= 0) {
          let [dispose] = disposables.splice(idx, 1);
          dispose();
        }
      };
    },

    dispose() {
      for (let dispose of disposables.splice(0)) {
        dispose();
      }
    },

    async workQueue() {
      for (let handle of queue.splice(0)) {
        await handle();
      }
    },
  };

  return api;
}
