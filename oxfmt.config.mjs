import { defineConfig } from 'oxfmt'

export default defineConfig({
  useTabs: false,
  tabWidth: 2,
  printWidth: 100,
  singleQuote: true,
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  semi: false,
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: 'lf',
  sortImports: {
    newlinesBetween: false,
  },
  sortTailwindcss: {
    stylesheet: 'src/components/layouts/global.css',
    functions: ['twMerge', 'twJoin', 'clsx'],
  },
  sortPackageJson: true,
  ignorePatterns: [
    '.agents/**',
    '.cursor/**',
    'dist/**',
    'playwright-report/**',
    'test-results/**',
    'src/routeTree.gen.ts',
  ],
})
