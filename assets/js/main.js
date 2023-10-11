document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('#toggle-menu').addEventListener('click', function(e) {
    e.currentTarget.classList.toggle('active');
    const container = document.querySelector('#menu');
    container.classList.toggle('opacity-0');
    container.classList.toggle('pointer-events-none');
  });
});
