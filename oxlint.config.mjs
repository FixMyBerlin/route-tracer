import { defineConfig } from 'oxlint'
import reactHooksJs from 'oxlint-config-react-hooks-js/configs/recommended-latest.json' with { type: 'json' }

export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react'],
  options: { typeAware: true },
  ignorePatterns: [
    '.agents/**',
    '.cursor/**',
    'dist/**',
    'playwright-report/**',
    'test-results/**',
    'src/routeTree.gen.ts',
  ],
  rules: {
    'typescript/switch-exhaustiveness-check': 'error',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'typescript/no-non-null-assertion': 'off',
        'react/rules-of-hooks': 'off',
      },
    },
    {
      files: ['src/components/**', 'src/routes/**'],
      excludeFiles: ['**/*.test.ts', '**/*.test.tsx'],
      jsPlugins: [{ name: 'compat', specifier: 'eslint-plugin-compat' }],
      rules: {
        'compat/compat': 'error',
      },
    },
    {
      files: ['**/*.tsx'],
      jsPlugins: [{ name: 'react-hooks-js', specifier: 'eslint-plugin-react-hooks' }],
      rules: {
        ...reactHooksJs.rules,
        'react/react-compiler': 'error',
      },
    },
  ],
})
