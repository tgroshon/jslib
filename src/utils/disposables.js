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

// Polyfill
function microTask(cb) {
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

/**
 * Re-usable API wrapper for scheduling events that you can easily cancel
 * Useful in react use-effect style cancellation situations
 */
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
