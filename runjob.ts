function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  let configPath: string | undefined;
  let quiet = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];

    switch (token) {
      case '--config':
      case '-c':
        if (i + 1 >= args.length) {
          throw new Error('Missing value for --config');
        }
        configPath = args[i + 1];
        i += 1;
        break;

      case '--quiet':
      case '-q':
        quiet = true;
        break;

      case '--help':
      case '-h':
        showHelp = true;
        break;

      default:
        throw new Error(`Unknown argument "${token}"`);
    }
  }

  return { configPath, quiet, showHelp };
}

function printHelp(): void {
  console.log(`OmniForm Phantom ? Headless Runner

Usage:
  runjob --config <file> [options]

Options:
  -c, --config <file>   Path to job configuration JSON file
  -q, --quiet           Suppress non-error log output
  -h, --help            Show this help and exit
`);
}

/* -------------------------------------------------------------------------- */
/*  Config Loader                                                             */
/* -------------------------------------------------------------------------- */

async function loadConfig(filePath: string): Promise<JobConfig> {
  const resolved = path.resolve(process.cwd(), filePath);

  try {
    const raw = await readFile(resolved, 'utf8');
    return JSON.parse(raw) as JobConfig;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${resolved}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Configuration file is not valid JSON: ${resolved}`);
    }
    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/*  Core Job Logic (placeholder)                                              */
/* -------------------------------------------------------------------------- */

async function runHeadlessJob(
  config: JobConfig,
  quiet = false,
): Promise<void> {
  if (!quiet) {
    console.log(`Starting headless job for ${config.targetUrl}`);
  }

  // TODO: Replace placeholder with real job runner logic.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (!quiet) {
    console.log('Job completed successfully');
  }
}

/* -------------------------------------------------------------------------- */
/*  Main Entrypoint                                                           */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv);

    if (options.showHelp) {
      printHelp();
      process.exitCode = 0;
      return;
    }

    if (!options.configPath) {
      throw new Error('Configuration file not specified. Use --config <file>');
    }

    const config = await loadConfig(options.configPath);
    await runHeadlessJob(config, options.quiet);
    process.exitCode = 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  }
}

void main();