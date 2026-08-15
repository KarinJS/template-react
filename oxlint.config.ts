export default {
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'warn'
  },
  rules: {
    'no-unused-vars': 'error',
    // 构建期注入的全局标记沿用打包器惯例的 __XXX__ 命名（如 __KTR_BUNDLED__）。
    'no-underscore-dangle': ['error', { allow: ['__KTR_BUNDLED__'] }]
  }
}
