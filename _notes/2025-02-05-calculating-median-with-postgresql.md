---
layout: post
title: "Calculating median with PostgreSQL"
description: "Learn how to calculate the median in PostgreSQL using percentile_cont() and percentile_disc() functions"
date: 2025-02-05
tags:
    - postgresql
---

PostgreSQL provides two functions to calculate percentiles for a list of values at any percentage: `percentile_cont()` and `percentile_disc().` With the correct argument, both functions can be used to compute the median.

- The `percentile_disc()` function returns the closest value from the input set that corresponds to the requested percentile. The result is always a value that exists in the set.
- The `percentile_cont()` function returns an interpolated value based on the distribution of the dataset. It provides a more precise result, but the returned value may be a fractional number that does not directly exist in the input set.

Both functions can be used as shown in the following snippet:

```sql
SELECT
  percentile_disc(0.5) WITHIN GROUP (ORDER BY temperature)
FROM city_data;
```

Here, `0.5` represents the 50th percentile, which corresponds to the median. The `WITHIN GROUP` clause specifies the order of values before computing the percentile.
