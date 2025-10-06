---
layout: post
title: "Recreating database with Rails 8"
description: "How to recreate your database in Rails 8 with the updated `rails db:migrate` command"
date: 2025-10-06
tags:
    - rails
---

Rails 8 has updated the `rails db:migrate` command so it loads `schema.rb` or `structure.sql` before running migrations. This change was made because loading the schema tends to be faster and is potentially less error prone than running all migrations from scratch - old migrations may fail to apply correctly if they use external dependencies or application code that has since changed.

That means if you want to recreate your database from scratch by calling `db:drop db:create db:migrate`, it will now load the schema first and then run all migrations on top of it, which means the migrations will have no effect since the database structure is already in place.

To preserve the `db:migrate` behavior from previous versions, and not load the schema first, you can now use the new `db:migrate:reset` command. The whole command to recreate your database from scratch is now:

```bash
rails db:drop db:create db:migrate:reset
```
