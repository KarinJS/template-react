import { defineConfig } from '../../../src'

export default defineConfig({
  dir: {
    template: 'templates',
    mockData: 'mock-data',
    out: 'dist/template',
    cssEntry: 'templates/style.css'
  }
})
