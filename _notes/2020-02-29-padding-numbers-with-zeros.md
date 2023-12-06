---
layout: default
title: Padding numbers with zeros in Ruby
date: 2020-02-29
tags:
    - ruby
---

[String#%](https://ruby-doc.org/3.2.2/String.html#method-i-25) method allows to specify format to apply to its argument. It can be used to pad numbers with zeros.

### Leading zeros

```
> "%03d" % 2
=> "002"
```

### Trailing zeros

```
> "%.2f" % 2
=> "2.00"
```
