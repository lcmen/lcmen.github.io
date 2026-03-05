---
layout: post
title: "Running Rails system specs in WSL 2 using Chrome on Windows"
description: "Learn how to run Rails system specs with Capybara and Selenium across the WSL 2 and Windows network boundary."
date: 2026-03-05
tags:
  - Rails
---

If you're developing a Rails app inside WSL 2 and want to run system specs with Capybara and Selenium, you'll quickly hit a problem: WSL 2 runs on a separate virtual network from your Windows host. Your test suite runs in Linux, but Chrome lives on the Windows side. The two need to talk to each other across that network boundary.

In this post, I'll walk you through a clean setup that wires everything together.

## The Architecture

Here's what's happening under the hood:

1. Capybara starts a Puma test server inside WSL and drives the browser via Selenium.
2. ChromeDriver runs on Windows and controls a local Chrome instance.
3. Capybara connects to ChromeDriver over the WSL ↔ Windows virtual network.
4. Chrome connects back to the Puma test server inside WSL to load pages.

Two IPs matter here:

- **Windows host IP** - so WSL can reach ChromeDriver. This is the default gateway from `ip route show default`.
- **WSL IP** - so Chrome can reach the Puma test server. Available via `hostname -I`.

## Setting Up ChromeDriver on Windows

We need `ChromeDriver` installed and running on the Windows side. The following PowerShell script handles everything: it installs `ChromeDriver` via `winget` if it's not already present, resolves the WSL IP, and launches ChromeDriver with access restricted to that IP only.

Save this as `chromedriver.ps1`:

```powershell
param(
    [string]$Version
)

# Resolve full version from a major version prefix (e.g. "145" -> "145.0.7049.85")
if ($Version) {
    $match = winget show --id Chromium.ChromeDriver --versions | Select-String "^\s*($Version\.\S+)" | Select-Object -First 1
    if (-not $match) {
        Write-Host "ERROR: No ChromeDriver version found matching '$Version'" -ForegroundColor Red
        exit 1
    }
    $Version = $match.Matches[0].Groups[1].Value
    Write-Host "Resolved version: $Version"
}

# Uninstall if the installed version is newer than the requested one
if ($Version) {
    $installed = winget list --id Chromium.ChromeDriver | Select-String "Chromium\.ChromeDriver\s+(\S+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }
    if ($installed -and [version]$installed -gt [version]$Version) {
        Write-Host "Downgrading from $installed to $Version..."
        winget uninstall --id Chromium.ChromeDriver
    }
}

# Install ChromeDriver
winget install --id Chromium.ChromeDriver --version $Version --accept-source-agreements --accept-package-agreements

# Get the WSL IP to restrict access
$wslIp = (wsl hostname -I).Trim().Split()[0]

if (-not $wslIp) {
    Write-Host "ERROR: Could not determine WSL IP. Is WSL running?" -ForegroundColor Red
    exit 1
}

Write-Host "Starting ChromeDriver on port 9515 (allowed IP: $wslIp)"
chromedriver.exe --port=9515 --allowed-ips="$wslIp"
```

Run it to install the latest version and start ChromeDriver:

```powershell
.\chromedriver.ps1
```

Or pin a specific version to match your Chrome (a major version prefix is enough):

```powershell
.\chromedriver.ps1 -Version 145
```

> **Note:** If this is your first time running PowerShell scripts, you may need to allow script execution first:
>
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

ChromeDriver version must match your installed Chrome version. You can check your Chrome version at `chrome://settings/help`. If Chrome auto-updates ahead of ChromeDriver (or vice versa), pass `-Version` to pin the matching release.

The `--allowed-ips` flag is important. Without it (or with an empty value), any device on your local network could connect to ChromeDriver. By restricting it to the WSL IP, only your WSL instance can make requests.

## Configuring Capybara

On the Rails side, create a Capybara configuration file (e.g. `test/test_helpers/capybara.rb` or `spec/support/capybara.rb`) and make sure it's loaded by your test helper.

```ruby
WSL = File.read("/proc/version").include?("microsoft") rescue false
HEADLESS = ENV.fetch("HEADLESS", "1").in?(%w[1 y yes true t])

Capybara.app_host = "http://#{`hostname -I`.strip.split.first}" if WSL
Capybara.server_host = "0.0.0.0"

chrome_options = -> {
  options = Selenium::WebDriver::Chrome::Options.new
  options.add_argument("--headless=new") if HEADLESS
  options.add_argument("--no-sandbox")
  options.add_argument("--disable-dev-shm-usage")
  options
}

Capybara.register_driver :chrome do |app|
  Capybara::Selenium::Driver.new(app, browser: :chrome, options: chrome_options.call)
end

Capybara.register_driver :remote_chrome do |app|
  host = `ip route show default`.match(/via\s+(\S+)/)&.captures&.first
  Capybara::Selenium::Driver.new(app, browser: :remote, url: "http://#{host}:9515", capabilities: chrome_options.call)
end
```

A few things to note:

- **WSL detection** checks `/proc/version` for the `microsoft` string, so the same config works on both WSL and native Linux/macOS.
- **`server_host = "0.0.0.0"`** makes the test server listen on all interfaces, so Chrome on Windows can reach it.
- **`app_host`** is set to the WSL IP so Capybara tells Chrome where to find the test server. Without this, Capybara would use `127.0.0.1`, which inside Chrome on Windows points to Windows itself - not the WSL instance running Puma. Capybara appends the port automatically.
- **Two drivers** are registered: `:chrome` for local environments and `:remote_chrome` for WSL. The Windows host IP is resolved from the default gateway via `ip route show default`.
- **`HEADLESS`** is controlled via an environment variable. Set `HEADLESS=0` to watch the tests run

## Running the Specs

1. Start ChromeDriver on Windows:

   ```powershell
   .\chromedriver.ps1
   ```

2. Run your system specs from WSL:

   ```bash
   bundle exec rails test:system
   ```

That's it. Capybara connects to ChromeDriver on the Windows side, ChromeDriver launches Chrome, and Chrome loads pages from the Puma server running in WSL.
