import { PageSizes, PDFDocument, rgb } from "pdf-lib";

const pointsPerInch = 72;
const margin = pointsPerInch / 4;
const [pageWidth, pageHeight] = PageSizes.Letter;
const mapWidth = 8 * pointsPerInch;

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

    const pdf = await PDFDocument.create();
    const bytes = await upload.arrayBuffer();
    let image;
    try {
      image = await pdf.embedJpg(bytes);
    } catch {
      return error("The image field must contain a readable JPG.", 422);
    }

    const mapHeight = (mapWidth * image.height) / image.width;
    if (!Number.isFinite(mapHeight) || mapHeight <= 0) {
      return error("The JPG has invalid dimensions.", 422);
    }
    if (mapHeight > pageHeight - 2 * margin) {
      return error("The JPG is too tall for Letter at the fixed 8-inch print width.", 422);
    }

    const page = pdf.addPage(PageSizes.Letter);
    page.drawImage(image, {
      x: (pageWidth - mapWidth) / 2,
      y: (pageHeight - mapHeight) / 2,
      width: mapWidth,
      height: mapHeight,
    });

    const right = pageWidth - margin;
    const top = pageHeight - margin;
    const lineStyle = { thickness: 0.5, color: rgb(0, 0, 0), opacity: 0.6 };
    for (let x = margin; x <= right; x += pointsPerInch) {
      page.drawLine({ start: { x, y: margin }, end: { x, y: top }, ...lineStyle });
    }
    for (let y = top; y >= margin; y -= pointsPerInch) {
      page.drawLine({ start: { x: margin, y }, end: { x: right, y }, ...lineStyle });
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
