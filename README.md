# Headless WMS

Upload a JPG and a JSON template to produce a one-page PDF with a square grid. The [example template](examples/letter-square.json) centers the map on US Letter at an 8-inch print width and overlays a 1-inch grid across the printable area. Use a landscape or square JPG for the first test.

From PowerShell, start the local Worker:

```powershell
npm.cmd ci
npm.cmd run dev
```

In another terminal, upload a JPG and open the result:

```powershell
curl.exe --fail-with-body -F "image=@C:\path\to\map.jpg" -F "template_file=@examples/letter-square.json" -o smoke.pdf http://127.0.0.1:8787/render
Invoke-Item smoke.pdf
```

Include every field in the example. Try changing `grid.inchesPerFiveFeet` to `0.5` to print the map 4 inches wide with half-inch squares. The prototype supports Letter or Ledger, either orientation, and black, gray, or white grid lines. The required overlap setting applies when the page array gains adjacent sheets. See [vision.md](vision.md) for the planned multipage, isometric grid, and R2 alias support.

Run `npm.cmd run typecheck` to generate the Worker types and check the TypeScript.
