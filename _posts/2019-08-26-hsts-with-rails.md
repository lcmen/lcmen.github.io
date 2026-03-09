---
layout: post
title: "HSTS with Rails"
description: "Enforce requests over HTTPS with Ruby on Rails"
date: 2019-08-26
tags:
  - ruby
  - rails
---

# HSTS with Rails

**TL;DR** HSTS tells browsers to always make requests over HTTPS to HSTS sites.

HSTS (HTTP Strict Transport Security) is a mechanism for preventing man-in-the-middle attack known as SSL Stripping. Such attack relies on hijacking browser connection to use `http` instead of `https` for communication with the server. Using `Strict-Transport-Security` header we can declare that browser should communicate with `https` only and specify a period of time for such behavior.

Example of attack from [MDN docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security):

> You log into a free WiFi access point at an airport and start surfing the web, visiting your online banking service to check your balance and pay a couple of bills. Unfortunately, the access point you're using is actually a hacker's laptop, and they're intercepting your original HTTP request and redirecting you to a clone of your bank's site instead of the real thing. Now your private data is exposed to the hacker.
>
> Strict Transport Security resolves this problem; as long as you've accessed your bank's web site once using HTTPS, and the bank's web site uses Strict Transport Security, your browser will know to automatically use only HTTPS, which prevents hackers from performing this sort of man-in-the-middle attack.

HSTS can be enabled by switching `force_ssl` option in the application's config:

```ruby
# config/environment/production.rb

Rails.application.configure do
  ...

  config.force_ssl = true

  ...
end
```

Setting `force_ssl` to `true`, inserts
[ActionDispatch::SSL](https://api.rubyonrails.org/classes/ActionDispatch/SSL.html) middleware which is responsible for 3 things:

1. Redirecting `http` requests to `https`
2. Adding `HSTS` header to the response
3. Set `secure` flag on cookies to send them through `https` only
