import { createTemplateRenderer } from './dist/ktr/index.mjs'

const renderer = createTemplateRenderer({ outputDir: './html/example' })

const res = await renderer('hello/list', {
  title: 'Hello, World!',
  users: [
    { name: 'Alice', role: 'Admin', score: 100 },
    { name: 'Bob', role: 'User', score: 80 }
  ]
})

console.log('Rendered image saved at:', res.success)
