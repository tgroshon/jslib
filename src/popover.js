import { computePosition, createPlatform } from "./utils/computePosition";

const platform = createPlatform();

/**
 * Popover: floating panels with arbitrary content like navigation menus, mobile
 * menus and flyout menus.
 *
 * See @floating_ui (aka popper.js) and Bootstrap 5 for inspiration
 *
 * <my-popover placement="top|bottom|left|right" strategy="absolute|fixed">
 *   <button slot="trigger">Toggle Popover</button>
 *   <p>Popover Content</p>
 * </my-popover>
 */
export class Popover extends HTMLElement {
  constructor() {
    // Always call super first in constructor
    super();

    // Create a shadow root
    const shadow = this.attachShadow({ mode: "open" });

    // Create spans
    const wrapper = document.createElement("span");
    wrapper.setAttribute("class", "wrapper");

    const trigger = document.createElement("span");
    trigger.setAttribute("class", "trigger");
    trigger.setAttribute("tabindex", 0);
    trigger.textContent = "hover me";
    wrapper.appendChild(trigger);

    const popover = document.createElement("span");
    popover.setAttribute("class", "popover");
    popover.textContent = this.getAttribute("data-text");
    wrapper.appendChild(popover);

    // Create some CSS to apply to the shadow dom
    const style = document.createElement("style");
    style.textContent = `
      .wrapper {
        position: relative;
      }

      .popover {
        width: max-content;
        position: absolute;
        top: 20px;
        left: 20px;
        background: #222;
        color: white;
        font-weight: bold;
        padding: 5px;
        border-radius: 4px;
        font-size: 90%;
        pointer-events: none;
      }

      .trigger:hover + .popover, .trigger:focus + .popover {
        opacity: 1;
      }
    `;

    // Attach the created elements to the shadow dom
    shadow.appendChild(style);
    shadow.appendChild(wrapper);

    computePosition(trigger, popover, { platform }).then(({ x, y }) => {
      Object.assign(popover.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }
}
