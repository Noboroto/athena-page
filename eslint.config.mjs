import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', '.astro', 'public', 'plans', '.husky/_', '.serena'] },
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    plugins: { 'eslint-comments': eslintComments },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'eslint-comments/no-unlimited-disable': 'error',
      'eslint-comments/require-description': 'error',
    },
  },
);
