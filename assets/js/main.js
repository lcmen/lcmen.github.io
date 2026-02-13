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
