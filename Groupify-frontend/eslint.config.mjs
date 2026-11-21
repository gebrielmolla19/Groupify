import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'build',
      'dist',
      'node_modules',
      'dev-dist',
      'public',
      'playwright-report',
      'test-results',
      'coverage',
      '*.config.ts',
      '*.config.js',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Colours come from the theme tokens in src/styles/globals.css (#57), so
    // both themes stay in step. Use a CSS variable (var(--iris)) or a token
    // class (text-quiet, bg-pane) instead of a colour literal.
    files: ['src/components/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b|(?<![a-zA-Z])(?:rgba?|hsla?)\\(/]',
          message:
            'Hard-coded colour. Use a theme token from globals.css (var(--x) or a token class) instead.',
        },
        {
          selector:
            'TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b|(?<![a-zA-Z])(?:rgba?|hsla?)\\(/]',
          message:
            'Hard-coded colour. Use a theme token from globals.css (var(--x) or a token class) instead.',
        },
      ],
    },
  },
  prettier
);
