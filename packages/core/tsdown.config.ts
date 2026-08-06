import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    client: 'src/client.ts',
    index: 'src/index.ts',
    runtime: 'src/runtime/index.ts',
    cli: 'src/cli/index.ts',
    'registry-types': 'src/registry-types.ts'
  },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  dts: true,
  clean: true,
  sourcemap: false,
  deps: {
    neverBundle: ['react', 'react-dom', 'react-dom/server', '@karinjs/template-react/registry-types'],
    onlyBundle: false
  },
  outDir: 'dist',
  treeshake: true
})
