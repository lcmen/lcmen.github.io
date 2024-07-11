---
layout: post
title: "Using no-new-privileges in Docker"
description: "Learn how to use the no-new-privileges security option in Docker to prevent containers from gaining additional privileges"
date: 2024-07-11
tags:
    - docker
---

The `no-new-privileges` security option in Docker prevents a container from gaining additional privileges after the initial execution.

This option is particularly useful in scenarios where you want to restrict the capabilities of a container to the bare minimum required for its operation.

Let's consider a simple example to understand how `no-new-privileges` works. Imagine you have a `Dockerfile` running the Ubuntu distribution with the following content:

```dockerfile
FROM ubuntu:22.04

RUN apt update && apt -y install sudo

RUN useradd -m docker && echo "docker:docker" | chpasswd && adduser docker sudo

USER docker
CMD /bin/bash
```

If you build this image then run  it, you'll notice that the container has the ability to execute commands with elevated privileges using `sudo`.

This might be especially problematic when container is running in privileged mode, as it can potentially escalate its privileges to the host system.

Let's run try to run the container with `no-new-privileges` enabled:

```bash
docker run -it --security-opt no-new-privileges myimage
```

and try to switch to the root user using `sudo su -`:

```
docker@a0f8de47d2f2:/$ sudo su -
sudo: The "no new privileges" flag is set, which prevents sudo from running as root.
sudo: If sudo is running in a container, you may need to adjust the container configuration to disable the flag.
```

you will see that the `no-new-privileges` option prevents the container from gaining additional privileges.

Next time you run your docker containers, consider using the `no-new-privileges` option to limit their privileges.
