class Menu {
  #button;
  #container;
  #open = false;

  constructor(button) {
    this.#button = button;
    this.#container = button.querySelector('nav');
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

  close() {
    this.#open = false;
    this.#button.classList.remove('active');
    this.#container.classList.add('opacity-0', 'pointer-events-none');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('#menu');
  window.menu = new Menu(button);
});

document.addEventListener('turbo:before-visit', function() {
  window.menu.close();
});
