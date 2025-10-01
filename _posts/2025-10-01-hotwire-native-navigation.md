---
layout: post
title: "Understanding the Hotwire Native Navigation"
description: "A deep dive into Hotwire's native navigation internals"
date: 2025-10-01
tags:
  - hotwire
---

Recently, I started reading [Hotwire Native for Rails Developers](https://pragprog.com/titles/jmnative/hotwire-native-for-rails-developers/) by Joe Masilotti. After the first three chapters, I decided to jump into the source code to explore how Hotwire Native handles navigation to make it resemble a native application. My goal was to understand how Hotwire Native is tied to Turbo/Turbolinks and whether it's possible to use it with other libraries like Unpoly or HTMX.

What I discovered was a clever architecture that reuses a single WebView across multiple screens while maintaining native navigation patterns. Here's what I learned from diving into both the iOS and Android implementations.

**Note: I'm not an expert in Hotwire Native, so please contact me if you find any mistakes in this article.**

## Key Components Glossary

While exploring the codebase, I encountered four main components that orchestrate the navigation:

**Navigator** – The main object for orchestrating navigation based on Path Configuration rules. It determines navigation actions (push, modal, replace), and manages the view controller stack (iOS) or fragment transitions (Android).

**Session** – The WebView manager that handles attaching/detaching the WebView between screens and coordinates visit lifecycle events. In tabbed interfaces, each tab gets its own Session.

**Visit/JavaScriptVisit** – Manages navigation requests and communication with the JavaScript layer. iOS uses a specific `JavaScriptVisit` class for subsequent navigations after initial load (ColdBootVisit for initial load), while Android uses a unified `Visit` class for all navigation types.

**Bridge** – The messenger that serializes data between JavaScript and native code, managing script injection and callback patterns. iOS uses a WebViewBridge class, while Android uses `@JavascriptInterface` on the Session class for Turbo communication, plus a separate Bridge class for component-based messaging.

### Component Relationships

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             JavaScript                                  │
│                             (turbo.js)                                  │
└─────────────────┬───────────────────────────────┬───────────────────────┘
                  │                               │
        iOS: WebViewBridge            Android: @JavascriptInterface
                  │                               │
         ┌────────▼────────┐             ┌────────▼────────┐
         │     Session     │             │     Session     │
         │   (iOS/Swift)   │             │  (Android/Kt)   │
         └────────┬────────┘             └────────┬────────┘
                  │                               │
                  │         ┌──────────────┐      │
                  └────────►│   Navigator  │◄─────┘
                            └──────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
            ┌───────▼───────┐      │      ┌───────▼────────────────────┐
            │ Path Config   │      │      │  HierarchyController (iOS) │
            │    Rules      │      │      │  NavController (Android)   │
            └───────────────┘      │      └───────┬────────────────────┘
                                   │              │
                          ┌────────▼────────┐     │
                          │    WebView      │     │
                          │   (Shared!)     │     │
                          └────────┬────────┘     │
                                   │              │
                          ┌────────▼──────────────▼───────┐
                          │   ViewControllers (iOS)       │
                          │     Fragments (Android)       │
                          └───────────────────────────────┘
```

## Turbo/Turbolinks as a foundation

_The code snippets in this article are simplified for clarity and contain additional comments to explain the flow. For full details, please refer to the original source code._

As I initially found out, Hotwire Native actually requires Turbo or Turbolinks to work. It intercepts user navigation events and sends them to the native layer to determine the appropriate navigation action. Once the native layer determines the proper action (e.g., push a new screen, pop the current screen, open/dismiss a modal), it calls the page visit using Turbo/Turbolinks programmatically.

This integration is done via the `turbo.js` file on [iOS](https://github.com/hotwired/hotwire-native-ios/blob/main/Source/Turbo/WebView/turbo.js) and [Android](https://github.com/hotwired/hotwire-native-android/blob/main/core/src/main/assets/js/turbo.js), which is injected into the WebView during the initial rendering. The `TurboNative` class attaches itself as a custom adapter to Turbo/Turbolinks and listens to navigation events:

```js
class TurboNative {
  ...

  registerAdapter() {
    if (window.Turbo) {
      Turbo.registerAdapter(this)
    } else if (window.Turbolinks) {
      Turbolinks.controller.adapter = this
    } else {
      throw new Error("Failed to register the TurboNative adapter")
    }
  }

  ...

  // Turbo
  visitProposedToLocation(location, options) {
    // Other actions omitted for brevity

    ...

    // iOS - sends the message to the native layer using the Bridge component responsible for the communication between JavaScript and native code.
    this.postMessage("visitProposed", { location: location.toString(), options: options })

    // Android - call dev.hotwire.core.turbo.session.Session instanced exposed to the WebView JS layer
    TurboSession.visitProposedToLocation(location.toString(), JSON.stringify(options))
  }

  // Turbolinks 5
  visitProposedToLocationWithAction(location, action) {
    this.visitProposedToLocation(location, { action })
  }

  ...
}
```

If we wanted to use another library instead of Turbo/Turbolinks, we would need to implement a similar JavaScript file that intercepts navigation events, sends them to the native layer, and performs the navigation programmatically on callback.

## Hotwire Native layer

### iOS Implementation

The Hotwire Native iOS `Session` class receives the message from JavaScript via the WebView bridge and forwards it to the `Navigator` instance:

```swift
extension Session: WebViewDelegate {
    func webView(_ bridge: WebViewBridge, didProposeVisitToLocation location: URL, options: VisitOptions) {
        let properties = pathConfiguration?.properties(for: location) ?? [:]
        let proposal = VisitProposal(url: location, options: options, properties: properties)
        // Call the Navigator instance via delegate
        delegate?.session(self, didProposeVisit: proposal)
    }

    ...
}
```

The Hotwire Native iOS Navigator receives the route and analyzes the path configuration to determine the appropriate navigation action. Once the action is determined, the proper controller is created. The existing WebView is then detached from the current screen and attached to the new screen. This way, the WebView is reused across multiple screens and the state is preserved. Finally, the controller is pushed onto the navigation stack according to the determined action.


```swift
public class Navigator {
  public func session(_ session: Session, didProposeVisit proposal: VisitProposal) {
    route(proposal)
  }

  // Convert url, options into a VisitProposal instance and pass it to route
  public func route(_ url: URL, options: VisitOptions? = VisitOptions(action: .advance), parameters: [String: Any]? = nil) {
    let properties = session.pathConfiguration?.properties(for: url) ?? PathProperties()
    route(VisitProposal(url: url, options: options ?? .init(action: .advance), properties: properties, parameters: parameters))
  }

  // Create a new controller for the visit proposal
  public func route(_ proposal: VisitProposal) {
    ...

    guard let controller = controller(for: proposal) else { return }
    hierarchyController.route(controller: controller, proposal: proposal)
  }
}
```

On iOS, the `hierarchyController` is responsible for maintaining the navigation stack. Once the stack is updated, the controller calls back the `Navigator` (via delegate) which then forwards the message to the right `Session` instance (modal vs navigation vs tabs):

```swift
extension Session: VisitDelegate {
  ...

  // Called from Navigator when the controller is pushed onto the stack
  public func visit(_ visitable: Visitable, options: VisitOptions? = nil, reload: Bool = false) {
    // Create JavaScriptVisit instance
    let visit = makeVisit(for: visitable, options: options ?? VisitOptions())

    ...

    visit.delegate = self
    visit.start()
  }

  // Called from Visit#start() method
  func visitWillStart(_ visit: Visit) {
    ...

    // Show a screenshot on the current controller
    visit.visitable.showVisitableScreenshot()

    // Transfer the WebView to the new controller
    activateVisitable(visit.visitable)
  }

  ...
}
```

Then it sends the message from the native layer to the WebView using `JavaScriptVisit` to perform the transition using the Turbo/Turbolinks API.

```swift
final class JavaScriptVisit: Visit {
  ...

  // Called from Visit#start() method
  override func startVisit() {
    log("startVisit")
    bridge.visitDelegate = self
    bridge.visitLocation(location, options: options, restorationIdentifier: restorationIdentifier)
  }

  ...
}
```

### Android Implementation

On Android, the Session class exposes the `visitProposedToLocation` method to JavaScript via the `@JavascriptInterface` annotation:

```kotlin
class Session(
    internal val sessionName: String,
    private val activity: AppCompatActivity,
    val webView: HotwireWebView
) {
    ...

    // Method exposed to JavaScript to be used by Turbo / Turbolinks adapter
    @JavascriptInterface
    fun visitProposedToLocation(location: String, optionsJson: String) {
        val options = VisitOptions.fromJSON(optionsJson) ?: return

        logEvent("visitProposedToLocation", "location" to location, "options" to options)
        // Call the HotwireWebFragmentDelegate (via callback) which implements SessionCallback
        callback { it.visitProposedToLocation(location, options) }
    }

    ...
}
```

The `callback` function provides access to the current web fragment (`HotwireWebFragmentDelegate`) displaying the web content.

```kotlin
class HotwireWebFragmentDelegate(
    private val fragment: HotwireWebFragment,
    private val navigator: Navigator
) : SessionCallback {
    ...

    // Called from Session when visit is proposed from JavaScript
    override fun visitProposedToLocation(location: String, options: VisitOptions) {
        navigator.route(location, options)
    }

    ...
}
```

The `HotwireWebFragmentDelegate` simply forwards the message to the `Navigator` instance which then analyzes the path configuration and determines the appropriate navigation action.

```kotlin
class Navigator(
    val host: NavigatorHost,
    val configuration: NavigatorConfiguration,
    val activity: HotwireActivity
) {
    ...

    // Perform navigation based on location and options
    fun route(location: String, options: VisitOptions = VisitOptions(), bundle: Bundle? = null, extras: FragmentNavigator.Extras? = null) {
        // Create a navigation rule based on the location and options
        val rule = NavigatorRule(...)

        ...

        when (rule.newNavigationMode) {
            // Other modes omitted for brevity

            ...

            NavigatorMode.IN_CONTEXT -> {
                navigateWithinContext(rule)
            }
        }
    }

    ...

    // Perform navigation based on the presentation type
    private fun navigateWithinContext(rule: NavigatorRule) {
        ...

        when (rule.newPresentation) {
            // Other presentations omitted for brevity
            Presentation.PUSH -> navigateWhenReady {
                ...

                navigateToLocation(rule)
            }
            else -> {
                throw IllegalStateException("Unexpected Presentation for navigating within context")
            }
        }
    }

    ...

    // Push the new fragment onto the navigation stack
    private fun navigateToLocation(rule: NavigatorRule) {
        ...

        // Uses NavController#navigate native function
        // https://developer.android.com/reference/androidx/navigation/NavController#navigate(kotlin.Int,android.os.Bundle,androidx.navigation.NavOptions,androidx.navigation.Navigator.Extras)
        rule.controller.navigate(it.id, rule.newBundle, rule.newNavOptions, rule.newExtras)
    }
}
```

As part of the new fragment creation, we detach the WebView from the current fragment inside the `navigateWhenReady` function:

```kotlin
private fun navigateWhenReady(onReady: () -> Unit) {
    // Get the current HotwireWebFragmentDelegate instance
    val destination = currentDestination

    if (destination != null) {
        destination.onBeforeNavigation()
        // This basically detaches the WebView from the current fragment by calling:
        // session.removeCallback(this)
        // detachWebView(onReady)
        destination.prepareNavigation(onReady)
    } else {
        onReady()
    }
}
```

The WebView is then attached to the newly created fragment (built by the `navController.navigate()` method) when the delegate's `onStart` event is triggered:

```kotlin
abstract class HotwireFragment : Fragment(), HotwireDestination {
    override fun onStart() {
        super.onStart()

        if (!delegate.sessionViewModel.modalResultExists) {
            webDelegate.onStart()
        }
    }
}
```

The delegate then attaches the WebView to the fragment and calls `session.visit()` to initiate the navigation:

```kotlin
internal class HotwireWebFragmentDelegate(
    private val delegate: HotwireFragmentDelegate,
    private val navDestination: HotwireDestination,
    private val callback: HotwireWebFragmentCallback
) : SessionCallback, VisitDestination {
    fun onStart() {
        // Attach the WebView to the fragment
        initNavigationVisit()
        initWebChromeClient()
    }
}
```

## Navigation flow recap

### iOS Navigation Flow

1. User taps link in WebView
2. `turbo.js` intercepts the click (as Turbo/Turbolinks adapter) and sends message to native (`visitProposed`)
3. Session receives message via WebViewBridge and forwards to Navigator
4. Navigator analyzes URL against Path Configuration to determine UI pattern (modal, push, replace)
5. Navigator creates new HotwireWebViewController
6. HierarchyController pushes the controller to the navigation stack and calls back Navigator
7. Navigator forwards message to Session to initiate visit
8. Session creates JavaScriptVisit and starts it
9. In `visitWillStart()`, Session shows screenshot on old controller and transfers WebView to new controller
10. JavaScriptVisit calls `bridge.visitLocation()` to trigger JavaScript navigation
11. Bridge executes `window.turboNative.visitLocationWithOptionsAndRestorationIdentifier()`
12. JavaScript performs AJAX request (via Turbo Drive or Turbolinks)
13. Content updates in WebView
14. In `visitDidRender()`, Session hides the screenshot

### Android Navigation Flow

1. User taps link in WebView
2. `turbo.js` intercepts the click (as Turbo/Turbolinks adapter) and sends message to native (`visitProposed`)
3. Session receives the message via `@JavascriptInterface` and calls `SessionCallback.visitProposedToLocation()`
4. HotwireWebFragmentDelegate (implements SessionCallback) calls `navigator.route(location, options)`
5. Navigator analyzes URL against Path Configuration to determine UI pattern
6. Navigator calls `prepareNavigation()` on current fragment to detach WebView
7. Navigator uses `NavController.navigate()` to perform navigation
8. New fragment lifecycle triggers `onStart()` event
9. Fragment delegate attaches WebView and calls `session.visit()`
10. Session calls `HotwireWebView#visitLocation` method
11. `HotwireWebView` executes `window.turboNative.visitLocationWithOptionsAndRestorationIdentifier()`
12. JavaScript performs AJAX request (via Turbo Drive or Turbolinks)
13. Content updates in WebView

## Key takeaways

After diving into the source code, here are my main observations:

- **WebView is reused across screens** – A single WebView instance moves between screens, avoiding memory overhead and maintaining JavaScript state. Both iOS and Android share this fundamental approach.
- **Turbo dependency is fundamental** – The architecture is tightly coupled to Turbo's event system through the JavaScript bridge adapter, making alternative libraries challenging to integrate without significant rewriting.
- **Native layer controls the flow** – The native layer decides navigation patterns based on path configuration while the web layer handles content loading. The Navigator component is central to this orchestration.
- **Screenshot trick for transitions (iOS)** – iOS uses screenshots shown during `visitWillStart()` to mask the WebView transfer between controllers, hiding them when rendering completes in `visitDidRender()`. Android directly detaches and reattaches the WebView to fragments, both creating smooth transitions.
- **Different callback flows** – iOS follows Navigator → HierarchyController → Navigator → Session, while Android follows Session → Fragment Delegate → Navigator → NavController. The Android flow is session-driven, where the Session initiates navigation through the delegate callback mechanism.

The logic can feel overwhelming at first, especially if you're not familiar with the delegation pattern used heavily in both implementations. I also lack experience building native applications, so I might have missed some important details. However, I hope this article provides a good starting point for understanding how Hotwire Native navigation works under the hood.

## What's next?

Understanding these internals opens up interesting possibilities for customization. While using alternatives to Turbo would require significant work, the architecture provides clear extension points through Path Configuration and custom view controllers (iOS) or fragments (Android).

If you're interested in exploring further, I recommend checking out:

- [Joe Masilotti's book](https://pragprog.com/titles/jmnative/hotwire-native-for-rails-developers/) for practical understanding of Hotwire Native
- [Hotwire Native iOS source code](https://github.com/hotwired/hotwire-native-ios)
- [Hotwire Native Android source code](https://github.com/hotwired/hotwire-native-android)
