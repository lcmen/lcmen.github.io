---
layout: post
title: "Sending HTTP requests with telnet"
description: "Learn how to send HTTP and HTTPS requests using Telnet and netcat."
date: 2024-04-06
tags:
    - unix
---

Telnet is a protocol for accessing a virtual terminal in a client/server model. It can be considered as an early predecessor to SSH, lacking encryption and operating over the `TCP` protocol.

Since Telnet operates on top of the `TCP` protocol, it can be utilized for sending requests on various ports.

We can emulate an HTTP request with Telnet by following these steps:

- Open a socket connection:

    ```
    telnet news.ycombinator.com 80
    ```

- Create and send the HTTP request:

    ```
    GET /newest HTTP/1.0
    Host: news.ycombinator.com
    ```

Upon execution in the terminal, it will redirect to [https://news.ycombinator.com](https://news.ycombinator.com):

```
HTTP/1.1 301 Moved Permanently
Server: nginx
Date: Sun, 07 Apr 2024 18:36:45 GMT
Content-Type: text/html
Content-Length: 162
Connection: close
Location: https://news.ycombinator.com/newest
```

Sending an HTTPS request with Telnet becomes more complex due to the need for encryption, which Telnet does not support. However, we can switch to netcat (nc), where available, to establish an SSL connection to the server (on macOS, this might require using ncat from nmap, which can be installed with brew install nmap).

To send an HTTPS request using netcat, follow these steps:

- Open a socket connection with SSL encryption:

    ```
    nc --ssl news.ycombinator.com 443
    ```

- Build and send the HTTP request:

    ```
    GET /newest HTTP/1.0
    Host: news.ycombinator.com
    ```

This will retrieve the list of all recent stories from the server using HTTPS protocol.
