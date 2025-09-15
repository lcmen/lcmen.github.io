---
layout: post
title: "3 most common PostgreSQL VACUUM parameters explained"
description: "Learn about the 3 most common PostgreSQL VACUUM parameters and how to use them effectively."
date: 2025-09-15
tags:
    - postgresql
---

Recently, I've been reading about PostgreSQL's autovacuum settings to optimize performance for tables that frequently change, such as cache tables (like Rails' cache store). I found these 3 parameters particularly useful:

- `autovacuum_vacuum_scale_factor` = 0.01
  - Triggers vacuum when 1% of table rows are dead/updated (default is 20%)
  - More aggressive vacuuming for frequently changing cache tables

- `autovacuum_vacuum_cost_delay` = 10
  - Pauses vacuum process for 10ms between spending some cost units (default is 2ms) for doing vacuum work
  - Slows down vacuum to reduce I/O impact on active queries (to prevent it from hogging system resources)
  - Higher value = longer pauses = slower vacuum but less impact on other queries

- `autovacuum_vacuum_cost_limit` = 200
  - Vacuum can consume 200 cost units (used for reading / writing pages, etc.) before pausing (default value is -1 which uses global `vacuum_cost_limit` setting)
  - Limits vacuum's resource consumption per cycle
  - When it reaches 200 cost points, it pauses (using the delay above)
  - Lower limit = more frequent pauses = gentler on system performance

Each option can be applied on a per-table basis using the `ALTER TABLE` command. For example, to set these options on a table named `solid_cache_entries`, you would run:

```sql
ALTER TABLE solid_cache_entries
SET (autovacuum_vacuum_scale_factor = 0.01,
     autovacuum_vacuum_cost_delay = 10,
     autovacuum_vacuum_cost_limit = 200);
```

To display the current autovacuum settings for a specific table, you can use the following SQL query:

```sql
SELECT relname, reloptions
FROM pg_class
WHERE relname = 'solid_cache_entries';
```

To display the global autovacuum settings, you can use:

```sql
SHOW autovacuum_vacuum_scale_factor;
SHOW autovacuum_vacuum_cost_delay;
SHOW autovacuum_vacuum_cost_limit;
SHOW vacuum_cost_limit;
```
