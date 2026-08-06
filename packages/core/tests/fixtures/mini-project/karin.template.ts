import { defineConfig } from '../../../src'

export default defineConfig({
  templateDir: 'templates',
  mockDataDir: 'mock-data',
  outDir: 'dist/template',
  cssEntry: 'templates/style.css'
})
