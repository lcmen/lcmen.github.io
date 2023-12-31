class Menu {
  #button;
  #container;
  #open = false;

  constructor(button) {
    this.#button = button;
    this.#container = button.nextElementSibling;
    this.#button.addEventListener('click', this.toggle.bind(this));
  }

  toggle(e) {
    e.preventDefault();
    this.#open ? this.close() : this.open();
  }

  open() {
    this.#open = true;
    this.#button.classList.add('active');
    this.#container.classList.remove('opacity-0', 'pointer-events-none');
  }

  close(callback) {
    this.#open = false;

    if (callback) {
      this.#container.addEventListener('transitionend', callback, { once: true });
    }

    this.#button.classList.remove('active');
    this.#container.classList.add('opacity-0', 'pointer-events-none');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('#menu');
  window.menu = new Menu(button);
});

document.addEventListener('turbo:before-render', function(event) {
  if (!document.startViewTransition) return;

  // Override default render function to wrap it with `startViewTransition` for animation
  const render = event.detail.render;
  event.detail.render = (current, upcoming) => {
    const transition = document.startViewTransition(function() {
      render(current, upcoming);
    });

    return transition.updateCallbackDone;
  }
});

document.addEventListener('turbo:load', function() {
  // Exclude page from Turbo cache to avoid two DOM updates (with cached version, and then with server responded)
  // within single `startViewTransition` operation.
  Turbo.cache.exemptPageFromCache();
});

document.addEventListener('turbo:render', function() {
  window.menu.close();
});
