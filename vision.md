# Headless WMS — Project Description
**Web Map Slicer | Headless PDF Generation Service**

## 1. Project Overview

Headless WMS is a Cloudflare Worker-based service that converts a prepared JPG battle map into a multipage, print-ready PDF using a predefined map-printing template.

The service operates independently of the interactive WMS editor. It performs map scaling, grid generation, page layout, and PDF production without requiring a browser interface.

**Core workflow:**

`JPG image + JSON template (file or alias) → Multipage PDF`

The service does not perform image editing. The supplied JPG is assumed to have the desired orientation, cropping, perspective, color, and tone.

## 2. Inputs

Every rendering request requires two inputs.

### 2.1 Source Image

- Format: JPG/JPEG
- The image is considered final and ready for printing.
- Its aspect ratio is preserved.
- Its height in world units is calculated from its width and aspect ratio.
- The image is never modified or overwritten.

### 2.2 Template

The caller can omit the template to use the built-in 160-foot-wide, 2 × 2 landscape Ledger template, or supply a custom template.

**Option A — JSON Template File**

Upload a `template_file.json` containing the complete map and printing configuration.

**Option B — Template Alias (planned)**

Supply a `template_alias` identifying a previously published template stored in Cloudflare R2.

The Worker retrieves the corresponding JSON template from R2.

Both options use the same template schema and rendering engine.

## 3. Template Configuration

Every field shown in the example is required. A missing field is a validation error. The uploaded JSON and R2 templates follow the same rule. For square grids, include `grid.isoAngleDegrees` with the value `null`.

| Parameter | Description |
|---|---|
| `worldWidthFeet` | Physical world width represented by the image |
| `grid.style` | `square` or `iso` |
| `grid.isoAngleDegrees` | Angle between ISO grid axes, 15 to 90 degrees, or `null` for square grids |
| `grid.rotationDegrees` | Grid rotation |
| `grid.offsetX` | Offset along the first lattice axis from the image center, in cell units |
| `grid.offsetY` | Offset along the downward lattice axis from the image center, in cell units |
| `grid.inchesPerFiveFeet` | Printed inches representing five world feet |
| `grid.lineStyle` | `solid`, `dash-1`, `dash-2`, `dash-3`, `dash-4`, `dash-5`, `dash-6`, `dash-8`, `dash-10`, `dash-16`, `corners`, or `none`. The number gives the dash count per cell edge. |
| `grid.color` | Named grid color |
| `grid.lineWidthPoints` | Grid stroke width in PDF points |
| `grid.opacity` | Grid stroke opacity from 0 to 1 |
| `grid.extent` | `printableCanvas` in version 1, including areas without artwork |
| `imagePlacement` | `center` in version 1, relative to the assembled printable canvas |
| `page.size` | `letter` or `ledger` |
| `page.orientation` | `portrait` or `landscape` |
| `page.rows` | Number of rows in the page array |
| `page.columns` | Number of columns in the page array |
| `page.marginInches` | Margin on each edge of each sheet |
| `page.overlapInches` | Overlap between adjacent sheets |

### Example Template

```json
{
  "schemaVersion": 1,
  "name": "80 Foot Square Map",
  "worldWidthFeet": 80,
  "imagePlacement": "center",
  "grid": {
    "style": "square",
    "isoAngleDegrees": null,
    "rotationDegrees": 0,
    "offsetX": 0,
    "offsetY": 0,
    "inchesPerFiveFeet": 1,
    "lineStyle": "solid",
    "color": "black",
    "lineWidthPoints": 0.5,
    "opacity": 0.6,
    "extent": "printableCanvas"
  },
  "page": {
    "size": "letter",
    "orientation": "landscape",
    "rows": 3,
    "columns": 2,
    "marginInches": 0.25,
    "overlapInches": 0.125
  }
}
```

World height is calculated from the source image's aspect ratio.

The physical image dimensions are determined by `worldWidthFeet` and `inchesPerFiveFeet`. The Worker uses the requested scale when the image fits and reduces the map and grid by the same factor when needed.

### Image Scale and Page Layout

The interactive `vtt_slicer` exporter used the image dimensions to determine the page count and placed the image at the upper left of the page array. Headless WMS centers the image in a page array whose dimensions are set independently by the template.

- **Image size.** Printed width in inches is `worldWidthFeet / 5 × inchesPerFiveFeet`. Printed height is the printed width multiplied by the JPG's pixel height divided by its pixel width. For example, an 80-foot-wide map at 1 inch per 5 feet prints 16 inches wide.
- **Page array.** The template specifies Letter or Ledger, portrait or landscape, and the exact number of rows and columns. For each axis, the assembled printable span is the sheet count times the printable sheet span, minus `page.overlapInches` for each join. The printable sheet span subtracts twice `page.marginInches` from the sheet span.
- **Placement.** Center the image once in the assembled printable canvas, with equal space on opposite sides along each axis. Each sheet shows its portion of that canvas. If the image exceeds either canvas dimension, shrink it proportionally before centering.

## 4. Rendering Behavior

The Worker performs the following operations:

1. Validate the source JPG and supplied template.
2. Resolve the template from the uploaded JSON or R2 alias.
3. Calculate the image's physical dimensions from the world scale and source aspect ratio.
4. Calculate the assembled printable canvas from the page size, orientation, margins, overlap, and page array.
5. Reduce the scale proportionally when needed to fit the available canvas.
6. Center the image within the assembled canvas.
7. Generate the requested grid using the specified style, angle, rotation, offsets, scale, line style, color, stroke width, and opacity.
8. Extend the grid across the entire printable canvas, including areas beyond the image.
9. Slice the assembled canvas into individual pages while preserving alignment and overlap.
10. Generate and return the PDF.

### Page Array Rules

The specified page array is authoritative.

For example:

`pageRows = 3`, `pageColumns = 2`

The resulting PDF contains **exactly six pages**.

Pages must not be omitted simply because they contain no image artwork. Every page includes the appropriate portion of the continuous grid.

The service must preserve grid alignment across page boundaries.

The page array determines the available area. The map and grid shrink together when the requested print scale exceeds that area.

## 5. Output

The service returns a single multipage PDF.

### Filename Convention

`YYYYMMDD_HHMMSS.pdf`

Example:

`20261113_151621.pdf`

The service generates the filename timestamp in UTC.

The PDF is returned directly to the requesting client with:

- Content type: `application/pdf`
- Content disposition: attachment
- Filename: generated timestamp filename

The service does not require permanent storage of generated PDFs.

## 6. HTTP API

### POST /render

Generates a PDF.

Accepts a multipart request containing:

- `image` — JPG file, required
- `template_file` — JSON file, optional
- `template_alias` — string, optional

With no template source, the Worker uses its bundled default. When alias support is added, requests may supply at most one template source.

**Success:** HTTP 200 with PDF file response.

**Failure:** Appropriate HTTP error status with a JSON error description.

### GET /templates

Returns the available template aliases and human-readable names from the R2 template library.

### GET /templates/{alias}

Returns the JSON configuration for a specified template.

## 7. Template Library

Templates are maintained in a GitHub repository and automatically synchronized to Cloudflare R2.

**Publishing workflow:**

1. A template JSON file is added, updated, or deleted in GitHub.
2. The change is committed and pushed to the designated publishing branch.
3. GitHub Actions synchronizes the template library to R2.
4. The Worker reads the current templates directly from R2.

Updating templates does not require redeploying the Worker.

GitHub is the authoritative source; R2 is the runtime template library.

Template aliases should be stable identifiers independent of human-readable template names.

## 8. Technical Architecture

The project will use TypeScript and Cloudflare Workers.

The implementation should separate the following concerns:

**Template Loader**
- Validate uploaded JSON templates.
- Resolve R2 template aliases.
- Return normalized template configurations.

**Map Geometry Engine**
- Calculate physical image dimensions.
- Calculate grid geometry and alignment.
- Calculate printable canvas dimensions.
- Determine page boundaries and overlaps.
- Validate fit and layout.

**PDF Renderer**
- Embed the supplied image.
- Draw grid lines as PDF vector graphics where practical.
- Construct individual pages using the shared geometry calculations.
- Produce a downloadable multipage PDF.

**HTTP Service**
- Accept and validate requests.
- Enforce file-size and processing limits.
- Return PDFs or structured errors.
- Provide template discovery endpoints.

The map geometry engine should be independent of Cloudflare-specific APIs so it can be reused by other WMS components.

## 9. Scope Exclusions

The initial headless service will not include:

- Interactive image editing
- Brightness, contrast, saturation, or other color adjustments
- Image cropping, perspective correction, or rotation
- Editing history or undo/redo
- User accounts or project management
- Google Drive integration
- Persistent storage of generated PDFs
- A graphical user interface

The service is concerned exclusively with converting a prepared image and map-printing configuration into a PDF.

## 10. Initial Development Milestones

**Milestone 0 — Hello World Deployment**

1. Start the standalone `wms_ts` Git repository with `vision.md` and publish it to its own GitHub repository.
2. Add a minimal TypeScript Worker and Wrangler configuration. Verify locally that `GET /` returns HTTP 200 with the plain-text body `Hello, world!`.
3. Connect the GitHub repository to a dedicated Cloudflare Worker and deploy from `main`.
4. Verify that the deployed Worker URL returns the same response. Push a small response change to `main` and confirm that the live URL reflects it, proving the GitHub-to-Cloudflare deployment works.

**Milestone 1 — Local Headless Engine**

Accept a JPG and a local JSON template. Generate a correctly scaled multipage PDF without Cloudflare dependencies.

**Milestone 2 — Cloudflare Worker**

Deploy the engine as an HTTP service supporting direct JSON template uploads.

**Milestone 3 — R2 Template Library**

Implement template aliases, template listing, and retrieval from R2.

**Milestone 4 — GitHub Automation**

Implement GitHub Actions to synchronize the template directory to R2 without Worker redeployment.

**Milestone 5 — Validation and Compatibility**

Verify physical print scale, grid alignment, overlap, exact page counts, square/ISO grid rendering, and predictable error handling.

## 11. Success Criteria

The initial project is successful when a client can submit:

- One prepared JPG image
- One JSON template file or R2 template alias

And receive:

**One correctly scaled, multipage, print-ready PDF named using `YYYYMMDD_HHMMSS.pdf`.**

No browser interaction, image preprocessing, project history, or external file-management service is required.
