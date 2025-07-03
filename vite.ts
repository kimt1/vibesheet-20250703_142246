const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const createBasePlugins = (): PluginOption[] => [
  dts({
    insertTypesEntry: true,
    skipDiagnostics: false,
    outputDir: 'dist/types',
  }),
  viteStaticCopy({
    targets: [
      { src: 'locales/**', dest: 'locales' },
      { src: 'assets/**', dest: 'assets' },
    ],
  }),
];

// Instantiate plugins once to avoid duplicate work/race conditions
const basePlugins = createBasePlugins();

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  const extensionConfig = defineConfig({
    plugins: [
      ...basePlugins,
      crx({ manifest: resolve(__dirname, 'src/manifest.json') }),
    ],
    build: {
      outDir: 'dist/extension',
      emptyOutDir: true,
      minify: isProd ? 'esbuild' : false,
      sourcemap: !isProd,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/extension/background.ts'),
          content: resolve(__dirname, 'src/extension/content.ts'),
          popup: resolve(__dirname, 'src/extension/popup/index.html'),
        },
      },
    },
  });

  const cliConfig = defineConfig({
    plugins: basePlugins,
    build: {
      target: 'node18',
      outDir: 'dist/cli',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/cli/index.ts'),
        formats: ['cjs'],
        fileName: () => 'omniform-phantom.cjs',
      },
      minify: false,
      rollupOptions: {
        external: [...builtinModules, /node:.*/],
        output: { exports: 'named' },
      },
    },
  });

  return [extensionConfig, cliConfig];
});