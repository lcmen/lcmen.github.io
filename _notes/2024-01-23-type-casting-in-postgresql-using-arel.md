---
layout: post
title: "Type casting in PostgreSQL using Arel"
description: "Learn how to use NamedFunction helper to convert between types in PostgreSQL"
date: 2024-01-23
tags:
    - ruby
    - rails
    - postgresql
---
`Arel` is a relational algebra library for Ruby, utilized under the hood by the [ActiveRecord](https://guides.rubyonrails.org/active_record_basics.html){:target="_blank"} library in the Ruby on Rails framework for generating SQL queries. It proves invaluable when constructing more advanced clauses without resorting to direct SQL.

The `NamedFunction` helper provided by Arel enables the invocation of built-in SQL functions. Recently, I found myself needing to use it to convert (cast) a model attribute to a different type for a specific query.

Below is an example of using `NamedFunction` with the `as` method to convert the `created_at` attribute into a `DATE` type for a direct comparison:

```ruby
created_at = User.arel_table[:created_at]
clause = Arel::Nodes::NamedFunction.new('CAST', [
  created_at.as(Arel::Nodes::SqlLiteral.new('DATE'))
])
User.where(clause.eq('2024-01-23'))
```
