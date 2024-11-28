---
layout: post
title: "Hotwire vs HTMX vs Unpoly"
description: "Hotwire, HTMX, and Unpoly for building modern UIs."
date: 2024-11-01
tags:
  - JavaScript
  - HTML
---

In today's web development landscape, there are numerous options for building responsive and interactive user interfaces. The most popular choices revolve around JavaScript frameworks for creating single-page applications (SPAs) powered by REST API or GraphQL backends, such as React, Vue.js, or Svelte. As a web developer with extensive experience in the [Ruby on Rails](https://rubyonrails.org/) framework for building backends, I have always preferred solutions that leverage server-side rendered views before transitioning to a fully decoupled front-end and back-end architecture.

Currently, the most popular options for building interactive UIs with server-side rendering are:

- [Hotwire](https://hotwired.dev/)
- [HTMX](https://htmx.org/)
- [Unpoly](https://unpoly.com/)

In this article, I will compare these libraries in the context of a small application I recently developed. As an engineer with an interest in understanding the underlying mechanisms, I grew tired of reading various discussions on Reddit and HackerNews. I decided to roll up my sleeves and build a simple TODO application (because there can never be enough of those, right?) to compare these libraries based on typical web application requirements such as partial updates, form validation, and modals.

The source code for the demo application is available on [GitHub](https://github.com/lcmen/hotwire-htmx-unpoly), and the application can be viewed in the browser [here](https://hotwire-htmx-unpoly.onrender.com/). Please note that it is hosted on a free Render.io dyno, so it may take approximately 50 seconds to boot on the first request, and the database resets on every cold boot.

## Introduction to the Contenders

Before delving into the implementation differences from a developer's perspective, let's briefly examine each library to understand their motivations.

### Hotwire

[Hotwire](https://hotwired.dev/) was developed by 37 Signals to replace Turbolinks with a more modern alternative providing additional capabilities. It comprises three elements:

- [Turbo](https://turbo.hotwired.dev/) - the successor to [Turbolinks](https://github.com/turbolinks/turbolinks)
- [Stimulus.js](https://stimulus.hotwired.dev/) - a JavaScript framework that uses `data` attributes as a source of truth to enhance HTML
- [Hotwire Native](https://native.hotwired.dev/) - a framework for building native mobile apps using the same HTML and CSS as web applications

In this article, I will focus on the first two packages, as I have no experience with building mobile applications.

Turbo supports updating page elements in three ways:

1. Turbo Drive - replaces the `<body>` of the page without reloading and parsing assets from the `<head>` element
2. Turbo Frame - replaces a part of the page

    ```html
    <turbo-frame id="main">
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
      <a href="/aboutme">About me</a>
    </turbo-frame>
    ```

3. Turbo Stream - updates a part of the page by performing a specified action (e.g., append, remove, replace). It can be delivered as a response to a regular request (e.g., form submission) or WebSocket broadcasts.

    ```html
    <turbo-stream action="append" target="#main">
      <template>
        <a href="/contact">Contact me</a>
      </template>
    </turbo-stream>
    ```

Hotwire, specifically Turbo Stream, is the only tool fully supported by ActionCable out of the box.

### HTMX

[HTMX](https://htmx.org/) is a continuation of the idea seeded by [Intercooler.js](https://intercoolerjs.org/) - hypermedia-powered applications. In simple terms, it means using HTML `data` attributes to extend the default request-response capabilities of HTTP requests. Intercooler was powered by [jQuery](https://jquery.com/), but as browsers adopted the latest JavaScript standards, the HTMX author rewrote it using vanilla JavaScript, making the core leaner with a smaller set of attributes while leaving additional features to extensions.

HTMX relies on specifying UI behavior using various `hx-` data attributes, e.g.

```html
<a href="/aboutme" hx-target=".main">About me</a>
```

HTMX is also very explicit - behavior for each element should be defined separately however to reduce repetition it also supports a form of inheritance from parent elements, e.g.

```html
<div hx-target=".main" hx-boost="true">
  <a href="/">Home</a>
  <a href="/blog">Blog</a>
  <a href="/aboutme">About me</a>
</div>
```

Besides `data` driven behaviors, HTMX includes basic JavaScript API for the most common operations (updating CSS classes, triggering and handling events, etc.). It's very simple so when more JavaScript interactivity is needed, developers usually reach for [Alpine.js](https://alpinejs.dev/) framework.

HTMX also includes a rich [extensions inventory](https://htmx.org/extensions/) to make the UI even snappier by taking advantage of background preloads, morphing, merging `<head>` tags, etc.

### Unpoly

[Unpoly](https://unpoly.com/) was created at [Makandra](https://makandra.de) as a response to the increasing complexity of the frontend tools. At the beginning, it relied on jQuery and was written in CoffeeScript but with version 2, the author dropped jQuery from its dependencies and rewrote the framework using vanilla JavaScript.

Similar to HTMX, Unpoly also relies on HTMX `data` attributes (specifically `up-` ones) for defining behaviors. On the other hand it's more implicit thanks to its convention that can be customized through multiple configuration options, e.g.

```javascript
# Handle all links via Ajax by default
up.link.config.followSelectors.push('a[href]')
# Submit all forms via Ajax by default
up.form.config.submitSelectors.push(['form'])
```

Also, in addition to manually defining targets for each Ajax interaction, Unpoly supports the concept of [layers](https://unpoly.com/up.layer). These layers (root, modal, drawer, popup, and cover) defines how new content should be loaded to the existing page, e.g.

```html
<a href="/contact" up-layer="modal">Contact me</a>
<a href="/menu" up-layer="drawer">Menu</a>
```

If we could compare HTMX and Unpoly to backend frameworks, HTMX would be Django then Unpoly would be Ruby on Rails.

Btw. As far as I'm aware, Unpoly is the only player from our trio that provides migration scripts to help with upgrading in your applications.

## Todo Application

We will evaluate each of the libraries in the context of a simple [TODO application](https://github.com/lcmen/hotwire-htmx-unpoly) that I built recently. We will look at each version in terms of supporting the following features:

1. Loading form in modal
2. Performing server-side form validation (within modal)
3. Redirecting from modal after successful form submission
4. Partially updating the page on complete toggle
5. Maintaining scroll position (needed for keeping the position when removing todos on longer pages)

The application I built follows a progressive enhancement philosophy where all variants are powered by the same controller (with small tweaks for redirects) and serves full HTML responses (no turbo streams).

### Modals

Modals for Hotwire and HTMX are powered by native `<dialog>` element with small sprinkle of JavaScript either via `Stimulus.js` controller (for Hotwire) or `Alpine.js` component (for HTMX) to automatically open the modal when new content is loaded inside or to perform a nice animation on close.

#### Stimulus controller + Turbo Frame:

```javascript
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { open: Boolean }

  backdropClose(event) {
    if (event.target.nodeName == "DIALOG") this.close()
  }

  closeWithAnimation(event) {
    if (this.openValue) this.close(event).then(() => event.detail.resume())
  }

  open() {
    this.openValue = true
    this.element.showModal()
  }

  close(event) {
    if (event) event.preventDefault()

    this.element.setAttribute("closing", "")

    return Promise.all(
      this.element.getAnimations().map((animation) => animation.finished),
    ).then(() => {
      this.element.removeAttribute("closing")
      this.openValue = false
      this.element.close()
    })
  }
}
```

```html
<dialog
  data-controller="modal"
  data-action="turbo:frame-load->modal#open turbo:before-render@window->modal#closeWithAnimation click->modal#backdropClose"
>
  <%= turbo_frame_tag "modal" %>
</dialog>
```

#### Alpine.js component + HTML

```javascript
export default function Modal() {
  return {
    show() {
      this.$el.showModal()
    },
    close() {
      this.$el.setAttribute("closing", "")

      Promise.all(
        this.$el.getAnimations().map((animation) => animation.finished),
      ).then(() => {
        this.$el.removeAttribute("closing")
        this.$el.close()
      })
    },
    closeIfOutside(event) {
      if (this.$el.open && event.target.nodeName == "DIALOG") this.close()
    },
    closeIfSuccessful(event) {
      if (event.detail.xhr.status < 400) this.close()
    },
  }
}
```

```html
<dialog
  id="modal"
  x-data="modal"
  @click="closeIfOutside"
  @htmx:after-request="closeIfSuccessful"
  @htmx:after-swap="show"
>
</dialog>
```

#### Unpoly

Unpoly provides support for showing modals out of the box. I only needed to configure animations and apply some Tailwind CSS classes through the stylesheet.

```javascript
up.layer.config.modal.openAnimation = 'fade-in'
up.layer.config.modal.closeAnimation = 'fade-out'
up.layer.config.modal.openDuration = 500
up.layer.config.modal.closeDuration = 500
```

Unpoly overlays support a range of [close conditions](https://unpoly.com/closing-overlays#close-conditions), including redirecting to a specific URL, making them particularly suitable for use with form submissions.

### Server side form validation

Display form validation errors within the modal works out of the box with Hotwire and Unpoly. For HTMX, I had to override `beforeSwap` event to treat 422 responses as swappable (by default only 200 and 300 responses are supported).

```javascript
document.body.addEventListener('htmx:beforeSwap', function(evt) {
  // Allow 422 responses to swap as they are form validation errors
  if (evt.detail.xhr.status === 422) {
    evt.detail.shouldSwap = true
    evt.detail.isError = false
  }
})
```

### Redirect after form submission

For redirects, I had to make some tweaks for HTMX and Hotwire:

- HTMX variant returns an empty body with `HX-Location` header to perform client-side redirects correctly in response to a successful form submission
- Hotwire variant uses custom `turbo-stream` action to opt out of `<turbo-frame>` for redirect as failed form submissions should still render errors inside the turbo-frame.

    ```javascript
    Turbo.StreamActions.redirect = function () {
      Turbo.visit(this.target)
    }
    ```

To use `Turbo.visit` to perform a redirect from JavaScript side, I had to disable caching to fix flickering during a redirect (page with open modal was served from the cache before showing the response from the server):

```html
<meta name="turbo-cache-control" content="no-cache">
```

### Partial updates

Each of the libraries supports partial updates out of the box. They only differ in how desired behavior is specified. While Turbo relies on `<turbo-frame>` element or `is="turbo-frame"` attribute, HTMX requires `hx-select` and `hx-target` attributes, and Unpoly needs either `up-target` or `up-layer` attribute.

For Unpoly, I had to disable caching for loading edit / new forms to make sure we always renders it with the latest state (new form with blank fields, edit form with the up to date todo values)

### Maintaining scroll position

Unpoly maintains scroll position by default but for Hotwire and HTMX I had to make some tweaks.

- HTMX required setting one option in the config:

    ```javascript
    htmx.config.scrollIntoViewOnBoost = false
    ```

- Unfortunately, Hotwire required me to implement this functionality from scratch:

    ```javascript
    window.scrollPosition = 0;

    document.addEventListener("turbo:before-visit", () => {
      if (document.body.dataset.preserveScroll === undefined) return

      scrollPosition = document.documentElement.scrollTop || document.body.scrollTop
    })

    document.addEventListener("turbo:load", () => {
      if (document.body.dataset.preserveScroll === undefined) return

      document.documentElement.scrollTop = document.body.scrollTop = scrollPosition
    })
    ```

## Conclusion

While each of these libraries enables the creation of responsive and interactive UIs, they do so in distinct ways and offer unique functionalities. Hotwire is particularly well-suited for scenarios requiring seamless integration with Rails, real-time updates via WebSockets, or building mobile applications. HTMX provides a straightforward approach to enhancing HTML with minimal JavaScript, making it ideal for developers who prioritize simplicity and explicit behavior. Unpoly, with its comprehensive set of features and conventions, offers a more declarative approach, minimizing the need for custom tweaks in common use cases.
