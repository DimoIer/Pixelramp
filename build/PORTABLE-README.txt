PixelRamp Studio 0.1.0
======================

Start here
----------
双击 PixelRamp.cmd 启动 PixelRamp。
Double-click "PixelRamp.cmd" to start PixelRamp.

Why PixelRamp.cmd?
The Chromium OS sandbox cannot start in the original build/test environment.
The start script launches the app with "--no-sandbox", which is required in
that environment. The renderer still uses contextIsolation, has Node
integration disabled, is prevented from navigating, and runs with a
local-only CSP.

On a machine where PixelRamp.exe starts normally, you can run it directly.

Data
----
Palettes and recent files are stored in:
  %APPDATA%\PixelRamp\

Project files use the .pxramp extension and can be opened from the File menu.

Shortcuts
---------
B / E / G / I    pencil / eraser / bucket / eyedropper
L / R / V        line / rectangle / selection
Ctrl+Z, Ctrl+Shift+Z
Ctrl+S, Ctrl+O, Ctrl+Shift+E
Space + drag     pan; mouse wheel = zoom
?                shortcut reference
