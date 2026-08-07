from pathlib import Path
import re


SAFE_CONFIGURE = """\
        if FirebaseApp.app() == nil {
            if let plistPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
               let options = FirebaseOptions(contentsOfFile: plistPath) {
                FirebaseApp.configure(options: options)
            } else {
                print("GoogleService-Info.plist not found in bundle; skipping Firebase configure")
            }
        }
"""


def main() -> None:
    path = Path("ios/App/App/AppDelegate.swift")
    if not path.exists():
        raise SystemExit(f"AppDelegate.swift not found at {path}")

    text = path.read_text(encoding="utf-8")

    if "import FirebaseCore" not in text:
        text = text.replace("import Capacitor", "import Capacitor\nimport FirebaseCore")

    # Replace any bare FirebaseApp.configure() which crashes when plist is missing.
    # Keep a single safe configure block.
    text = re.sub(
        r"[ \t]*FirebaseApp\.configure\([^\n]*\)\n?",
        "",
        text,
    )

    if "GoogleService-Info.plist not found in bundle" not in text:
        pattern = (
            r"(func application\(_ application: UIApplication, "
            r"didFinishLaunchingWithOptions launchOptions: "
            r"\[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{\n"
            r"(?:\s*//.*\n)?)"
        )
        repl = r"\1" + SAFE_CONFIGURE
        text2, n = re.subn(pattern, repl, text, count=1)
        if n == 0:
            raise SystemExit("Could not locate didFinishLaunchingWithOptions to insert Firebase configure")
        text = text2

    if "didRegisterForRemoteNotificationsWithDeviceToken" not in text:
        methods = "\n".join(
            [
                "    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {",
                "        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)",
                "    }",
                "",
                "    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {",
                "        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)",
                "    }",
                "",
                "    func application(_ application: UIApplication,",
                "                     didReceiveRemoteNotification userInfo: [AnyHashable : Any],",
                "                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {",
                "        NotificationCenter.default.post(name: Notification.Name(\"didReceiveRemoteNotification\"),",
                "                                        object: completionHandler,",
                "                                        userInfo: userInfo)",
                "    }",
                "",
            ]
        )
        text = text.rstrip()
        if text.endswith("}"):
            text = text[:-1] + methods + "\n}\n"
        else:
            text = text + methods

    path.write_text(text, encoding="utf-8")
    print("AppDelegate.swift patched for crash-safe Firebase Messaging")


if __name__ == "__main__":
    main()
