import next from 'eslint-config-next';

/**
 * Flat ESLint config. eslint-config-next@16 exports a native flat-config array
 * (core-web-vitals + TypeScript rules), so we spread it directly.
 */
const eslintConfig = [
  ...next,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
