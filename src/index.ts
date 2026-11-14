import { BlendMode, clip, endPath, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts } from "pdf-lib";
import { readTemplate } from "./template";
import { help } from "./help";
import { urlHelp } from "./urlHelp";
import { drawGrid } from "./grid";
import defaultTemplate from "./default.json";
import { decode } from "jpeg-js";
import { drawContrastGrid } from "./contrast";
import { workingJpeg } from "./workingImage";
import { addOverview } from "./overview";
import { drawSheetBadge } from "./sheetBadge";

function error(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    // Standalone test.html sends Origin: null when opened from disk.
    if (new URL(request.url).pathname === "/render" && request.headers.get("Origin") === "null") {
      const response = request.method === "OPTIONS"
        ? new Response(null, { status: 204, headers: { "Access-Control-Allow-Methods": "POST" } })
        : await handleRequest(request);
      response.headers.set("Access-Control-Allow-Origin", "null");
      response.headers.append("Vary", "Origin");
      return response;
    }
    return handleRequest(request);
  },
};

async function handleRequest(request: Request): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);
  if (pathname === "/help" || pathname === "/url") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return error(`Use GET ${pathname} to read the documentation.`, 405, { Allow: "GET, HEAD" });
    }
    return new Response(request.method === "HEAD" ? null : pathname === "/help" ? help : urlHelp, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (pathname !== "/render") {
    return error("Route not found. See GET /help for usage.", 404);
  }
  if (request.method !== "POST") {
    return error("Use POST to upload a JPEG, PNG, or WebP.", 405, { Allow: "POST" });
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
    return error("Upload exactly one JPEG, PNG, or WebP file in the image field.", 400);
  }

  const templates = form.getAll("template_file");
  const [templateFile] = templates;
  if (form.has("template_alias")) {
    return error("Template aliases are unavailable. Upload a template_file or use the built-in default.", 400);
  }
  let json: unknown = defaultTemplate;
  if (templates.length > 0) {
    if (templates.length !== 1 || typeof templateFile === "string" || !templateFile?.size) {
      return error("Upload exactly one JSON file in the template_file field.", 400);
    }
    try {
      json = JSON.parse(await templateFile.text());
    } catch {
      return error("template_file must contain valid JSON.", 400);
    }
  }
  let template;
  try {
    template = readTemplate(json, searchParams);
  } catch (failure) {
    if (failure instanceof Error) return error(failure.message, 422);
    throw failure;
  }

  const { pageWidth, pageHeight, margin, rows, columns, overlap, mapWidth: requestedWidth } = template;
  const pdf = await PDFDocument.create();
  let bytes: Uint8Array;
  try {
    bytes = await workingJpeg(await upload.arrayBuffer());
  } catch (failure) {
    return error(failure instanceof Error ? failure.message : "The uploaded image could not be converted.", 422);
  }
  let image;
  try {
    image = await pdf.embedJpg(bytes);
  } catch {
    return error("The working JPEG is unreadable.", 422);
  }

  if (image.width <= 0 || image.height <= 0) {
    return error("The image has invalid dimensions.", 422);
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
  if (mapWidth <= 0 || mapHeight <= 0) {
    return error("The fitted image has invalid dimensions.", 422);
  }

  const mapLeft = (canvasWidth - mapWidth) / 2;
  const mapTop = (canvasHeight - mapHeight) / 2;
  const top = pageHeight - margin;
  let contrastSource;
  if (template.adaptiveContrast && template.lineStyle.pattern !== "none" && template.lineStyle.opacity > 0) {
    try {
      contrastSource = decode(bytes, {
        useTArray: true, formatAsRGBA: false, maxResolutionInMP: 12, maxMemoryUsageInMB: 80,
      });
    } catch {
      return error("Contrast mode needs a decodable JPG within its 12-megapixel and decoder memory limits.", 422);
    }
  }

  const pageNumberFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  if (template.overview) {
    await addOverview(pdf, image, pageNumberFont, template, {
      canvasWidth, canvasHeight, mapWidth, mapHeight, mapLeft, mapTop,
      stepX, stepY, printableWidth, printableHeight,
    }, contrastSource);
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const sheetLeft = col * stepX;
      const sheetTop = row * stepY;
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.pushOperators(pushGraphicsState(), rectangle(margin, margin, printableWidth, printableHeight), clip(), endPath());

      if (template.lineStyle.blendMode === BlendMode.Difference && template.lineStyle.pattern !== "none") {
        // Difference needs an opaque backdrop even where the JPG does not reach.
        page.drawRectangle({
          x: margin, y: margin, width: printableWidth, height: printableHeight,
          color: rgb(1, 1, 1),
        });
      }

      if (mapLeft < sheetLeft + printableWidth && mapLeft + mapWidth > sheetLeft &&
          mapTop < sheetTop + printableHeight && mapTop + mapHeight > sheetTop) {
        page.drawImage(image, {
          x: margin + mapLeft - sheetLeft,
          y: top - (mapTop - sheetTop) - mapHeight,
          width: mapWidth,
          height: mapHeight,
        });
      }

      if (contrastSource) {
        drawContrastGrid(pdf, page, template,
          { x: canvasWidth / 2, y: canvasHeight / 2 },
          { left: sheetLeft, top: sheetTop, width: printableWidth, height: printableHeight },
          { left: mapLeft, top: mapTop, width: mapWidth, height: mapHeight }, contrastSource);
      } else if (!template.adaptiveContrast) {
        drawGrid(page, template, {
          x: margin - sheetLeft + mapLeft + mapWidth / 2,
          y: top + sheetTop - mapTop - mapHeight / 2,
        }, { left: margin, top, width: printableWidth, height: printableHeight });
      }
      page.pushOperators(popGraphicsState());
      drawSheetBadge(page, pageNumberFont, row, col, {
        left: margin, bottom: margin, width: printableWidth, height: printableHeight,
      });
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
}
