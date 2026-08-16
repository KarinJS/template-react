import { defineTemplate } from '../../../../../../src'

export interface BrokenData {
  message: string
}

export default defineTemplate<BrokenData>({
  name: 'Broken',
  component: () => {
    throw new Error('broken component')
  }
})
