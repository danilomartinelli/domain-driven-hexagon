/**
 * ESLint v9 Flat Config
 * Migrated from .eslintrc.js
 * https://eslint.org/docs/latest/use/configure/configuration-files
 */

const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = tseslint.config(
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts'],
    plugins: {
      prettier: prettierPlugin,
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',
      
      // Custom overrides
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      
      // Handle legacy rules
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'warn',

      // TS errors
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': 'error',

      // Eslint off
      'import/extensions': 'off',
      'import/prefer-default-export': 'off',
      'class-methods-use-this': 'off',
      'no-useless-constructor': 'off',
      'import/no-unresolved': 'off',
      'no-control-regex': 'off',
      'no-shadow': 'off',
      'import/no-cycle': 'off',
      'consistent-return': 'off',
      'no-underscore-dangle': 'off',
      'max-classes-per-file': 'off',

      // Eslint errors
      'no-restricted-syntax': [
        'error',
        {
          selector: 'LabeledStatement',
          message:
            'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
        },
        {
          selector: 'WithStatement',
          message:
            '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
        },
        {
          selector: "MethodDefinition[kind='set']",
          message: 'Property setters are not allowed',
        },
      ],
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      globals: {
        module: true,
        require: true,
        __dirname: true,
      },
    },
  }
);