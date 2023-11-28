---
layout: default
title: "Show Rake task details"
date: 2023-11-28
tags:
    - ruby
---

Rake, a Make-like program implemented in Ruby has an option to show details of a specific task.

Let's say we have a simple `Rakefile` with a following content:

```ruby
namespace :foo do
  desc "Simple foo:bar task that accepts 2 arguments to demonstrate rake -D option"
  task :bar, [:arg1, :arg2] => :environment do |_, args|
    puts "foo:bar"
  end
end
```

Executing `rake -D foo:bar` will show task description (including its arguments) in a user-friendly format:

```zsh
~/Repos > rake -D foo:bar
rake foo:bar[arg1,arg2]
    Simple foo:bar task that accepts 2 arguments to demonstrate rake -D option
```
