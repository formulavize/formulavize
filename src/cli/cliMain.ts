#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { Command, CommanderError, Option } from "commander";
import { Compiler } from "../compiler/driver";
import { CompilationError } from "../compiler/compilationErrors";
import { ExportFormat } from "../compiler/constants";
import {
  renderDagToBytes,
  type HeadlessRenderOptions,
} from "./headlessCytoscape";

function parseFormat(value: string): ExportFormat | null {
  const normalized = value.toLowerCase().replace(/^\./, "");
  switch (normalized) {
    case ExportFormat.PNG:
    case ExportFormat.JPG:
    case ExportFormat.SVG:
      return normalized as ExportFormat;
    default:
      return null;
  }
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
    .description("Render a .fiz recipe to an image")
    .usage("[options] <input.fiz>")
    .argument("<input>", "Input .fiz recipe file")
    .addOption(
      new Option(
        "-o, --output <path>",
        "Output file path (default: <input>.<format> in cwd). The extension sets the format unless --format is given.",
      ),
    )
    .addOption(
      new Option(
        "-f, --format <fmt>",
        "png | jpg | svg (default: png, or inferred from --output)",
      )
        .argParser((value: string) => value.toLowerCase().replace(/^\./, ""))
        .choices([ExportFormat.PNG, ExportFormat.JPG, ExportFormat.SVG])
        .default(ExportFormat.PNG),
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
    format: ExportFormat;
    scale?: number;
    theme?: "light" | "dark";
    descriptions?: boolean;
  }>();

  const outputFromFlag = options.output;
  let format = options.format;
  if (outputFromFlag && program.getOptionValueSource("format") !== "cli") {
    format = parseFormat(extname(outputFromFlag)) ?? format;
  }

  const outputPath =
    outputFromFlag ?? `${basename(inputPath, extname(inputPath))}.${format}`;

  const scale = options.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) {
    process.stderr.write(`Error: --scale must be a positive number\n`);
    return 1;
  }

  const renderOptions: HeadlessRenderOptions = {
    fileType: format,
    scalingFactor: scale,
    isDark: options.theme === "dark",
    includeDescriptions: options.descriptions !== false,
  };

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

  const bytes = await renderDagToBytes(compilation.DAG, renderOptions);

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
