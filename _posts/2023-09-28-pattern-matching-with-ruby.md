---
layout: post
title: "Pattern matching with Ruby"
date: 2023-09-28
tags:
  - ruby
---

With version 2.7, Ruby introduced a pattern matching, the feature that simplifies matching and destructuring data to make the code more concise, readable, and robust.

Pattern matching, a concept borrowed from functional programming languages, enables developers to match values based on their structure and extract elements with ease. This powerful addition to the Ruby toolkit opens up new avenues for expressing complex logic in a more natural and elegant way. Whether you're a seasoned Ruby developer or just getting started, understanding and mastering pattern matching is essential for writing clean, maintainable, and efficient code.
So, whether you're looking to level up your Ruby skills or just curious about what pattern matching has to offer, let's dive in and unlock the power of pattern matching in Ruby 2.7.

Your code will thank you!

## Matching against array or hashes

In Ruby, pattern matching can be done using the `in` or `=>` (only available in Ruby >= 3) operators. Below are a couple of examples illustrating the power of this approach:

### Matching with `case` and `in`

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

In this example, we use a `case` statement with the `in` operator to match different patterns within the returned hash from `api.get` method. Depending on the `success` field, we can extract different values.

### Matching with `=>` (available only in Ruby 3.0 and above):

```ruby
result = { success: true }
result => { success: }
success # true
```

In this example, we create a hash called `result` and use the `=>` operator to match it against the hash with `success` key, and extracting value under that key.

## Matching multiple patterns

You can match against multiple patterns within a single block by using the `|` operator:

```ruby
# assuming api.get might return hashes in one of the following schemas:
#   - { success: true|false, data: Object }
#   - { error: true, message: String }
#   - { error: true, data: string }

case api.get('user', 1)
in { success: true, data: user }
  p user
in { success: false, data: error } | { error: true, message: error }
  p error
end
```

## Assigning matched values to variables

To assign the matched value from `case` / `in` construct to a variable, you can use the `=>` operator:

```ruby
case api.get('user', 1)
in { success: true|false, data: Object } => response
  p response[:data]
end
```

This allows you to work with the matched value conveniently by exposing it under variable with the specified name (`response` in this case).

## Matching the same value across patterns

Use the `^` (pin operator) to match the same value across different fields:

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

In Ruby, pattern matching isn't limited to arrays and hashes. You can also utilize it with custom classes. To make a class available for pattern matching operators, you need to implement two methods:

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
