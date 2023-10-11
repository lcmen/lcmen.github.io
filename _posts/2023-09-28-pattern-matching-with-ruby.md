---
layout: post
title: "Pattern matching with Ruby"
date: 2023-09-28
tags:
  - ruby
---

Ruby 2.7 introduced a pattern matching feature. It allows to match a value based on its structure with the ability to destructure the values.

## Matching against array or hashes
Pattern matching in Ruby is done via:

- one line with in / => operator (still experimental in Ruby 3.0):

      result = { success: true }
      result => { success: }
      success # true

- case statement with in operator:

      # assuming api.get returns hashes like:
      #   - { success: true|false, data: Object }
      #   - { error: true, message: String }
      case api.get('user', 1)
      in { success: true, data: user }
      p user
      in { success: false, data: error }
      p error
      end

To match multiple patterns within one block, use `|`:

```ruby
case api.get('user', 1)
in { success: true, data: user }
  p user
in { success: false, data: error } | { error: true, message: error }
  p error
end
```

To assign matched value to a variable, use `=>`:

```ruby
case api.get('user', 1)
in { success: true|false, data: Object } => response
  p response[:data]
end
```

To match the same value across pattern, use `^` (pin operator):

```ruby
case [api.count('user', 'active'), api.count('user', 'invited')]
in [number, ^number]
  puts "The same number of active users as invited"
else
  puts "Number are not the same"
end
```

To ignore value, use `_`:

```ruby
case api.get('user', 'active')
in [_, user]
  puts "A second active user is: #{user}"
end
```

## Matching against classes
To make class available for pattern matching, it needs to implement 2 methods:

- `deconstruct` (for array match)
- `deconstruct_key` (for hash match)

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

Test it:

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
