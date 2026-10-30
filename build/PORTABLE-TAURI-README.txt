PixelRamp Studio 0.2.4
=====================

Start here
----------
双击 PixelRamp.cmd 启动 PixelRamp。
Double-click PixelRamp.cmd to start PixelRamp.

Why the launcher?
The app is unsigned. Windows SmartScreen may warn if PixelRamp.exe is run
directly. PixelRamp.cmd starts the app and keeps its data beside the app:

  PixelRampData\      palettes, recent files
  PixelRampWebView\   WebView2 profile/cache

This requires the Microsoft Edge WebView2 Runtime, which is included with
Windows 11. On Windows 10, install the Evergreen WebView2 Runtime if needed.

Command-line flags are no longer needed; this build uses Tauri/WebView2 rather
than Electron.

Migrating from the Electron build
---------------------------------
If you used the previous Electron build, copy its PixelRampData\palettes and
recent.json into PixelRampData\ beside this README.

Shortcuts
---------
B / E / G / I    pencil / eraser / bucket / eyedropper
L / R / V        line / rectangle / selection
Ctrl+Z, Ctrl+Shift+Z
Ctrl+S, Ctrl+O, Ctrl+Shift+E
Space + drag     pan; mouse wheel = zoom
?                shortcut reference
