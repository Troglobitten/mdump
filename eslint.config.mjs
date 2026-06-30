import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/*.config.js',
      '**/*.config.ts',
      'client/public/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  // Vue: correctness rules only ('essential'); formatting is handled by Prettier
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    rules: {
      // TypeScript already resolves identifiers, so no-undef is redundant and
      // produces false positives for browser/node globals.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'vue/multi-word-component-names': 'off',
    },
  },
];
