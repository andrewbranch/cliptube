import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

/** @type {import('webpack').Configuration} */
const config = {
  entry: './index.js',
  target: 'node',
  mode: 'production',
  output: {
    path: join(dirname(fileURLToPath(import.meta.url)), 'out'),
    filename: 'index.js'
  },
};

export default config;
