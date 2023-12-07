---
layout: post
title: "Ruby on Rails asset URL with fingerprint"
description: "Get URL to Ruby on Rails application asset files including their fingerprint"
date: 2023-10-09
tags:
    - ruby
    - rails
---

To get relative URL to application's assets with their fingerprints, `ActionController::Base.helpers#asset_url` method can be used.
It accepts a file name, and prints the relative path to the file, e.g.

```
irb(main):002:0> ActionController::Base.helpers.asset_path("application.js")
=> "/assets/application-8bf8a8aca6320619e6e4a215ae3f613d9cc3aa269397aa3fc93b821b1c56319c.js"
```

If the absolute URL is needed, then `host` option must be provided, e.g.

```
irb(main):004:0> ActionController::Base.helpers.asset_path("application.js", host: "http://localhost:3000")
=> "http://localhost:3000/assets/application-8bf8a8aca6320619e6e4a215ae3f613d9cc3aa269397aa3fc93b821b1c56319c.js"
```

Since, providing `host` manually can be cumbersome, it can be automated with a simple helper:

```ruby
def asset_host
  @host ||= Rails.configuration.asset_host || default_host
end

def default_host
  opts = Rails.application.routes.default_url_options.dup.tap do |options|
    options[:scheme] = options.delete(:protocol)
  end
  URI::Generic.build(opts).to_s
end
```

`Rails.configuration.asset_host` is usually set if public assets are hosted on some CDN server. Otherwise the method falls back
to application's host configured in `default_url_options`.
