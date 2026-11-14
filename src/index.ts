import { clip, endPath, PDFDocument, popGraphicsState, pushGraphicsState, rectangle } from "pdf-lib";
import { readTemplate } from "./template";
import { help } from "./help";
import { drawGrid } from "./grid";

function error(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/help") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return error("Use GET /help for the user guide.", 405, { Allow: "GET, HEAD" });
      }
      return new Response(request.method === "HEAD" ? null : help, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    if (pathname !== "/render") {
      return error("Route not found. See GET /help for usage.", 404);
    }
    if (request.method !== "POST") {
      return error("Use POST to upload a JPG.", 405, { Allow: "POST" });
    }
    if (!/^multipart\/form-data(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "")) {
      return error("Send a multipart/form-data request.", 415);
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return error("Could not read the multipart upload.", 400);
    }
    const images = form.getAll("image");
    const [upload] = images;
    if (images.length !== 1 || typeof upload === "string" || !upload?.size) {
      return error("Upload exactly one JPG file in the image field.", 400);
    }

    const templates = form.getAll("template_file");
    const [templateFile] = templates;
    if (form.has("template_alias")) {
      return error("This prototype accepts an uploaded template_file only.", 400);
    }
    if (templates.length !== 1 || typeof templateFile === "string" || !templateFile?.size) {
      return error("Upload exactly one JSON file in the template_file field.", 400);
    }
    let json: unknown;
    try {
      json = JSON.parse(await templateFile.text());
    } catch {
      return error("template_file must contain valid JSON.", 400);
    }
    let template;
    try {
      template = readTemplate(json);
    } catch (failure) {
      if (failure instanceof Error) return error(failure.message, 422);
      throw failure;
    }

    const { pageWidth, pageHeight, margin, rows, columns, overlap, mapWidth: requestedWidth } = template;
    const pdf = await PDFDocument.create();
    const bytes = await upload.arrayBuffer();
    let image;
    try {
      image = await pdf.embedJpg(bytes);
    } catch {
      return error("The image field must contain a readable JPG.", 422);
    }

    if (image.width <= 0 || image.height <= 0) {
      return error("The JPG has invalid dimensions.", 422);
    }
    const aspect = image.height / image.width;
    if (!Number.isFinite(requestedWidth) || requestedWidth <= 0) {
      return error("The requested scale produces invalid map dimensions.", 422);
    }
    const printableWidth = pageWidth - 2 * margin;
    const printableHeight = pageHeight - 2 * margin;
    const stepX = printableWidth - overlap;
    const stepY = printableHeight - overlap;
    const canvasWidth = printableWidth + (columns - 1) * stepX;
    const canvasHeight = printableHeight + (rows - 1) * stepY;
    const mapWidth = Math.min(requestedWidth, canvasWidth, canvasHeight / aspect);
    const mapHeight = mapWidth * aspect;
    const spacing = template.spacing * (mapWidth / requestedWidth);
    if (mapHeight <= 0 || spacing < 0.25) {
      return error("The fitted scale produces invalid dimensions or grid spacing below 0.25 PDF points.", 422);
    }
    const fittedGrid = { ...template, spacing };

    const mapLeft = (canvasWidth - mapWidth) / 2;
    const mapTop = (canvasHeight - mapHeight) / 2;
    const top = pageHeight - margin;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const sheetLeft = col * stepX;
        const sheetTop = row * stepY;
        const page = pdf.addPage([pageWidth, pageHeight]);
        page.pushOperators(pushGraphicsState(), rectangle(margin, margin, printableWidth, printableHeight), clip(), endPath());

        if (mapLeft < sheetLeft + printableWidth && mapLeft + mapWidth > sheetLeft &&
            mapTop < sheetTop + printableHeight && mapTop + mapHeight > sheetTop) {
          page.drawImage(image, {
            x: margin + mapLeft - sheetLeft,
            y: top - (mapTop - sheetTop) - mapHeight,
            width: mapWidth,
            height: mapHeight,
          });
        }

        drawGrid(page, fittedGrid, {
          x: margin - sheetLeft + mapLeft + mapWidth / 2,
          y: top + sheetTop - mapTop - mapHeight / 2,
        }, { left: margin, top, width: printableWidth, height: printableHeight });
        page.pushOperators(popGraphicsState());
      }
    }

    const iso = new Date().toISOString();
    const timestamp = iso.slice(0, 19).replace("T", "_").replace(/[-:]/g, "");
    return new Response((await pdf.save()).slice().buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${timestamp}.pdf"`,
      },
    });
  },
};
