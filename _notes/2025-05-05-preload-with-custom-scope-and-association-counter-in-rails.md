---
layout: post
title: "Preload Data with custom scope and association counter in Rails"
description: "Learn how to preload data with custom scope and association counter in Rails."
date: 2025-05-05
tags:
    - rails
    - postgresql
---

Recently, I needed to load records with a counter on related records and preload some other associations.

Think about Teams, where you need to count the number of memberships and preload the latest five members to show them on the page with their avatars.

In this short note, I will show you how to do it step by step.

Before we dive into the solution, let's summarize the models and their associations:

```ruby
class Team < ApplicationRecord
  has_many :memberships
  has_many :users, through: :memberships
end

class Membership < ApplicationRecord
  belongs_to :team
  belongs_to :user
end

class User < ApplicationRecord
  has_many :memberships
  has_many :teams, through: :memberships
  has_one_attached :avatar
end
```

# Step 1: Include the number of memberships

To count the number of associated records in Ruby on Rails we can use `joins` and then `group` the records by the main
model then use `count` on the association.

```ruby
teams = Team
  .joins(:memberships)
  .select('teams.*, COUNT(memberships.id) AS memberships_count')
  .group('teams.id')
```

To make it easier to use we can define a scope in the `Team` model:

```ruby
def self.with_memberships_count
  joins(:memberships)
    .select('teams.*, COUNT(memberships.id) AS memberships_count')
    .group('teams.id')
end
```

# Step 2: Define the association for the most recent members

Next, we need to define the association for the most recent members. We can do this by using a virtual `has_many` association:

```ruby
has_many :memberships
has_many :recent_memberships, -> { order(created_at: :desc).limit(5) }, class_name: 'Membership'
```

By defining this association, we can easily preload these recent memberships when we load the teams:

```ruby
teams = Team.preload(recent_memberships: :user)
```

# Step 3: Define scope to preload avatars for the users

Assuming that the `User` model has an `avatar` association via `has_one_attached`, we can define a scope to preload the
avatars:

```ruby
scope :with_avatars, -> { includes(avatar_attachment: { blob: { variant_records: { image_attachment: :blob } } }) }
```

# Step 4: Combine everything together

Now we can combine everything together and take the advantage of the `ActiveRecord::Associations::Preloader` to specify additional scopes for the preloaded associations:

```ruby
scope = Team.with_memberships_count
ActiveRecord::Associations::Preloader
  .new(records: scope, associations: :recent_memberships, scope: Membership.merge(User.with_avatars))
  .call
```
