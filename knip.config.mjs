/** @type {import('knip').KnipConfig} */
const strict = process.env.KNIP_STRICT === '1'

export default {
  entry: ['src/routes/**/*.tsx', 'src/**/*.test.ts', 'tests/**/*.ts'],
  ignore: ['.agents/**'],
  // Platform binaries behind the `typescript` 7 CLI.
  ignoreDependencies: ['@typescript/typescript-*'],
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    unlisted: 'error',
    binaries: 'error',
    exports: strict ? 'error' : 'warn',
    types: strict ? 'error' : 'warn',
    enumMembers: strict ? 'error' : 'warn',
    duplicates: 'warn',
  },
}
