---
layout: post
title: "Find process listening on a port"
description: "Find the process in the operating system that is listening on a particular port."
date: 2023-12-21
tags:
    - linux
---

`lsof` (list open files) command, available in most Unix-like operating systems, reports a list of all open files and the processes that opened them.

Since "everything is a file" (including network sockets) in Unix-like systems, `lsof` can find which process is listening on a particular port.

## Example

```shell
lsof -i :80
```

`-i` option tells `lsof` to list processes associated with Internet addresses, including network sockets.
