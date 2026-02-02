---
layout: post
title: "Introduction to fibers"
description: "Learn how Ruby Fibers enable efficient concurrent I/O without the overhead of threads or complexity of mutexes."
date: 2026-02-02
tags:
  - Ruby
---

For a long period of time, concurrency in Ruby was purely based on threads. While Fibers have existed since Ruby 1.9, Ruby 3.0 introduced a powerful Fiber Scheduler interface that unlocks their full potential for concurrent I/O. Yes, I'm aware we are on Ruby 4 now but not everyone has had a chance to understand the benefits of Fibers.

This post is an introduction to fibers and their advantages over thread-based concurrency. However, before we dive into the differences, let's understand why we need concurrency in the first place.

# The Problem: I/O is slow and blocking by default

When your program reads from a network socket, the data might not be there yet. It's traveling across the internet. Your CPU could execute millions of instructions in the time it takes for one network response.

```ruby
# CPU just waits here doing nothing for maybe 50 milliseconds, that's ~100 million CPU cycles wasted
data = socket.read
```

By default, when you call `socket.read` it blocks your program until data arrives:

```ruby
data1 = socket1.read  # wait 50ms
data2 = socket2.read  # wait 50ms
data3 = socket3.read  # wait 50ms
# Total: 150ms
```

Even if all three servers send data at the same time, we still process them one by one.

## Non-blocking I/O alternative

The more optimal approach would be to start all three requests, and wait for any of them to be ready and process it. In this case, the total time would be more or less the time of the longest request (~50ms in this case).

You basically want to tell your program "don't wait, just tell me if data is available right now":

```ruby
socket.read_nonblock(1024, exception: false)
```

However, that introduces another problem - if data is not ready, what do you do? You can't just spin in a loop checking millions of times per second. That burns 100% CPU.

## IO.select - efficient waiting

This is where `IO.select` comes in. It's a system call that says "here are some I/O objects—put me to sleep until at least one of them is ready."

```ruby
# Give it arrays of I/O objects to watch
readable, writable, errors = IO.select(
  [socket1, socket2, socket3],  # wake me when any is readable
  [],                           # wake me when any is writable
  [],                           # wake me on errors
  10                            # timeout in seconds (optional)
)

# readable is an array of sockets that have data available NOW
readable.each do |socket|
  data = socket.read_nonblock(1024)  # guaranteed not to wait
end
```

The OS efficiently sleeps your process and wakes it only when there's actual data. No CPU spinning.

*Note: readable means data has arrived in the receive buffer, writeable means send buffer has space to accept more data*

Even though `IO.select` is built-in and works on all platforms, it's slower on a large number of I/Os, so depending on the OS you might want to use `epoll`, `kqueue` or `io_uring`:

- epoll (Linux)
- kqueue (macOS/BSD)
- io_uring (newer Linux)

# Fibers enter the scene

Given that we stated the potential problem, let's take a look at Fibers first, then we will see how they help to make this code more manageable.

In a single sentence, Fiber is like a pausable function. You can stop it mid-execution and resume later.

```ruby
fiber = Fiber.new do
  puts "Step 1"
  Fiber.yield        # pause here

  puts "Step 2"
  Fiber.yield        # pause here

  puts "Step 3"
end

fiber.resume
fiber.resume
fiber.resume
```

Outcome

```
Step 1
Step 2
Step 3
```

## Fibers for non-blocking I/O without thread overhead and mutexes

Let's look at an example where we fire 3 requests and process them concurrently:

```ruby
require 'socket'

sockets = {}  # socket => fiber

%w[example.com httpbin.org ruby-lang.org].each do |host|
  Fiber.new do
    socket = TCPSocket.new(host, 80)
    socket.write("GET / HTTP/1.1\r\nHost: #{host}\r\nConnection: close\r\n\r\n")

    sockets[socket] = Fiber.current
    Fiber.yield

    data = socket.read_nonblock(1000)
    puts "Got from #{host}: #{data.length} bytes"
    socket.close
  end.resume
end

# Event loop resumes fibers when ready
while sockets.any?
  readable, _, _ = IO.select(sockets.keys)
  readable.each do |socket|
    sockets.delete(socket).resume
  end
end
```

Output (order may vary based on which server responds first):
```
Got from example.com: 1000 bytes
Got from httpbin.org: 1000 bytes
Got from ruby-lang.org: 1000 bytes
```

All three requests are processed concurrently - the total time is roughly the slowest response, not the sum of all three.

Now you may ask, can't we use threads to achieve the same? Yes, and it's a valid question.

```ruby
# Threads example
threads = %w[example.com httpbin.org ruby-lang.org].map do |host|
  Thread.new do
    socket = TCPSocket.new(host, 80)
    socket.write("GET / HTTP/1.1\r\nHost: #{host}\r\nConnection: close\r\n\r\n")
    data = socket.read(1000)
    puts "Got from #{host}: #{data.length} bytes"
    socket.close
  end
end
threads.each(&:join)
```

**Memory**. Each thread allocates its own stack by default, typically around 1MB on 64-bit systems. A thousand threads means ~1GB of memory just for stacks. Fibers are much lighter—they start with much smaller stacks (typically 4KB) and grow as needed, usually staying well under 128KB. While not as dramatic as sometimes claimed, this still means you can have significantly more fibers than threads in the same memory footprint.

**No mutexes needed**. The OS can switch between threads at any point—even in the middle of counter += 1. This means two threads can corrupt shared data:

```ruby
counter = 0

# With threads - BROKEN
threads = 100.times.map do
  Thread.new { 1000.times { counter += 1 } }
end
threads.each(&:join)
puts counter  # might be 98,432 instead of 100,000 (non-deterministic!)
```

You need a mutex to fix this:

```ruby
mutex = Mutex.new
threads = 100.times.map do
  Thread.new { 1000.times { mutex.synchronize { counter += 1 } } }
end
```

Fibers don't have this problem. A fiber only yields at points you control—at I/O boundaries. Between those points, your code runs without interruption. No surprises, no mutexes needed.

**Predictable scheduling**. The OS decides when to switch threads. You decide when to switch fibers (at I/O points). This makes fiber-based code easier to reason about.

**The tradeoff**: fibers are cooperative. If one fiber does heavy CPU work without yielding, it blocks all other fibers. Threads don't have this problem since the OS preempts them.

## Quick Comparison

| Aspect | Threads | Fibers |
|--------|---------|--------|
| Concurrency type | Preemptive | Cooperative |
| Memory (stack) | 1MB stack | 4KB stack |
| Race conditions | Yes, need mutexes | No, yields only at I/O |
| CPU-heavy work | Automatically preempted | Blocks all fibers |

# Fibers scheduler - elephant in the room

Even though Ruby has built-in support for Fibers, it does not include a built-in scheduler. That means if you call `socket.read` or `sleep` inside a Fiber, it won't automatically yield control to other fibers. You need a scheduler for that — most notably, the famous `async` gem provides a production-ready scheduler implementation. When a scheduler for Fibers is configured, Ruby will use it to switch between Fibers during I/O operations.

## Our own scheduler

**Important**: For production use, you should use the battle-tested [async gem](https://github.com/socketry/async) which provides a complete Fiber Scheduler with support for timeouts, cancellation, and many other features. The scheduler we'll build below is purely educational to understand how schedulers work under the hood.

To better understand the job of the scheduler, let's try to build the most basic scheduler.

The scheduler's job is to track which fibers are waiting for what (I/O readiness or time to pass), and resume them when their conditions are met. It maintains three collections: `@readable` for fibers waiting to read from sockets, `@writable` for fibers waiting to write, and `@waiting` for fibers that called `sleep()`.

When Ruby encounters a blocking operation inside a fiber (like `socket.read` or `sleep`), it calls the corresponding scheduler method (`io_wait` or `kernel_sleep`). The scheduler records what the fiber is waiting for and yields control. The event loop (`run` method) uses `IO.select` to efficiently wait until something is ready, then resumes the appropriate fibers.
```ruby
class FibersScheduler
  def initialize
    @readable = {}  # socket => fiber that wants to read
    @writable = {}  # socket => fiber that wants to write
    @waiting = []   # [fiber, wake_time] for sleeping fibers
  end

  # Called by Ruby when IO operation would block
  def io_wait(io, events, timeout = nil)
    @readable[io] = Fiber.current if (events & IO::READABLE) != 0
    @writable[io] = Fiber.current if (events & IO::WRITABLE) != 0

    Fiber.yield  # pause fiber, return to run loop

    events
  end

  # Called by Ruby when code calls sleep()
  def kernel_sleep(duration = nil)
    @waiting << [Fiber.current, Time.now + duration] if duration

    Fiber.yield
  end

  # Called when a blocking operation occurs
  def block(blocker, timeout = nil)
    Fiber.yield
  end

  # Called to unblock a fiber
  def unblock(blocker, fiber)
    fiber.resume
  end

  # Called by Fiber.schedule to create and immediately run a new fiber
  def fiber(&block)
    # blocking: false tells Ruby to use the scheduler for I/O operations
    Fiber.new(blocking: false, &block).tap do |fiber|
      fiber.resume
    end
  end

  # The event loop
  def run
    while @readable.any? || @writable.any? || @waiting.any?
      # Calculate timeout for sleeping fibers
      timeout = nil
      if @waiting.any?
        earliest = @waiting.map(&:last).min
        timeout = [earliest - Time.now, 0].max
      end

      # Wait for I/O or timeout
      readable, writable, = IO.select(@readable.keys, @writable.keys, [], timeout)

      # Resume fibers whose sockets are ready
      readable&.each do |io|
        fiber = @readable.delete(io)
        fiber.resume if fiber
      end

      writable&.each do |io|
        fiber = @writable.delete(io)
        fiber.resume if fiber
      end

      # Resume fibers whose sleep time has passed
      now = Time.now
      @waiting.reject! do |fiber, wake_time|
        if wake_time <= now
          fiber.resume
          true
        end
      end
    end
  end

  def close
  end
end
```

As you can see, the scheduler is just a simple event-loop built on top of `IO.select` code we played with above.

### Why do we need block and unblock?

The `io_wait` and `kernel_sleep` methods handle specific blocking scenarios (I/O and sleep). The `block` and `unblock` methods handle synchronization primitives like Mutex, ConditionVariable, and Queue.

**Important detail**: `block(blocker, timeout)` does not receive a fiber as a parameter - it always pauses `Fiber.current` (the fiber calling it). But `unblock(blocker, fiber)` receives the waiting fiber as a parameter because to wake up.

Example: Fiber 1 calls `mutex.lock` → triggers `block(mutex, nil)` → pauses Fiber 1. Later, Fiber 2 calls `mutex.unlock` → triggers `unblock(mutex, fiber1)` → resumes Fiber 1.

In our simple scheduler, these methods just `yield` and `resume`. A production scheduler like the `async` gem would track these blocking relationships and ensure fibers are resumed in the correct order.

Now let's try to use it. Note that `Fiber.schedule` creates a non-blocking fiber and runs it immediately - it's a convenience method that calls our scheduler's `fiber` method:

```ruby
Fiber.set_scheduler(FibersScheduler.new)

Fiber.schedule do
  puts "Fiber 1: sleeping"
  sleep(1)
  puts "Fiber 1: woke up"
end

Fiber.schedule do
  puts "Fiber 2: sleeping"
  sleep(0.5)
  puts "Fiber 2: woke up"
end

Fiber.scheduler.run
```

Output:

```
Fiber 1: sleeping
Fiber 2: sleeping
Fiber 2: woke up
Fiber 1: woke up
```

Both fibers sleep concurrently. Without the scheduler, this would take 1.5 seconds. With the scheduler, it takes 1 second.

**Note on error handling**: Our simple scheduler doesn't handle exceptions that occur within fibers. If a fiber raises an exception, it would crash the entire program. Production schedulers like the `async` gem catch fiber exceptions, log them, and continue processing other fibers gracefully.

# Conclusion

Fibers provide a lightweight alternative to threads for handling concurrent I/O operations. They offer better memory efficiency, eliminate the need for mutexes in many scenarios, and give you predictable control over when context switches occur.

While our simple scheduler demonstrates the core concepts, remember to use a production-ready scheduler like the `async` gem for real applications.

The key insight is that Fibers excel at I/O-bound concurrency. If your application spends most of its time waiting for network responses, database queries, or file operations, Fibers can dramatically improve efficiency without the complexity of thread synchronization.
