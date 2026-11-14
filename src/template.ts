import { PageSizes, rgb } from "pdf-lib";
import { gridLineStyles } from "./grid";
import { applyOverrides } from "./templateOverrides";

const pageSizes = { letter: PageSizes.Letter, ledger: [792, 1224] as const };
const colors = {
  black: rgb(0, 0, 0),
  gray: rgb(0.5, 0.5, 0.5),
  white: rgb(1, 1, 1),
};

function invalid(field: string, expected: string): never {
  throw new Error(`${field} must be ${expected}.`);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalid(field, "an object");
  }
  return value as Record<string, unknown>;
}

function number(value: unknown, field: string, valid: (value: number) => boolean, expected: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || !valid(value)) {
    return invalid(field, expected);
  }
  return value;
}

function option<T extends string>(value: unknown, field: string, choices: readonly T[]): T {
  const choice = choices.find((item) => item === value);
  if (choice === undefined) return invalid(field, choices.join(" or "));
  return choice;
}

const positive = (value: number) => value > 0;
const nonnegative = (value: number) => value >= 0;
const positiveInteger = (value: number) => Number.isSafeInteger(value) && value > 0;

export function readTemplate(value: unknown, params = new URLSearchParams()) {
  const source = object(value, "template");
  if (source.schemaVersion !== 1) invalid("schemaVersion", "1");
  const { template, grid, page } = applyOverrides(source, object(source.grid, "grid"), object(source.page, "page"), params);
  if (typeof template.name !== "string" || !template.name.trim()) {
    invalid("name", "a non-empty string");
  }
  const worldWidthFeet = number(template.worldWidthFeet, "worldWidthFeet", positive, "a positive number");
  if (template.imagePlacement !== "center") invalid("imagePlacement", "center");
  const style = option(grid.style, "grid.style", ["square", "iso"]);
  let isoAngle = 90;
  if (style === "iso") {
    isoAngle = number(grid.isoAngleDegrees, "grid.isoAngleDegrees", (value) => value >= 15 && value <= 90, "between 15 and 90 degrees");
  } else if (grid.isoAngleDegrees !== null) {
    invalid("grid.isoAngleDegrees", "null for a square grid");
  }
  const rotation = number(grid.rotationDegrees, "grid.rotationDegrees", Number.isFinite, "a finite number");
  const offsetX = number(grid.offsetX, "grid.offsetX", Number.isFinite, "a finite number");
  const offsetY = number(grid.offsetY, "grid.offsetY", Number.isFinite, "a finite number");
  const inchesPerFiveFeet = number(grid.inchesPerFiveFeet, "grid.inchesPerFiveFeet", positive, "a positive number");
  const pattern = option(grid.lineStyle, "grid.lineStyle", gridLineStyles);
  const color = option(grid.color, "grid.color", ["black", "gray", "white"]);
  const thickness = number(grid.lineWidthPoints, "grid.lineWidthPoints", positive, "a positive number");
  const opacity = number(grid.opacity, "grid.opacity", (value) => value >= 0 && value <= 1, "between 0 and 1");
  if (grid.extent !== "printableCanvas") invalid("grid.extent", "printableCanvas");

  const size = option(page.size, "page.size", ["letter", "ledger"]);
  const orientation = option(page.orientation, "page.orientation", ["portrait", "landscape"]);
  const rows = number(page.rows, "page.rows", positiveInteger, "a positive integer");
  const columns = number(page.columns, "page.columns", positiveInteger, "a positive integer");
  const marginInches = number(page.marginInches, "page.marginInches", nonnegative, "a nonnegative number");
  const overlapInches = number(page.overlapInches, "page.overlapInches", nonnegative, "a nonnegative number");
  if (rows * columns > 100) throw new Error("The page array cannot exceed 100 sheets.");
  const [shortEdge, longEdge] = pageSizes[size];
  const [pageWidth, pageHeight] = orientation === "portrait" ? [shortEdge, longEdge] : [longEdge, shortEdge];
  const margin = marginInches * 72;
  if (2 * margin >= shortEdge) throw new Error("page.marginInches leaves no printable area.");
  if (overlapInches * 72 >= shortEdge - 2 * margin) {
    throw new Error("page.overlapInches must be smaller than the printable sheet dimensions.");
  }
  const spacing = inchesPerFiveFeet * 72;
  if (spacing < 0.25 || !Number.isFinite(spacing)) {
    throw new Error("grid.inchesPerFiveFeet must produce finite spacing of at least 0.25 PDF points.");
  }

  return {
    pageWidth, pageHeight, margin, spacing, rows, columns, overlap: overlapInches * 72,
    mapWidth: (worldWidthFeet / 5) * spacing,
    rotation, isoAngle, offsetX, offsetY,
    lineStyle: { thickness, color: colors[color], opacity, pattern },
  };
}
