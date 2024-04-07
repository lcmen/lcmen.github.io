---
layout: post
title: ".PHONY in Makefile"
description: "Understand how .PHONY directives ensure that commands execute even when corresponding files or directories exist"
date: 2024-04-07
tags:
    - unix
---

A Makefile serves as a file-based build system by default. Within a Makefile, each target specifies the command responsible for generating an artifact (file/directory) in the system as an output.

However, sometimes a command doesn't produce a file or directory as a result of its execution. Consider the following example Makefile:

```makefile
image:
    docker build -t myimage image/Dockerfile
```

When attempting to build this image using the make image command, it might seemingly skip the build process, displaying the message:

```
make: `image' is up to date.
```

This behavior occurs because the image directory (the target of our make) already exists.

To address this issue, the .PHONY directive comes into play. By listing image under the .PHONY directive, we instruct make to treat image as a phony target. This means that make will execute the image command regardless of whether the image file or directory exists:

```makefile
.PHONY: image
image:
    docker build -t myimage image/Dockerfile
```

With this declaration, make will always execute the docker build command when make image is invoked, ensuring that the image is rebuilt even if the directory exists.
