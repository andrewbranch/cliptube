import webpack from 'webpack';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

/** @type {import('webpack').Configuration} */
const config = {
  entry: './index.js',
  target: 'node',
  mode: 'production',
  output: {
    path: join(dirname(fileURLToPath(import.meta.url)), 'out'),
    filename: 'index.js',
  },
  resolve: {
    modules: ['vendor', 'node_modules']
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(/@npmcli\/(run-script|git)/, 'uuid'),
  ],
  externals: {
    'ytdl-core': 'commonjs2 ytdl-core',
  },
};

export default config;
