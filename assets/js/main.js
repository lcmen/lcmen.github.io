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

  event.preventDefault();
  document.startViewTransition(function() {
    event.detail.resume();
  });
});

document.addEventListener('turbo:render', function() {
  window.menu.close();
});
