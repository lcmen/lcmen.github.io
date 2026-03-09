---
layout: post
title: "Primary key column in PostgreSQL"
description: "Explore PostgreSQL's auto-generated primary keys: serial vs identity through their differences and advantages"
date: 2024-02-11
tags:
    - postgresql
---

PostgreSQL database supports 2 types for auto-generated primary keys in tables:

- `serial` (supported in almost all PostgreSQL versions)
- `identity` (available from PostgreSQL 10+)

These types can be used as follows:

```sql
create table table1 (id serial primary key);
create table table2 (id integer primary key generated always as identity);
```

They provide the same functionality, but `identity` is more strict when it comes to creating new records. Consider the two following examples:

```sql
insert into table1 (id) values (1);
insert into table2 (id) values (1);
```

The former succeeds, while the latter raises the following error:

```
ERROR: cannot insert a non-DEFAULT value into column "id"
DETAIL: Column "id" is an identity column defined as GENERATED ALWAYS.
```

Even though the first statement succeeded, it will raise an error if we try to create a new record in `table1` without providing an id. This is caused by the internal counter being out of sync with the table data:

```sql
insert into table1 DEFAULT VALUES
```

```
ERROR: duplicate key value violates unique constraint "table1_pkey"
DETAIL: Key (id)=(1) already exists.
```

As we see, `serial` types can be tricked to cause troubles with new records. `identity` has one additional advantage: fewer permissions are required to create a new record - with `serial` type, a role needs `INSERT` privilege on the table and `USAGE` privilege on the sequence. With `identity`, just `INSERT` access is enough.
