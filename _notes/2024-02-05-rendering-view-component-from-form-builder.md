---
layout: post
title: "Rendering ViewComponent from Rails form builder"
description: "Leverage the power of view components for constructing form elements in Ruby on Rails"
date: 2024-02-05
tags:
    - ruby
    - rails
---

[ViewComponent](https://viewcomponent.org/) is a Ruby library designed for crafting reusable components, akin to React. It equips developers with all the necessary tools to construct encapsulated HTML chunks that are not only easily testable but also significantly faster than the built-in partials.

Components can be rendered using `render` helper that is available in controllers, helpers or templates:

```ruby
render MyComponent.new(name: 'Lucas') do
  <p>Hello, I am Lucas</p>
end
```

However, if we attempt to render the same component within a custom form builder, an error will be raised:

```ruby
class MyFormBuilders < ActionView::Helpers::FormBuilder
  def submit(value = nil, options = {})
    render ButtonComponent.new(variant: :primary, size: :lg) do
      value
    end
  end
end

# undefined method `render' for an instance of MyFormBuilders
```

To work around this issue, helper needs to instantiate view context so that we can call the `render` function on it:

```ruby
class MyFormBuilders < ActionView::Helpers::FormBuilder
  def submit(value = nil, options = {})
    view_context.render ButtonComponent.new(variant: :primary, size: :lg) do
      value
    end
  end

  private

  def view_context
    @view_context ||= ApplicationController.new.view_context
  end
end
```

Now, we can employ our view components within form builder methods, such as using a button component for form submissions.
