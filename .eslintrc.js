// https://eslint.org/docs/user-guide/configuring

/* global module */
module.exports = {
  extends: 'eslint:recommended',
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  ignorePatterns: ['src/lib/**/*.js'],
  rules: {
    'no-var': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': 'warn',
    'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'xxx', 'test'] }],
  },
};
