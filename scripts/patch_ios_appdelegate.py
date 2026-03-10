from pathlib import Path
import re


def main() -> None:
    path = Path("ios/App/App/AppDelegate.swift")
    if not path.exists():
        raise SystemExit(f"AppDelegate.swift not found at {path}")

    text = path.read_text(encoding="utf-8")

    if "import FirebaseCore" not in text:
        text = text.replace("import Capacitor", "import Capacitor\nimport FirebaseCore")

    # Treat any FirebaseApp.configure(...) invocation as already configured.
    if "FirebaseApp.configure(" not in text:
        pattern = r"(func application\(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: \[UIApplication\.LaunchOptionsKey: Any\]\?\) -> Bool \{\n(?:\s*//.*\n)?)"
        repl = (
            r"\1"
            r"        if FirebaseApp.app() == nil {\n"
            r"            if let plistPath = Bundle.main.path(forResource: \"GoogleService-Info\", ofType: \"plist\"),\n"
            r"               let options = FirebaseOptions(contentsOfFile: plistPath) {\n"
            r"                FirebaseApp.configure(options: options)\n"
            r"            } else {\n"
            r"                print(\"GoogleService-Info.plist not found in bundle; skipping Firebase configure\")\n"
            r"            }\n"
            r"        }\n"
        )
        text = re.sub(pattern, repl, text, count=1)

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
    print("AppDelegate.swift patched for Firebase Messaging")


if __name__ == "__main__":
    main()
