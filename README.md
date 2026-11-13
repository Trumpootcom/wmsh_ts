# Headless WMS

This smoke test turns a JPG into a one-page US Letter PDF. It centers the map at a fixed 8-inch print width, preserves its aspect ratio, and overlays a 1-inch square grid across the printable area. Use a landscape or square JPG for the first test.

From PowerShell, start the local Worker:

```powershell
npm.cmd ci
npm.cmd run dev
```

In another terminal, upload a JPG and open the result:

```powershell
curl.exe --fail-with-body -F "image=@C:\path\to\map.jpg" -o smoke.pdf http://127.0.0.1:8787/render
Invoke-Item smoke.pdf
```

The prototype uses fixed rendering settings. See [vision.md](vision.md) for the planned template, R2, and multipage behavior.

Run `npm.cmd run typecheck` to generate the Worker types and check the TypeScript.
