const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Primary entry point for Vite configuration.
 * Accepts the current mode and returns a fully-formed config object.
 */
function defineViteConfig(mode: string): UserConfig {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: getPlugins(env),
    resolve: {
      alias: resolveAlias(),
    },
    build: {
      sourcemap: mode !== 'production',
      target: 'es2017',
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  };
}

/**
 * Dynamically assemble the list of Vite plugins.
 * Supported frameworks: react, vue. Fallback to react.
 */
function getPlugins(env: Record<string, string>) {
  const framework = env.FRAMEWORK?.toLowerCase() ?? 'react';
  const plugins = [legacy({ targets: ['defaults', 'not IE 11'] })];

  switch (framework) {
    case 'vue':
      plugins.push(vue());
      break;
    case 'react':
    default:
      plugins.push(
        react({
          include: '**/*.{tsx,ts,jsx,js}',
          babel: {
            plugins: [
              [
                '@babel/plugin-transform-react-jsx',
                { runtime: 'automatic' },
              ],
            ],
          },
        }),
      );
      break;
  }

  return plugins;
}

/**
 * Standardised path aliases used across the project.
 */
function resolveAlias() {
  const rootDir = path.resolve(__dirname, 'src');
  return {
    '@': rootDir,
    '@components': path.resolve(rootDir, 'components'),
    '@utils': path.resolve(rootDir, 'utils'),
    '@types': path.resolve(__dirname, 'types'),
  };
}

export default defineConfig(({ mode }) => defineViteConfig(mode));