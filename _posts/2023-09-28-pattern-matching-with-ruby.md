---
layout: post
title: "Pattern matching with Ruby"
description: "Pattern matching introduced in Ruby 2.7, allows for matching values against patterns and deconstructing their constituent parts."
date: 2023-09-28
tags:
  - ruby
---

With version 2.7, Ruby introduced a new language construct to work with data structures called pattern matching.

Pattern matching is a concept borrowed from functional programming. It enables developers to match values based on their structure (shape) and extract their elements at the same time. This powerful addition to the Ruby toolkit opens up new avenues for expressing complex logic in a more natural and elegant way.

In this article we will dive in and unlock the power of pattern matching to make your code easier to understand and reason about.

Your codebase will thank you!

## Matching against array or hashes

In Ruby, pattern matching can be done using the `in` or `=>` (only available in Ruby >= 3) operators. For the time being, destructering hashes is limited to those indexed by symbols (strings are not supported).

Below are a couple of examples illustrating the power of this approach:

```ruby
# assuming api.get returns hashes like:
#   - { success: true|false, data: Object }
#   - { error: true, message: String }

case api.get('user', 1)
in { success: true, data: user }
  p user
in { success: false, message: error }
  p error
end
```

In this example, we use a `case` statement with the `in` operator to match different patterns within the returned hash from `api.get` method. Depending on the `success` field, we extract different values from the result.

If we only need to extract some value from the data (destructure), we can use `=>` operator to avoid lengthy `case` / `in` construction.

```ruby
result = { success: true }
result => { success: }
success # true
```

We can use both constructs to match against arrays as well:

```ruby
# assuming result is similar to Rack compatible response
# (e.g. `[200, { "Content-Type": "text/plain" }, ["Hello World"] ]`)

case result
in [200, _, body]
  p body
in [302, { Location: url }, _]
  p url
end
```

## Matching multiple patterns

You can also match against multiple patterns within a single block by using the `|` operator:

```ruby
# assuming api.get might return hashes in one of the following schemas:
#   - { success: true|false, data: Object }
#   - { error: true, message: String }
#   - { error: true, data: String }

case api.get('user', 1)
in { success: true, data: user }
  p user
in { success: false, data: error } | { error: true, message: error }
  p error
end
```

## Guards in pattern matching

Matchers can also include additional check that is verified after the value is matched:

```ruby
# assuming api.get might return hashes in one of the following schemas:
#   - { status: 200, data: Object }
#   - { status: 201, data: Object }
#   - { status: 403, error: String }

case api.get('user', 1)
in { status: status, data: user } if (200...400).include?(status)
  p user
in { error: error }
  p error
end
```

## Assigning matched values to variables

To assign the matched value from `case` / `in` construct to a variable (e.g. for further processing), combine it with the `=>` operator:

```ruby
case api.get('user', 1)
in { success: true|false, data: Object } => response
  p response[:data]
end
```

This allows you to work with the matched value conveniently by exposing the whole data under variable with the provided name (`response` in this case).

## Matching the same value across patterns

To match the same value across different points of comparison, ese the `^` (pin operator):

```ruby
case [api.count('user', 'active'), api.count('user', 'invited')]
in [number, ^number]
  puts "The same number of active users as invited"
else
  puts "Number are not the same"
end
```

Here, we ensure that the `number` in both positions of the array is the same.

## Ignoring values

Sometimes, you might want to ignore specific values. You can use the underscore (`_`) for this purpose:

```ruby
case api.get('user', 'active')
in [_, user]
  puts "A second active user is: #{user}"
end
```

## Matching against classes

In Ruby, pattern matching isn't limited to arrays and hashes. You can also utilize it with your own classes. To make a class available for pattern matching operators, you need to implement two methods:

- `deconstruct` for array-style matching
- `deconstruct_key` for hash-style matching

These methods allow you to specify how the class instance should be deconstructed when pattern matching is applied.

Here's an example of a class named `Response` that implements these methods to make it pattern-matchable:

```ruby
Response = Struct.new(:success, :result) do
  def deconstruct
    [success, result]
  end

  def deconstruct_key
    { success: success, result: result }
  end
end
```

In this `Response` class, we've defined the `deconstruct` method, which returns an array, and the `deconstruct_key` method, which returns a hash. These methods specify how an instance of the `Response` class should be deconstructed when pattern matched using array-style or hash-style patterns.

Let's try the pattern matching with instances of our `Response` class:

```ruby
response = Response.new(true, { id: 1, name: "Jon Snow" })

case response
in [true, user]
  p user
end

case response
in { success: true, result: user }
  p user
end
```

Pattern matching in Ruby is a powerful tool that simplifies data extraction and enhances code clarity. It's a valuable addition to your Ruby toolkit, enabling you to write cleaner, and more expressive code.
