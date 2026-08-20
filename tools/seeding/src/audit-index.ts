#!/usr/bin/env -S node --import tsx
/**
 * S3 pre-flight CLI — audits `official_url` quality across the master index (see `audit.ts` for
 * why, and for the classifier the verdicts come from). No LLM calls; no writes to the API.
 *
 *   pnpm --dir tools/seeding audit-index                    # whole index -> audit-report.csv
 *   pnpm --dir tools/seeding audit-index --limit 50         # the top 50 by rank only
 *   pnpm --dir tools/seeding audit-index --out probe.csv --concurrency 4
 */
import { writeFile } from 'node:fs/promises';
import { DEFAULT_CONCURRENCY, runAudit, summarize, toCsv } from './audit.ts';
import { resolveInputs } from './input.ts';

const DEFAULT_INDEX = '../../docs/seeding/master-index.csv';
const DEFAULT_OUT = 'audit-report.csv';

interface Args {
  index: string;
  out: string;
  limit?: number;
  concurrency: number;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    index: DEFAULT_INDEX,
    out: DEFAULT_OUT,
    concurrency: DEFAULT_CONCURRENCY,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--index':
        args.index = required(argv[++i], '--index');
        break;
      case '--out':
        args.out = required(argv[++i], '--out');
        break;
      // A malformed count is a hard error, not a silently ignored NaN (matches index.ts).
      case '--limit':
        args.limit = positiveInt(argv[++i], '--limit');
        break;
      case '--concurrency':
        args.concurrency = positiveInt(argv[++i], '--concurrency');
        break;
      default:
        throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function required(value: string | undefined, flag: string): string {
  if (!value) throw new Error(`${flag} needs a value`);
  return value;
}

function positiveInt(raw: string | undefined, flag: string): number {
  if (raw === undefined || !/^\d+$/.test(raw) || Number.parseInt(raw, 10) < 1) {
    throw new Error(`${flag} must be a positive integer (got ${raw ?? 'nothing'})`);
  }
  return Number.parseInt(raw, 10);
}

const USAGE = `S3 pre-flight — audit official_url quality across the master index.

  --index <path>        CSV to audit (default: ${DEFAULT_INDEX})
  --out <path>          report CSV to write (default: ${DEFAULT_OUT})
  --limit <n>           audit only the first n rows (rank order)
  --concurrency <n>     parallel fetches (default: ${DEFAULT_CONCURRENCY})

Verdicts: PROGRAM (extract as-is) · THIN (glance at it) · HOMEPAGE (find a better URL)
          UNREACHABLE (dead, blocked, or not HTML). They are triage, not truth.
`;

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const items = await resolveInputs({ batch: args.index, limit: args.limit });
  process.stderr.write(
    `auditing ${items.length} URLs from ${args.index} (${args.concurrency} at a time)…\n`,
  );

  const rows = await runAudit(items, {
    concurrency: args.concurrency,
    onProgress: (done, total) => {
      if (done % 25 === 0 || done === total) process.stderr.write(`  …${done}/${total}\n`);
    },
  });

  await writeFile(args.out, toCsv(rows), 'utf8');
  process.stdout.write(`${summarize(rows)}\n\nfull report: ${args.out}\n`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
