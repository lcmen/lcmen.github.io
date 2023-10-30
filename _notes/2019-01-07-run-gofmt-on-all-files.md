---
layout: default
title: "Run gofmt on all files"
description: "Format all go files recursively."
date: 2019-01-07
tags:
  - golang
---

To run go formatter recursively on all project’s files simply use:

```
gofmt -s -w .
```

To print the files that has been changed add -l option:

```
gofmt -l -s -w .
```

Useful options:

- `-d` display diffs instead of rewriting files
- `-l` list files where formatting differs from gofmt’s
- `-s` simplifies the code
- `-w` writes results back
