#!/usr/bin/env -S node --import tsx
/**
 * S3 — AI-assisted extraction pipeline v0 (CLI entry).
 *
 *   fetch official page -> LLM extract Spine + attributes -> validate (schema + spine sanity)
 *   -> score confidence -> POST into the R1-3 import-review queue (or --dry-run to just print).
 *
 * See README.md for env vars and the S4 human-review handoff.
 */
import { loadConfig } from './config.ts';
import { resolveInputs } from './input.ts';
import { runItem, type ItemReport, type RunOptions } from './pipeline.ts';

interface Args extends RunOptions {
  input?: string;
  batch?: string;
  limit?: number;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, offline: false, allowPrivate: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--offline':
        args.offline = true;
        break;
      case '--allow-private':
        args.allowPrivate = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--input':
        args.input = argv[++i];
        break;
      case '--batch':
        args.batch = argv[++i];
        break;
      case '--limit': {
        const raw = argv[++i];
        // L4: a malformed limit is a hard error, not a silently ignored NaN.
        if (raw === undefined || !/^\d+$/.test(raw) || Number.parseInt(raw, 10) < 1) {
          throw new Error(`--limit must be a positive integer (got ${raw ?? 'nothing'})`);
        }
        args.limit = Number.parseInt(raw, 10);
        break;
      }
      default:
        throw new Error(`unknown argument: ${a} (try --help)`);
    }
  }
  return args;
}

const HELP = `S3 extraction pipeline v0

Usage:
  tsx src/index.ts --input <url|file.html> [--dry-run] [--offline]
  tsx src/index.ts --batch <file.csv|file.txt> [--limit N] [--dry-run] [--offline]

Options:
  --input <src>    A single competition: an http(s) URL to fetch, or a local .html file.
  --batch <file>   Many competitions: a .csv with a URL column, or a .txt of one URL per line.
  --limit N        Process at most N items from the batch (positive integer).
  --dry-run        Extract + validate + PRINT the payload. Never POSTs to the import queue.
  --offline        Force the offline stub extractor (sibling <name>.expected.json), no LLM call.
                   (Also implied automatically when ANTHROPIC_API_KEY is unset.)
  --allow-private  Permit fetching private/loopback/link-local addresses (off by default — SSRF guard).
  -h, --help       Show this help.

Env (see .env.example): ANTHROPIC_API_KEY, ANTHROPIC_MODEL, BEECOMPETE_API_BASE, ADMIN_API_TOKEN.
Without ANTHROPIC_API_KEY the tool runs offline (stub extractor) so --dry-run works in CI.
`;

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!args.input && !args.batch) {
    process.stderr.write('nothing to do: pass --input or --batch (see --help)\n');
    return 2;
  }

  const config = loadConfig();
  const forcedOffline = args.offline || !config.anthropicApiKey;
  const opts: RunOptions = {
    dryRun: args.dryRun,
    offline: forcedOffline,
    allowPrivate: args.allowPrivate,
  };

  const items = await resolveInputs(args);
  if (items.length === 0) {
    process.stderr.write('no items resolved from input\n');
    return 2;
  }

  process.stderr.write(
    `S3 pipeline: ${items.length} item(s) · backend=${forcedOffline ? 'stub(offline)' : 'anthropic'} · ${
      args.dryRun ? 'dry-run' : 'SUBMIT'
    }\n`,
  );

  const reports: ItemReport[] = [];
  for (const item of items) {
    const report = await runItem(item, config, opts);
    reports.push(report);
    printReport(report);
  }

  const failed = reports.filter((r) => r.outcome === 'error' || r.outcome === 'invalid').length;
  process.stderr.write(
    `\nDone: ${reports.length} processed, ${failed} needing attention (invalid/error).\n`,
  );
  return failed > 0 ? 1 : 0;
}

function printReport(r: ItemReport): void {
  const banner = `\n=== ${r.source} → ${r.outcome.toUpperCase()}${
    r.confidence !== undefined ? ` (confidence ${r.confidence.toFixed(2)})` : ''
  } ===`;
  process.stdout.write(`${banner}\n`);
  if (r.message) process.stdout.write(`${r.message}\n`);
  if (r.errors.length) {
    process.stdout.write(`validation errors:\n${r.errors.map((e) => `  - ${e}`).join('\n')}\n`);
  }
  if (r.warnings.length) {
    process.stdout.write(`warnings:\n${r.warnings.map((w) => `  - ${w}`).join('\n')}\n`);
  }
  if (r.reviewerNotes) {
    // M1: the model's uncertainty notes reach the human, instead of being silently dropped.
    process.stdout.write(`reviewer notes: ${r.reviewerNotes}\n`);
  }
  if (r.submission && (r.outcome === 'dry-run' || r.outcome === 'invalid')) {
    process.stdout.write(`${JSON.stringify(r.submission, null, 2)}\n`);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
