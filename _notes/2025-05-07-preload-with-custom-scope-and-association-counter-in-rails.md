---
layout: post
title: "Preloading data with custom scopes and counting association records in Rails"
description: "Learn how to preload data with custom scopes and count association records in Ruby on Rails."
date: 2025-05-07
tags:
    - rails
    - postgresql
---

Recently, I needed to load records with a counter on one of the associations and preload some others.

Think about Teams, where you need to count all members and preload just the recent ones to show them on the page with their avatars.

In this short note, I will show you how to approach it step by step.

Before we dive into the solution, let’s highlight the models and their associations:

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

## Step 1: Count team members

To count the number of associated records in Ruby on Rails, we can use joins and then group the records by the main model, followed by applying count on the association.

```ruby
teams = Team
  .joins(:memberships)
  .select('teams.*, COUNT(memberships.id) AS memberships_count')
  .group('teams.id')
```

To make it easier to use, we define a scope in the `Team` model:

```ruby
def self.with_memberships_count
  joins(:memberships)
    .group('teams.id')
    .select('teams.*, COUNT(memberships.id) AS memberships_count')
end
```

## Step 2: Define the most recent members

Next, we need to define the association for the most recent members. We can do this by using a virtual has_many association (this is not a real association but more like a read-only association that retrieves a subset of records from the parent association):

```ruby
has_many :memberships
has_many :recent_memberships, -> { recent(5) }, class_name: 'Membership', inverse_of: :team, dependent: nil
```

By having this as an association instead of regular methods, we can easily preload these recent memberships when we load the teams:

```ruby
teams = Team.preload(recent_memberships: :user)
```

## Step 3: Load the most recent memberships

This is a bit tricky as we need to define a scope that will load the last n memberships for each team. Assuming we are using PostgreSQL, we can use two approaches:

1. Using a lateral join (*personally less readable to me*)
2. Using window ranking functions with partition over.

### Using Lateral Join

```ruby
def self.recent(limit: 5)
  recent_memberships = Team
    .joins(Team.sanitize_sql_array([<<~SQL.squish, { limit: }]))
      JOIN LATERAL (
        SELECT * FROM memberships
        WHERE team_id = teams.id
        ORDER BY created_at ASC LIMIT :limit
      ) AS selected_memberships ON TRUE
    SQL
    .select('selected_memberships.*')

  from(recent_memberships, 'memberships')
end
```

Here we’re joining memberships with teams (by using a lateral join, each team is joined with subquery results to load :limit recent memberships).

### Using Window Ranking Functions

```ruby
ranked_memberships = select('memberships.*, dense_rank() OVER (PARTITION BY team_id ORDER BY created_at DESC) AS rank')
  .from(ranked_memberships, 'memberships').where(rank: ..limit)
```

Here we are “splitting” memberships by `team_id`, and within each group, we rank them based on the condition (`ORDER BY created_at DESC`). Then we specify a condition for ranking (basically our `limit` argument).

## Step 4: Preload avatars for the users

Assuming that the User model has an avatar association via has_one_attached, we can define a scope to preload the avatars:

```ruby
scope :with_avatars, -> { includes(avatar_attachment: { blob: { variant_records: { image_attachment: :blob } } }) }
```

## Step 5: Combine everything together

Now we can combine everything together and take advantage of the ActiveRecord::Associations::Preloader to specify additional scopes for the preloaded associations:

```ruby
scope = Team.with_memberships_count
ActiveRecord::Associations::Preloader
  .new(records: scope, associations: :recent_memberships, scope: Membership.merge(User.with_avatars))
  .call
```
