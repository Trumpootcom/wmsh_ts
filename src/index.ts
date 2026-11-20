import { BlendMode, clip, endPath, PDFDocument, popGraphicsState, pushGraphicsState, rectangle, rgb, StandardFonts } from "pdf-lib";
import { readTemplate } from "./template";
import { help } from "./help";
import { urlHelp } from "./urlHelp";
import { drawGrid } from "./grid";
import { buildHexEdges } from "./hexGrid";
import { defaultAlias, editSavedTemplates, listSavedTemplates, loadSavedTemplate, TemplateLookupError } from "./savedTemplates";
import { templatePreview } from "./templatePreview";
import { decode } from "jpeg-js";
import { drawContrastGrid } from "./contrast";
import { workingJpeg } from "./workingImage";
import { addOverview } from "./overview";
import { drawSheetBadge } from "./sheetBadge";
import { coordinateBarStyle, drawCoordinateBorder } from "./coordinateBorder";
import { downloadDriveImage, DriveImageError, parseDriveImageUrl } from "./driveImage";

function error(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

async function hasBodyBytes(body: Request["body"]): Promise<boolean> {
  if (!body) return false;
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      if (value.byteLength > 0) {
        await reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function recordBytes(metrics: AnalyticsEngineDataset | undefined, imageBytes: number, pdfBytes: number) {
  try {
    metrics?.writeDataPoint({ doubles: [imageBytes, pdfBytes] });
  } catch (failure) {
    console.warn("Could not record render traffic metrics.", failure);
  }
}

function recordHit(metrics: AnalyticsEngineDataset | undefined, page: "render" | "help" | "urlhelp") {
  try {
    metrics?.writeDataPoint({ blobs: [page], doubles: [1] });
  } catch (failure) {
    console.warn("Could not record request hit metric.", failure);
  }
}

async function metricsPage(request: Request, analyticsSql?: AnalyticsSQLBinding, database?: D1Database): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return error("Use GET or HEAD /metrics to read metric totals.", 405, { Allow: "GET, HEAD" });
  }
  if (!analyticsSql) return error("Metrics are unavailable.", 503);

  try {
    const storedResetAt = await database?.withSession("first-primary").prepare(
      "SELECT reset_at FROM metrics_state WHERE id = 1",
    ).first<string>();
    const windowStart = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const resetAtMillis = storedResetAt ? Date.parse(storedResetAt) : Number.NaN;
    const start = new Date(Number.isFinite(resetAtMillis) && resetAtMillis > windowStart ? resetAtMillis : windowStart);
    const lastReset = Number.isFinite(resetAtMillis) && resetAtMillis > 0
      ? new Date(resetAtMillis).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })
      : "Never";
    const result = await analyticsSql.query<{
      uploaded_image_bytes: number;
      generated_pdf_bytes: number;
      average_uploaded_image_bytes: number;
      average_generated_pdf_bytes: number;
      render_hits: number;
      help_hits: number;
      urlhelp_hits: number;
    }>({
      query: `
        SELECT
          sumIf(double1, blob1 = '') AS uploaded_image_bytes,
          sumIf(double2, blob1 = '') AS generated_pdf_bytes,
          avgIf(double1, blob1 = '' AND double1 > 0) AS average_uploaded_image_bytes,
          avgIf(double2, blob1 = '' AND double2 > 0) AS average_generated_pdf_bytes,
          sumIf(double1, blob1 = 'render') AS render_hits,
          sumIf(double1, blob1 = 'help') AS help_hits,
          sumIf(double1, blob1 = 'urlhelp') AS urlhelp_hits
        FROM events.analyticsEngine."wmsh_render_traffic"
        WHERE timestamp >= $start
      `,
      params: { start: start.toISOString() },
    });
    const values = result.data[0] ?? {
      uploaded_image_bytes: 0,
      generated_pdf_bytes: 0,
      average_uploaded_image_bytes: 0,
      average_generated_pdf_bytes: 0,
      render_hits: 0,
      help_hits: 0,
      urlhelp_hits: 0,
    };
    const byteMetrics = new Set([
      "uploaded_image_kb",
      "generated_pdf_kb",
      "average_uploaded_image_kb",
      "average_generated_pdf_kb",
    ]);
    const rows: Array<[string, number]> = [
      ["uploaded_image_kb", values.uploaded_image_bytes],
      ["generated_pdf_kb", values.generated_pdf_bytes],
      ["average_uploaded_image_kb", values.average_uploaded_image_bytes],
      ["average_generated_pdf_kb", values.average_generated_pdf_bytes],
      ["render_hits", values.render_hits],
      ["help_hits", values.help_hits],
      ["urlhelp_hits", values.urlhelp_hits],
    ];
    const tableRows = rows.map(([name, value]) => {
      const divisor = byteMetrics.has(name) ? 1000 : 1;
      return `<tr><th scope="row">${name}</th><td>${Math.floor(Number(value ?? 0) / divisor).toLocaleString("en-US")}</td></tr>`;
    }).join("");
    const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>WMSH metrics</title>
<style>body{font:16px system-ui,sans-serif;max-width:44rem;margin:3rem auto;padding:0 1rem;color:#27251f}h1{font-size:1.6rem}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:.65rem .8rem;border:1px solid #ccc}thead{background:#eee}td{text-align:right;font-variant-numeric:tabular-nums}p{color:#555;font-size:.9rem}</style>
<h1>WMSH metrics</h1>
<table><thead><tr><th scope="col">Variable</th><th scope="col">Value (KB for size metrics)</th></tr></thead><tbody>${tableRows}</tbody></table>
<p>Estimated values since ${start.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })} (maximum 90 days); Analytics Engine sampling is applied.</p>
<p>Last reset: ${lastReset}</p>
<form id="reset-form"><label for="reset-password">Admin password</label> <input id="reset-password" type="password" autocomplete="current-password" required> <button type="submit">Reset counters</button> <output id="reset-result" aria-live="polite"></output></form>
<script>
sessionStorage.removeItem("metrics-reset-notice");
const resetNotice = sessionStorage.getItem("metrics-reset-notice-v2");
if (resetNotice) {
  document.getElementById("reset-result").textContent = resetNotice;
  sessionStorage.removeItem("metrics-reset-notice-v2");
}
document.getElementById("reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!window.confirm("Reset all displayed metrics to zero from now on?")) return;
  const password = document.getElementById("reset-password").value;
  const output = document.getElementById("reset-result");
  output.textContent = "Resetting…";
  try {
    const response = await fetch("/metrics/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ? result.error + " " + result.detail : result.error || "Reset failed.");
    sessionStorage.setItem("metrics-reset-notice-v2", "Reset saved. Metrics now start from " + new Date(result.resetAt).toLocaleString() + ".");
    output.textContent = "Reset saved. Reloading metrics…";
    window.setTimeout(() => window.location.reload(), 800);
  } catch (failure) {
    output.textContent = failure instanceof Error ? failure.message : "Reset failed.";
  }
});
</script>
</html>`;
    return new Response(request.method === "HEAD" ? null : html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (failure) {
    console.warn("Could not query render metrics.", failure);
    const detail = failure instanceof Error ? failure.message : String(failure);
    return Response.json({ error: "Metrics could not be loaded.", detail: detail.slice(0, 500) }, { status: 503 });
  }
}

async function resetMetrics(request: Request, database?: D1Database, secret?: string): Promise<Response> {
  if (request.method !== "POST") return error("Use POST /metrics/reset to reset counters.", 405, { Allow: "POST" });
  if (!database || !secret) return error("Metric reset is not configured.", 503);

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  if (!body || typeof body !== "object" || typeof body.password !== "string") {
    return error("Provide the admin password to reset counters.", 400);
  }
  const encoder = new TextEncoder();
  const [suppliedHash, expectedHash] = await Promise.all([body.password, secret]
    .map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const suppliedBytes = new Uint8Array(suppliedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let i = 0; i < suppliedBytes.length; i++) difference |= suppliedBytes[i] ^ expectedBytes[i];
  if (difference !== 0) return error("Incorrect admin password.", 403);

  // Analytics timestamps are second-granularity; advance the cutoff so pre-reset
  // events from the same second cannot reappear in the totals.
  const resetAt = new Date(Math.ceil(Date.now() / 1000) * 1000).toISOString();
  try {
    const session = database.withSession("first-primary");
    await session.prepare(
      "INSERT INTO metrics_state (id, reset_at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET reset_at = excluded.reset_at",
    ).bind(resetAt).run();
    const savedResetAt = await session.prepare(
      "SELECT reset_at FROM metrics_state WHERE id = 1",
    ).first<string>();
    if (savedResetAt !== resetAt) throw new Error("D1 did not return the saved reset time.");
    return Response.json({ resetAt: savedResetAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (failure) {
    console.warn("Could not reset render metrics.", failure);
    const detail = failure instanceof Error ? failure.message : String(failure);
    return Response.json({ error: "Counters could not be reset.", detail: detail.slice(0, 300) }, { status: 503 });
  }
}

export default {
  async fetch(request: Request, env?: { ASSETS?: Fetcher; RENDER_METRICS?: AnalyticsEngineDataset; ANALYTICS_SQL?: AnalyticsSQLBinding; TEMPLATES?: D1Database; TEMPLATE_PASSWORD?: string }): Promise<Response> {
    // Standalone test.html sends Origin: null when opened from disk.
    const { pathname } = new URL(request.url);
    if (pathname === "/test") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return error("Use GET or HEAD /test to retrieve the sample PDF.", 405, { Allow: "GET, HEAD" });
      }
      if (!env?.ASSETS) return error("The sample PDF is unavailable.", 503);
      return env.ASSETS.fetch(new Request(new URL("/map.pdf", request.url), { method: request.method }));
    }
    const templateRead = pathname === "/templates" || pathname.startsWith("/templates/");
    if ((pathname === "/render" || templateRead) && request.headers.get("Origin") === "null") {
      const response = request.method === "OPTIONS"
        ? new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Methods": pathname === "/templates" ? "GET, POST" : templateRead ? "GET" : "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        } })
        : await handleRequest(request, env?.RENDER_METRICS, env?.TEMPLATES, env?.TEMPLATE_PASSWORD, env?.ANALYTICS_SQL);
      response.headers.set("Access-Control-Allow-Origin", "null");
      response.headers.append("Vary", "Origin");
      return response;
    }
    return handleRequest(request, env?.RENDER_METRICS, env?.TEMPLATES, env?.TEMPLATE_PASSWORD, env?.ANALYTICS_SQL);
  },
};

async function handleRequest(request: Request, metrics?: AnalyticsEngineDataset, database?: D1Database, password?: string, analyticsSql?: AnalyticsSQLBinding): Promise<Response> {
  const { pathname, searchParams } = new URL(request.url);
  if (pathname === "/metrics") return metricsPage(request, analyticsSql, database);
  if (pathname === "/metrics/reset") return resetMetrics(request, database, password);
  if (pathname === "/help" || pathname === "/url") {
    recordHit(metrics, pathname === "/help" ? "help" : "urlhelp");
    if (request.method !== "GET" && request.method !== "HEAD") {
      return error(`Use GET ${pathname} to read the documentation.`, 405, { Allow: "GET, HEAD" });
    }
    return new Response(request.method === "HEAD" ? null : pathname === "/help" ? help : urlHelp, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const savedTemplatePath = "/templates/";
  if (pathname === "/templates" && request.method === "POST") {
    try {
      return Response.json(await editSavedTemplates(request, database, password), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (failure) {
      if (failure instanceof TemplateLookupError) return error(failure.message, failure.status);
      return error("The template change could not be saved.", 503);
    }
  }
  if (pathname === "/templates" || pathname.startsWith(savedTemplatePath)) {
    if (request.method !== "GET") {
      return error("Use GET to read saved templates.", 405, { Allow: pathname === "/templates" ? "GET, POST" : "GET" });
    }
    try {
      const headers = { "Cache-Control": "no-store" };
      if (pathname === "/templates") {
        return Response.json(await listSavedTemplates(database), { headers });
      }
      const path = pathname.slice(savedTemplatePath.length);
      const previewSuffix = "/preview.svg";
      const preview = path.endsWith(previewSuffix);
      const saved = await loadSavedTemplate(database, preview ? path.slice(0, -previewSuffix.length) : path);
      if (!preview) return Response.json(saved, { headers });
      try {
        return new Response(templatePreview(saved), {
          headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
        });
      } catch (failure) {
        if (failure instanceof Error) return error(failure.message, 422);
        throw failure;
      }
    } catch (failure) {
      if (failure instanceof TemplateLookupError) return error(failure.message, failure.status);
      throw failure;
    }
  }
  if (pathname !== "/render") {
    return error("Route not found. See GET /help for usage.", 404);
  }
  recordHit(metrics, "render");
  if (request.method !== "POST") {
    return error("Use POST with an image upload or imageUrl.", 405, { Allow: "POST" });
  }

  const imageUrls = searchParams.getAll("imageUrl");
  searchParams.delete("imageUrl");
  if (imageUrls.length > 1) return error("Specify imageUrl only once.", 400);
  const [imageUrl] = imageUrls;
  const multipart = /^multipart\/form-data(?:\s*;|$)/i.test(request.headers.get("Content-Type") ?? "");
  let form: FormData | undefined;
  if (multipart) {
    try {
      form = await request.formData();
    } catch {
      return error("Could not read the multipart upload.", 400);
    }
  } else if (await hasBodyBytes(request.body)) {
    return error("Use multipart/form-data for a request body.", 415);
  }
  const images = form?.getAll("image") ?? [];
  if (images.length && imageUrl !== undefined) {
    return error("Choose one image source: the image field or imageUrl.", 400);
  }
  const [upload] = images;
  let driveUrl: URL | undefined;
  if (imageUrl !== undefined) {
    try {
      driveUrl = parseDriveImageUrl(imageUrl);
    } catch (failure) {
      if (failure instanceof DriveImageError) return error(failure.message, failure.status);
      throw failure;
    }
  } else if (images.length !== 1 || typeof upload === "string" || !upload?.size) {
    return error("Provide imageUrl or upload exactly one JPEG, PNG, or WebP file in the image field.", 400);
  }
  if (upload instanceof File) recordBytes(metrics, upload.size, 0);

  const templates = form?.getAll("template_file") ?? [];
  const [templateFile] = templates;
  const aliases = form?.getAll("template_alias") ?? [];
  const [alias] = aliases;
  const ids = searchParams.getAll("template_id");
  const [templateId] = ids;
  searchParams.delete("template_id");
  if (ids.length > 1) return error("Specify template_id only once.", 400);
  if (Number(templates.length > 0) + Number(aliases.length > 0) + Number(ids.length > 0) > 1) {
    return error("Choose one template source: template_file, template_alias, or template_id.", 400);
  }
  if (aliases.length > 1 || (alias !== undefined && typeof alias !== "string")) {
    return error("Specify template_alias once as text.", 400);
  }
  let json: unknown;
  if (templates.length > 0) {
    if (templates.length !== 1 || typeof templateFile === "string" || !templateFile?.size) {
      return error("Upload exactly one JSON file in the template_file field.", 400);
    }
    try {
      json = JSON.parse(await templateFile.text());
    } catch {
      return error("template_file must contain valid JSON.", 400);
    }
  } else {
    try {
      json = await loadSavedTemplate(database, templateId ?? alias ?? defaultAlias, templateId !== undefined);
    } catch (failure) {
      if (failure instanceof TemplateLookupError) return error(failure.message, failure.status);
      throw failure;
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
    let source: ArrayBuffer;
    if (driveUrl) {
      source = await downloadDriveImage(driveUrl);
      recordBytes(metrics, source.byteLength, 0);
    } else if (upload instanceof File) {
      source = await upload.arrayBuffer();
    } else {
      return error("Missing image source.", 400);
    }
    bytes = await workingJpeg(source);
  } catch (failure) {
    if (failure instanceof DriveImageError) return error(failure.message, failure.status);
    return error(failure instanceof Error ? failure.message : "The image could not be converted.", 422);
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
  const hasCoordinateBorder = template.coordinates && template.style === "rect" && !template.iso && template.rotation === 0;
  const coordinateReserve = hasCoordinateBorder
    ? 2 * template.spacing * coordinateBarStyle.barThicknessRatio
    : 0;
  const mapWidth = Math.min(
    requestedWidth,
    canvasWidth - coordinateReserve,
    (canvasHeight - coordinateReserve) / aspect,
  );
  const mapHeight = mapWidth * aspect;
  if (mapWidth <= 0 || mapHeight <= 0) {
    return error("The fitted image has invalid dimensions.", 422);
  }

  const mapLeft = (canvasWidth - mapWidth) / 2;
  const mapTop = (canvasHeight - mapHeight) / 2;
  let hexEdges: ReturnType<typeof buildHexEdges> | undefined;
  if (template.style === "hex" && template.lineStyle.pattern !== "none" && template.lineStyle.opacity > 0) {
    try {
      hexEdges = buildHexEdges(template, canvasWidth, canvasHeight);
    } catch (failure) {
      if (failure instanceof Error) return error(failure.message, 422);
      throw failure;
    }
  }
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
  const coordinateFont = await pdf.embedFont(coordinateBarStyle.font);
  if (template.overview) {
    await addOverview(pdf, image, pageNumberFont, template, {
      canvasWidth, canvasHeight, mapWidth, mapHeight, mapLeft, mapTop,
      stepX, stepY, printableWidth, printableHeight,
    }, contrastSource, hexEdges);
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
          { left: mapLeft, top: mapTop, width: mapWidth, height: mapHeight }, contrastSource,
          undefined, hexEdges && { edges: hexEdges, scale: 1, x: 0, y: 0 });
      } else if (!template.adaptiveContrast && template.lineStyle.opacity > 0) {
        drawGrid(page, template, {
          x: margin - sheetLeft + mapLeft + mapWidth / 2,
          y: top + sheetTop - mapTop - mapHeight / 2,
        }, { left: margin, top, width: printableWidth, height: printableHeight },
        hexEdges && { edges: hexEdges, scale: 1, x: margin - sheetLeft, y: top + sheetTop });
      }
      page.pushOperators(popGraphicsState());
      drawSheetBadge(page, pageNumberFont, row, col, {
        left: margin, bottom: margin, width: printableWidth, height: printableHeight,
      });
      if (hasCoordinateBorder) {
        drawCoordinateBorder(page, coordinateFont, {
          pageWidth, pageHeight, margin, spacing: template.spacing,
          offsetX: template.offsetX, offsetY: template.offsetY,
          sheetLeft, sheetTop, stepX, stepY, canvasWidth, canvasHeight,
          mapLeft, mapTop, mapWidth, mapHeight, row, column: col,
        });
      }
    }
  }

  const iso = new Date().toISOString();
  const timestamp = iso.slice(0, 19).replace("T", "_").replace(/[-:]/g, "");
  const pdfBytes = (await pdf.save()).slice();
  recordBytes(metrics, 0, pdfBytes.byteLength);
  return new Response(pdfBytes.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${timestamp}.pdf"`,
    },
  });
}
