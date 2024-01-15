---
layout: post
title: "Rails cache - key versioning"
description: "Explore the power of cache key versioning in Ruby on Rails to reducing data size in cache store."
date: 2023-12-20
tags:
  - ruby
  - ruby on rails
---

Caching stands as one of the most effective ways to enhance the performance of web applications. The general idea is simple: it relies on storing the result of expensive computation in some data storage system so that it can be reused without recomputing.

Ruby on Rails provides a robust system to implement efficient caching strategies in web applications. The framework includes methods designed for different use cases, ranging from ETags and freshness checks in controllers to the expressive <% cache %> block in views and a low-level caching API via Rails.cache.fetch.

Let's delve into some examples:

```ruby
# Inside controllers
etag { user }
fresh_when(user)
stale?(users)
```

```erb
# Inside views
<% cache user do %>
  <%= render user %>
<% end %>
```

```ruby
# In your application code
Rails.cache.fetch(user) { user.to_json }
```

In this article, we will explore the cache key versioning feature in Ruby on Rails that unlocks the potential for even finer optimization of caching behaviors.

## Key versioning

All the little caching helpers presented above rely on [ActiveRecord::Base.cache_key](https://api.rubyonrails.org/classes/ActiveRecord/Integration.html#method-i-cache_key) and [ActiveRecord::Base.cache_version](https://api.rubyonrails.org/classes/ActiveRecord/Integration.html#method-i-cache_version) methods:

```ruby
>> User.first.cache_key
=> "users/1"
>> User.first.cache_version
=> "20231219180601995645"
>> User.order(:id).limit(10).cache_key
=> "users/query-68c0401234edb150f9926a6bed0ca8a1"
>> User.order(:id).limit(10).cache_version
=> "10-20231205124058460998"
```

In the above example, note that the version of model, which defaults to the last time they were updated, does not affect the `cache_key` result:

1. The `cache_key` for an ActiveRecord model follows the `{model_name}/{id}` format.
2. The `cache_key` for a query is a digest of the SQL code generated by `ActiveRecord::Relation#to_sql` used to fetch the collection from the database.

```ruby
>> User.first.touch
>> User.first.cache_key
=> "users/1"
>> User.first.cache_version
=>  "20231219181041677933"
>> User.order(:id).limit(10).cache_key
=> "users/query-68c0401234edb150f9926a6bed0ca8a1"
>> User.order(:id).limit(10).cache_version
=> "10-20231219181041677933"
```

This behavior allows for key reuse and is controlled by the `config.active_record.cache_versioning` and `config.active_record.collection_cache_versioning` options (both default to true for Rails >= 6.0).

Cache versioning setting can be customized on the individual model as well:

```ruby
class User < ApplicationRecord
  self.cache_versioning = false            # For single records
  self.collection_cache_versioning = false # For relations
end
```

```ruby
>> User.first.cache_key
=> "users/1-20231219181255807906"
>> User.first.cache_version
=> nil
>> User.order(:id).limit(10).cache_key
=> "users/query-e5105e60511ed720db628c11bb103c62-10-20231219181255807906"
>> User.order(:id).limit(10).cache_version
=> nil
```

## Why is it useful?

It all looks interesting. We have the option to configure the cache key, but one might still ask what benefits key reuse provides. And it's indeed a valid question!

Prior to Rails 6, where the cache versioning feature was not available, every time an updated object was passed to the `fetch` method, another entry was written to the cache while the previous one (stale) was kept around until it was manually removed or the expiry time reached.

With cache versioning disabled, the following code will keep three cache entries for the same object in a cache store:

*The examples above assume Redis is used as a cache store*

```ruby
# Rails.fetch(user.cache_key) is equivalent of Rails.fetch(user) with cache versioning disabled
Rails.fetch(user.cache_key) do
  user.to_json
end
user.touch
Rails.fetch(user.cache_key) do
  user.to_json # new entry is written to cache store
end
user.touch
Rails.fetch(user.cache_key) do
  user.to_json # new entry is written to cache store
end

# Check the count of keys in Redis with the pattern 'users*'
Rails.cache.redis.then { |c| c.keys('users*') }.size # 3
```

With cache versioning enabled, the new version will replace the existing entry in the cache store, leading to a smaller data size in the store:

```ruby
# Rails.fetch(user.cache_key, version: user.cache_version) is equivalent of Rails.fetch(user) with cache versioning enabled
Rails.fetch(user.cache_key, version: user.cache_version) do
  user.to_json
end
user.touch
Rails.fetch(user.cache_key, version: user.cache_version) do
  user.to_json # existing entry is updated in cache store
end
user.touch
Rails.fetch(user.cache_key, version: user.cache_version) do
  user.to_json # existing entry is updated cache store
end

# Check the count of keys in Redis with the pattern 'users*'
Rails.cache.redis.then { |c| c.keys('users*') }.size # 1
```

### In Conclusion

Ruby on Rails continually seeks ways to improve its performance to build better web applications. As demonstrated in the examples above, Rails 6 introduced a refined caching process that significantly reduces data size and eliminates stale entries from the cache store.

With the ability to control when cache entries are updated, cache key versioning becomes a tweak to help scale applications. Whether managing individual records or collections, this nuanced approach provides developers with more granular control.