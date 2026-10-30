PixelRamp Studio 0.1.0
======================

Start here
----------
双击 PixelRamp.cmd 启动 PixelRamp。
Double-click "PixelRamp.cmd" to start PixelRamp.

Why PixelRamp.cmd?
The Chromium OS sandbox cannot start in the original build/test environment.
The start script launches the app with "--no-sandbox", which is required in
that environment. It also sets PIXELRAMP_USER_DATA to PixelRampData\ next to
this file, so the portable build does not depend on AppData write access.
The renderer still uses contextIsolation, has Node integration disabled, is
prevented from navigating, and runs with a restrictive CSP.

Windows SmartScreen may warn because this build is unsigned. Use
PixelRamp.cmd for the supported launch path. If the start script also warns,
choose "More info" -> "Run anyway".

If PixelRamp.exe starts normally on your machine, you can run it directly,
but its data path defaults to %APPDATA%\PixelRamp.

Data
----
When launched with PixelRamp.cmd, palettes and recent files are stored in:
  PixelRampData\ next to this README

Project files use the .pxramp extension and can be opened from the File menu.

Shortcuts
---------
B / E / G / I    pencil / eraser / bucket / eyedropper
L / R / V        line / rectangle / selection
Ctrl+Z, Ctrl+Shift+Z
Ctrl+S, Ctrl+O, Ctrl+Shift+E
Space + drag     pan; mouse wheel = zoom
?                shortcut reference
