import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

/** @type {import('webpack').Configuration} */
const config = {
  entry: './index.js',
  target: 'node',
  mode: 'development',
  output: {
    path: join(dirname(fileURLToPath(import.meta.url)), 'out'),
    filename: 'index.js',
  },
  resolve: {
    modules: ['vendor', 'node_modules']
  }
};

export default config;
