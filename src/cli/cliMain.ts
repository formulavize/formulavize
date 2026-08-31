#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { Command, CommanderError, Option } from "commander";
import { Compiler } from "../compiler/driver";
import { CompilationError } from "../compiler/compilationErrors";
import {
  ExportFormat,
  RendererRegistry,
  type HeadlessRenderOptions,
} from "../rendererApi";
import { headlessRendererDescriptors } from "../renderers/headlessRenderers";

// Every format some headless renderer can write. Derived rather than listed so
// a renderer bringing a format of its own needs no change here.
const KNOWN_FORMATS: ExportFormat[] = [
  ...new Set(
    headlessRendererDescriptors.flatMap(
      (descriptor) => descriptor.supportedExportFormats,
    ),
  ),
];

function parseFormat(value: string): ExportFormat | null {
  const normalized = value.toLowerCase().replace(/^\./, "");
  return KNOWN_FORMATS.includes(normalized) ? normalized : null;
}

function formatError(error: CompilationError): string {
  const { from, to } = error.position;
  const location = from === to ? `@${from}` : `@${from}-${to}`;
  return `  [${error.severity}] ${error.source} ${location}: ${error.message}`;
}

function createProgram(): Command {
  const program = new Command();
  program
    .name("fviz")
    .description("Render a .fiz recipe to a file")
    .usage("[options] <input.fiz>")
    .argument("<input>", "Input .fiz recipe file")
    .addOption(
      new Option(
        "-o, --output <path>",
        "Output file path (default: <input>.<format> in cwd). The extension sets the format unless --format is given.",
      ),
    )
    .addOption(
      // No default: leaving it unset is what lets the resolved renderer pick.
      new Option(
        "-f, --format <fmt>",
        `${KNOWN_FORMATS.join(" | ")} (default: inferred from --output, ` +
          `else the renderer's own default)`,
      )
        .argParser((value: string) => value.toLowerCase().replace(/^\./, ""))
        .choices(KNOWN_FORMATS),
    )
    .addOption(
      new Option(
        "-s, --scale <number>",
        "Scaling factor; 1 == the app's 100% (default: 1)",
      ).argParser((value: string) => Number(value)),
    )
    .addOption(
      new Option("--theme <mode>", "light | dark")
        .choices(["light", "dark"])
        .default("light"),
    )
    .option("--no-descriptions", "Do not render node/edge description text")
    .helpOption("-h, --help", "Show this help")
    .showHelpAfterError();

  return program;
}

async function main(): Promise<number> {
  const program = createProgram();
  program.exitOverride();

  try {
    await program.parseAsync();
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    throw error;
  }

  const [inputPath] = program.args;

  const options = program.opts<{
    output?: string;
    format?: ExportFormat;
    scale?: number;
    theme?: "light" | "dark";
    descriptions?: boolean;
  }>();

  const outputFromFlag = options.output;

  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) {
    process.stderr.write(`Error: --scale must be a positive number\n`);
    return 1;
  }

  let source: string;
  try {
    source = await readFile(inputPath, "utf8");
  } catch {
    process.stderr.write(`Error: cannot read input file "${inputPath}"\n`);
    return 1;
  }

  const compilation = await new Compiler().compileFromSource(source);

  const errors = compilation.Errors;
  if (errors.length > 0) {
    process.stderr.write(`Compilation reported ${errors.length} issue(s):\n`);
    for (const error of errors) process.stderr.write(formatError(error) + "\n");
    if (errors.some((error) => error.severity === "error")) return 1;
  }

  // The recipe's own '^<name>{ }' directive picks the renderer, exactly as it
  // does in the app. A renderer that needs a browser resolves here as well, so
  // that asking for one is reported rather than quietly drawn by another.
  const registry = new RendererRegistry(headlessRendererDescriptors);
  const renderer = registry.resolveFor(compilation.DAG);
  if (!renderer?.renderHeadless) {
    const name = renderer?.name ?? "none";
    process.stderr.write(
      `Error: renderer "${name}" cannot render outside a browser\n`,
    );
    return 1;
  }

  // Which renderer is drawing decides what an unflagged run writes, so this
  // waits on the resolution above: a recipe that draws as text should not have
  // to say so twice.
  const format =
    options.format ??
    (outputFromFlag ? parseFormat(extname(outputFromFlag)) : null) ??
    renderer.supportedExportFormats[0];

  if (!renderer.supportedExportFormats.includes(format)) {
    process.stderr.write(
      `Error: renderer "${renderer.name}" cannot write ${format} ` +
        `(supports: ${renderer.supportedExportFormats.join(", ")})\n`,
    );
    return 1;
  }

  const outputPath =
    outputFromFlag ?? `${basename(inputPath, extname(inputPath))}.${format}`;

  const renderOptions: HeadlessRenderOptions = {
    fileType: format,
    scalingFactor: scale,
    isDark: options.theme === "dark",
    includeDescriptions: options.descriptions !== false,
  };

  const bytes = await renderer.renderHeadless(compilation.DAG, renderOptions);

  await writeFile(outputPath, bytes);
  process.stdout.write(`Wrote ${outputPath} (${bytes.length} bytes)\n`);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`Error: ${error?.message ?? error}\n`);
    process.exitCode = 1;
  });
