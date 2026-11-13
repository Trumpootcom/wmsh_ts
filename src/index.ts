import { clip, endPath, PDFDocument, popGraphicsState, pushGraphicsState, rectangle } from "pdf-lib";
import { readTemplate } from "./template";

function error(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname !== "/render") {
      return error("Route not found. Use POST /render.", 404);
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

    const { pageWidth, pageHeight, margin, spacing, mapWidth, rotation, offsetX, offsetY, lineStyle } = template;
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
    const mapHeight = mapWidth * (image.height / image.width);
    if (mapWidth <= 0 || mapHeight <= 0) {
      return error("The requested scale produces invalid map dimensions.", 422);
    }
    const printableWidth = pageWidth - 2 * margin;
    const printableHeight = pageHeight - 2 * margin;
    if (mapWidth > printableWidth || mapHeight > printableHeight) {
      return error("The JPG does not fit on the printable sheet at the requested scale.", 422);
    }

    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, {
      x: (pageWidth - mapWidth) / 2,
      y: (pageHeight - mapHeight) / 2,
      width: mapWidth,
      height: mapHeight,
    });

    const top = pageHeight - margin;
    const angle = (rotation % 360) * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const diagonal = Math.hypot(printableWidth, printableHeight);
    page.pushOperators(pushGraphicsState(), rectangle(margin, margin, printableWidth, printableHeight), clip(), endPath());
    // Grid offsets follow the rotated axes from the printable area's top-left corner.
    for (const { x, y, offset } of [{ x: cos, y: -sin, offset: offsetX }, { x: -sin, y: -cos, offset: offsetY }]) {
      const widthProjection = printableWidth * x;
      const heightProjection = -printableHeight * y;
      const low = Math.min(0, widthProjection) + Math.min(0, heightProjection);
      const high = Math.max(0, widthProjection) + Math.max(0, heightProjection);
      const phase = offset % 1;
      for (let i = Math.ceil(low / spacing - phase); i <= Math.floor(high / spacing - phase); i++) {
        const distance = (i + phase) * spacing;
        const centerX = margin + distance * x;
        const centerY = top + distance * y;
        page.drawLine({
          start: { x: centerX - diagonal * y, y: centerY + diagonal * x },
          end: { x: centerX + diagonal * y, y: centerY - diagonal * x },
          ...lineStyle,
        });
      }
    }
    page.pushOperators(popGraphicsState());

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
