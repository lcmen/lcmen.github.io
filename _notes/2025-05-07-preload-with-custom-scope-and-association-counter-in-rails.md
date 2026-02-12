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

By having this as an association instead of regular methods, we will be able to easily preload these recent memberships when we load the teams:

```ruby
teams = Team.preload(recent_memberships: :user)
```

It's not going to work yet!

## Step 3: Load the most recent memberships

This is a bit tricky as we need to define a scope on the `Membership` model that will load the last n memberships for each team. Assuming we are using PostgreSQL, we can use two approaches:

1. Using a lateral join (*personally less readable to me*)
2. Using window ranking functions with partition over.

Both approaches use the `from()` method to wrap their queries. The `from(query, 'table_name')` method takes a relation as the first argument and a name as the second. It creates a subquery from the relation and aliases it with the given name. The second argument must match the model's table name because ActiveRecord generates `SELECT "table_name".*` based on the model - if the alias doesn't match, SQL will fail to find the table in the FROM clause.

### Using Lateral Join

```ruby
class Membership < ApplicationRecord
  def self.recent(limit)
    recent_memberships = Team
      .joins(Team.sanitize_sql_array([<<~SQL.squish, { limit: }]))
        JOIN LATERAL (
          SELECT * FROM memberships
          WHERE team_id = teams.id
          ORDER BY created_at DESC LIMIT :limit
        ) AS selected_memberships ON TRUE
      SQL
      .select('selected_memberships.*')

    from(recent_memberships, 'memberships')
  end
end
```

Here we're joining teams with a lateral subquery that selects the most recent memberships per team. The `select('selected_memberships.*')` explicitly picks columns from the lateral join result. Then `from(..., 'memberships')` wraps everything as a subquery aliased as `memberships` - this allows AR to generate `SELECT "memberships".* FROM (...) AS memberships` and properly instantiate `Membership` objects.

### Using Window Ranking Functions

```ruby
class Membership < ApplicationRecord
  def self.recent(limit)
    ranked = select('memberships.*, DENSE_RANK() OVER (PARTITION BY team_id ORDER BY created_at DESC) AS rank')
    from(ranked, 'memberships').where('rank <= :limit', limit:)
  end
end
```

Here we are "splitting" memberships by `team_id`, and within each group, we rank them based on the condition (`ORDER BY created_at DESC`). The `from()` is needed because SQL evaluates `WHERE` before `SELECT`, so the computed `rank` column isn't available to filter on directly. By wrapping the query with `from()`, `rank` becomes a real column in the derived table that we can filter on.

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

Here is the single-file Rails app that you can use to play in your terminal:

```ruby
require "bundler/inline"

gemfile(true) do
  source "https://rubygems.org"

  gem "rails", "~> 8.0"
  gem "sqlite3"
end

require "rails"
require "active_record/railtie"
require "active_storage/engine"

class App < Rails::Application
  config.root = __dir__
  config.eager_load = false
  config.secret_key_base = "secret_key_base_for_demo_#{SecureRandom.hex(32)}"
  config.logger = Logger.new($stdout)
  config.log_level = :debug
  config.active_storage.service = :local
  config.active_storage.service_configurations = { local: { service: "Disk", root: Dir.tmpdir } }
  config.active_storage.variant_processor = :disabled
end

ENV["DATABASE_URL"] = "sqlite3::memory:"
Rails.application.initialize!

ActiveRecord::Schema.define do
  create_table :active_storage_blobs do |t|
    t.string :key, null: false
    t.string :filename, null: false
    t.string :content_type
    t.text :metadata
    t.string :service_name, null: false
    t.bigint :byte_size, null: false
    t.string :checksum
    t.datetime :created_at, null: false
    t.index [:key], unique: true
  end

  create_table :active_storage_attachments do |t|
    t.string :name, null: false
    t.references :record, null: false, polymorphic: true, index: false
    t.references :blob, null: false
    t.datetime :created_at, null: false
    t.index [:record_type, :record_id, :name, :blob_id], name: "index_active_storage_attachments_uniqueness", unique: true
    t.foreign_key :active_storage_blobs, column: :blob_id
  end

  create_table :active_storage_variant_records do |t|
    t.belongs_to :blob, null: false, index: false
    t.string :variation_digest, null: false
    t.index [:blob_id, :variation_digest], name: "index_active_storage_variant_records_uniqueness", unique: true
    t.foreign_key :active_storage_blobs, column: :blob_id
  end

  create_table :users do |t|
    t.timestamps
  end

  create_table :teams do |t|
    t.timestamps
  end

  create_table :memberships do |t|
    t.references :team
    t.references :user
    t.timestamps
  end
end


class ApplicationRecord < ActiveRecord::Base
  self.abstract_class = true
end

class Team < ApplicationRecord
  has_many :memberships
  has_many :recent_memberships, -> { recent(2) }, class_name: 'Membership', inverse_of: :team, dependent: nil
  has_many :users, through: :memberships

  def self.with_memberships_count
    joins(:memberships)
      .group('teams.id')
      .select('teams.*, COUNT(memberships.id) AS memberships_count')
  end
end

class Membership < ApplicationRecord
  belongs_to :team
  belongs_to :user

  def self.recent(limit)
    ranked = select('memberships.*, DENSE_RANK() OVER (PARTITION BY team_id ORDER BY created_at DESC) AS rank')
    from(ranked, 'memberships').where('rank <= :limit', limit:)
  end
end

class User < ApplicationRecord
  has_many :memberships
  has_many :teams, through: :memberships
  has_one_attached :avatar

  scope :with_avatars, -> { includes(avatar_attachment: { blob: { variant_records: { image_attachment: :blob } } }) }
end

t1 = Team.create
t2 = Team.create
u1 = User.create
u2 = User.create
u3 = User.create
u4 = User.create
u5 = User.create

t1.users << u1
t1.users << u2
t1.users << u3
t2.users << u3
t2.users << u4
t2.users << u5

scope = Team.with_memberships_count
ActiveRecord::Associations::Preloader
  .new(records: scope, associations: :recent_memberships, scope: Membership.merge(User.with_avatars))
  .call

binding.irb
```
