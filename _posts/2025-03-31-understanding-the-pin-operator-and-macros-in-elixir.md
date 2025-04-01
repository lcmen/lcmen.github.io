---
layout: post
title: "Understanding the Pin Operator and Macros in Elixir"
description: "Understanding the Pin Operator and Macros in Elixir by building custom DSL"
date: 2025-03-31
tags:
  - Elixir
---

Recently, while reading the Ash Framework book, I stumbled upon the pin (`^`) operator within the `expr` macro. While I was familiar with using the pin operator in Elixir for pattern matching to match against a specific value (rather than rebinding to a variable), I wasn't aware of its use in macros. As I dove deeper into this area, I discovered that the pin operator is just a convention for macros, not a specific language feature.

In this post, I'll share my journey to understand how these concepts work together, starting with simple examples and moving to more complex ones.

## The Pin Operator: Beyond Pattern Matching

Most Elixir developers are familiar with the pin operator in pattern matching:

```elixir
x = 42
^x = 42  # This matches because x is pinned to 42
^x = 43  # This fails because x is pinned to 42
```

In metaprogramming and DSLs, it has become a widely adopted convention to indicate that a value should be evaluated rather than treated as a symbol or variable name. This convention is used in many popular libraries like Ash Framework and Ecto.

## Understanding quote and unquote

Before we dive into examples, let's explore two fundamental concepts in Elixir metaprogramming: `quote` and `unquote`. These fundamental building blocks enable the creation of macros and DSLs.

### What is quote?

In Elixir, code is represented internally as an Abstract Syntax Tree (AST). `quote` is a macro that takes Elixir code and returns its AST representation. Think of it as a way to translate our code into a data structure that we can further manipulate.

```elixir
iex> quote do: 1 + 2
{:+, [context: Elixir, imports: [{1, Kernel}, {2, Kernel}]], [1, 2]}

iex> quote do: "hello"
"hello"

iex> quote do: x = 42
{:=, [], [{:x, [], Elixir}, 42]}
```

This AST structure consists of:

- The operation (like `:+`, `:=`)
- Metadata (like context and imports)
- Arguments (the values being operated on)

### What is unquote?

While `quote` lets us convert our code to AST, `unquote` allows us to inject values into quoted expressions.

```elixir
iex> x = 42
iex> quote do: 1 + unquote(x)
{:+, [context: Elixir, imports: [{1, Kernel}, {2, Kernel}]], [1, 42]}
```

Without `unquote`, we'd get:

```elixir
iex> quote do: 1 + x
{:+, [context: Elixir, imports: [{1, Kernel}, {2, Kernel}]], [1, {:x, [], Elixir}]}
```

The difference is crucial:

- With `unquote`, we get the actual value (42)
- Without `unquote`, we get the variable name as an AST node

We can verify our assumptions in the `iex` console:

```elixir
iex> x = 42
iex> ast1 = quote do: 1 + unquote(x)
iex> ast2 = quote do: 1 + x
iex> Code.eval_quoted(ast1)
{43, []}
iex> Code.eval_quoted(ast2)
error: undefined variable "x" (context Elixir)
└─ nofile:1

** (CompileError) cannot compile code (errors have been logged)
```

We received an error because `x` is not defined within `quote`.

### How do they work in tandem?

A crucial thing to understand is that **macros return AST**. This is why we need `quote` - it generates the AST that the macro will return. Without `quote`, we would be trying to execute the code directly (e.g., defining a function in the macro itself) instead of returning its AST representation.

It tells Elixir "this is the code I want you to generate" rather than "this is the code I want you to execute now." They are helpful when we want to run Elixir functions on existing AST - we use `unquote` to inject AST structures as arguments into functions and then `quote` it to return a new AST.

```elixir
defmodule Example do
  defmacro create_function(name, value) do
    quote do
      def unquote(name)() do
        2 * unquote(value)
      end
    end
  end
end

defmodule Test do
  import Example

  create_function(:answer, 42)
end

iex> Test.answer()
84
```

In this example:

1. `quote` captures the function definition as AST that will be returned from the macro
2. `unquote` injects name and value into the function definition
3. The function gets defined through the macro

## A Simple Example: Building a Basic Expression DSL

Let's start with a simple example that demonstrates how the pin operator can be used to create a basic expression DSL:

```elixir
defmodule SimpleDSL do
  defmacro expr(expression) do
    case expression do
      {:^, _, [value]} ->
        quote do
          value = unquote(value)
          "literal(#{value})"
        end

      other ->
        other
    end
  end
end

defmodule Example do
  import SimpleDSL

  def demo(x) do
    IO.inspect(expr(^x))
    IO.inspect(expr(x))
  end
end

iex> Example.demo(42)
"literal(42)"
42
```

In this example:

1. We create a macro that pattern matches against AST
2. For the pin operator node, the value is injected into the `literal` function call
3. For other AST node types, we simply keep them unchanged
4. We call the macro with both pinned and non-pinned variables

## A More Complex Example

Now, let's try a more complex example that demonstrates generating some dynamic expression:

```elixir
defmodule AdvancedDSL do
  defmacro expr(expression) do
    IO.inspect(expression)

    expression
    |> expand()
    |> build()
  end

  # First phase - expand AST
  defp expand(ast) do
    case ast do
      {:^, _, [value]} ->
        {:inject, value}
      {name, _, nil} when is_atom(name) ->
        {:symbol, name}

      {name, meta, args} when is_list(args) ->
        {name, meta, Enum.map(args, &expand/1)}

      other ->
        other
    end
  end

  # Second phase: Build SQL string from intermediate representation
  def build({:+, _, [left, right]}) do
    left_sql = build(left)
    right_sql = build(right)

    # We need to quote as we want to inject left and right operands into concatenation operation
    quote do
      unquote(left_sql) <> "_" <> unquote(right_sql)
    end
  end

  # We use `quote` to inject pinned values into `to_string` method and return new AST
  def build({:inject, value}) do
    quote do
      to_string(unquote(value))
    end
  end

  def build({:symbol, name}) do
    quote do
      to_string(unquote(name))
    end
  end
end

defmodule Example do
  import AdvancedDSL

  def generate(points) do
    expr(prefix + ^points)
  end
end

iex> Example.generate(5)
"prefix_5"
```

Let's break down what happens when we use our DSL:

1. When we write `expr(score + ^points)`, the macro receives the AST:

```elixir
{:+, [], [{:prefix, [], nil}, {:^, [], [{:points, [], nil}]}]}
```

2. `expand/1` processes the AST:

   - It finds the pin operator
   - Converts the pinned value into a custom `inject` tuple
   - Converts atom value into custom `symbol` tuple
   - Preserves the structure of the expression

3. `build/1` converts the processed AST into string:
   - Converts inject to strings
   - Converts symbol to strings
   - Handles concatenation

## Conclusion

The pin operator and macros are powerful tools for creating custom DSLs in Elixir. While they might seem complex at first, understanding how they work together opens up possibilities for creating expressive and powerful abstractions. These techniques can be applied in real-world projects to create elegant and maintainable domain-specific languages.

I hope that through the examples we've explored, we can see how these concepts combine to create elegant and maintainable domain-specific languages.
