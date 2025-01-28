---
layout: post
title: "How Rails Releases Database Connections After Each Web Request"
description: "how Rails releases database connections back to the pool after each web request."
date: 2025-01-28
tags:
  - Ruby on Rails
---

Recently, I came across some discussion mentioning that Ruby on Rails checks out a database connection from the connection pool on the first use within a web request and checks it in once the request is complete. While this wasn't new knowledge to me, I became curious about how it works under the hood.

A quick Google search and a discussion with ChatGPT pointed me to the `ActiveRecord::ConnectionAdapters::ConnectionManagement` middleware. However, after inspecting the [Rails source code on GitHub](https://github.com/rails/rails), I couldn't find this middleware. Further research confirmed that it was used in older versions of Rails but is no longer present in newer releases.

After digging through the documentation and source code, I found the `ConnectionPool` abstract class in [activerecord/lib/active_record/connection_adapters/abstract/connection_pool.rb](https://github.com/rails/rails/blob/main/activerecord/lib/active_record/connection_adapters/abstract/connection_pool.rb). Inside this class, I discovered the [`complete`](https://github.com/rails/rails/blob/main/activerecord/lib/active_record/connection_adapters/abstract/connection_pool.rb#L198) method, which calls `pool.release_connection`, responsible for checking in the active connection.

```ruby
def complete(_)
  ActiveRecord::Base.connection_handler.each_connection_pool do |pool|
    if (connection = pool.active_connection?)
      transaction = connection.current_transaction
      if transaction.closed? || !transaction.joinable?
        pool.release_connection
      end
    end
  end
end
```

This `complete` method is [hooked into](https://github.com/rails/rails/blob/main/activerecord/lib/active_record/connection_adapters/abstract/connection_pool.rb#L212) an instance of `ActiveSupport::Executor` within the Rails application whenever [ActiveRecord is initialized](https://github.com/rails/rails/blob/main/activerecord/lib/active_record/railtie.rb#L291).

```ruby
# activerecord/lib/active_record/connection_adapters/abstract/connection_pool.rb
def install_executor_hooks(executor = ActiveSupport::Executor)
  executor.register_hook(ExecutorHooks)
end

# rails/activerecord/lib/active_record/railtie.rb
initializer "active_record.set_executor_hooks" do
  ActiveRecord::QueryCache.install_executor_hooks
  ActiveRecord::AsynchronousQueriesTracker.install_executor_hooks
  ActiveRecord::ConnectionAdapters::ConnectionPool.install_executor_hooks
end
```

At this point, I understood that the connection is released back to the pool whenever the application's executor completes.

The next step in my journey was figuring out when the executor is actually marked as complete. Further investigation into the Rails source code led me to the [`ActionDispatch::Executor` middleware](https://github.com/rails/rails/blob/main/actionpack/lib/action_dispatch/middleware/executor.rb). (I won't dive into how Rack middleware works in Rails, as [the official guides cover this extensively](https://guides.rubyonrails.org/rails_on_rack.html).) This middleware marks the [executor's state as complete](https://github.com/rails/rails/blob/main/actionpack/lib/action_dispatch/middleware/executor.rb#L23) once the web request is processed by the framework.

```ruby
def call(env)
  state = @executor.run!(reset: true)
  begin
    response = @app.call(env)

    if env["action_dispatch.report_exception"]
      error = env["action_dispatch.exception"]
      @executor.error_reporter.report(error, handled: false, source: "application.action_dispatch")
    end

    returned = response << ::Rack::BodyProxy.new(response.pop) { state.complete! }
  rescue => error
    ...
  ensure
    state.complete! unless returned
  end
end
```

This middleware is automatically included in the framework's [DefaultMiddlewareStack for `Rails::Application`](https://github.com/rails/rails/blob/main/railties/lib/rails/application/default_middleware_stack.rb#L49):

```ruby
middleware.use ::ActionDispatch::Executor, app.executor
```

### Recap

At this point, we know:

1. The `ActionDispatch::Executor` middleware invokes `ActiveSupport::Executor.complete`.
2. `ActiveRecord` registers a callback for `ActiveSupport::Executor#complete` to release the active database connection back to the pool.

## ActiveSupport Executor

The last piece of the puzzle was understanding the role of `ActiveSupport::Executor` in this process.

I turned to the official guides again. As the [Executor section in the "Threading and Code Execution in Rails" guide](https://guides.rubyonrails.org/threading_and_code_execution.html#executor) explains:

> The Rails Executor separates application code from framework code: any time the framework invokes code you've written in your application, it will be wrapped by the Executor.
> The Executor consists of two callbacks: `to_run` and `to_complete`. The `to_run` callback is triggered before application code runs, and `to_complete` is called afterward.

Interestingly, this section also references the `ActiveRecord::ConnectionAdapters::ConnectionManagement` middleware I encountered earlier:

> Prior to Rails 5.0, some of these tasks were handled by separate Rack middleware classes (such as `ActiveRecord::ConnectionAdapters::ConnectionManagement`), or by directly wrapping code with methods like `ActiveRecord::Base.connection_pool.with_connection`. The Executor replaces these with a more unified abstraction.

Essentially, application code is wrapped with an executor so that the Rails framework can perform necessary housekeeping tasks like tracking active threads, managing the ActiveRecord query cache, and—most importantly for our discussion—returning active connections back to the pool.

This fits perfectly with my understanding of the difference between a framework and a library: with a library, you call third-party code; with a framework, the framework calls your code. The executor is simply a mechanism that allows Rails to safely invoke your application code while managing its internal dependencies and phases under the hood.
