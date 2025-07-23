import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['src/lib/**/*.js']), // ignore library folder
  {
    files: ['**/*.{js,mjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      'no-var': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { caughtErrors: 'none' }],
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'xxx', 'test'] }],
    },
  },
]);
