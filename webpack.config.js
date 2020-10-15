const nodeExternals = require('webpack-node-externals');

module.exports = {
  mode: 'development',
  target: 'node',
  entry: './src/index.ts',
  output: {
    path: __dirname + '/functions',
    filename: 'index.js',
    libraryTarget: 'this',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
      },
    ],
  },
  externals: [nodeExternals()]
};
