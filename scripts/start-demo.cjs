/* eslint-disable @typescript-eslint/no-var-requires -- Standalone CommonJS Electron launcher. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const webpack = require('webpack');
const { prepareDevRuntime } = require('./dev-runtime');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.cache', 'cleardeck-demo-runtime');
fs.mkdirSync(output, { recursive: true });
const base = {
  mode: 'development',
  context: root,
  devtool: false,
  resolve: { extensions: ['.js', '.ts', '.tsx', '.json'] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: { loader: 'ts-loader', options: { transpileOnly: true } },
      },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(png|svg)$/, type: 'asset/resource' },
    ],
  },
  plugins: [new webpack.DefinePlugin({ 'process.env.GH_TOKEN': JSON.stringify('') })],
};
webpack(
  [
    {
      ...base,
      target: 'web',
      entry: './src/renderer.tsx',
      output: { path: output, filename: 'renderer.js' },
    },
    {
      ...base,
      target: 'electron-preload',
      entry: './src/preload.ts',
      output: { path: output, filename: 'preload.js' },
    },
  ],
  (error, stats) => {
    if (error || stats.hasErrors()) {
      console.error(error || stats.toString({ all: false, errors: true }));
      process.exitCode = 1;
      return;
    }
    fs.writeFileSync(
      path.join(output, 'index.html'),
      fs
        .readFileSync(path.join(root, 'src/index.html'), 'utf8')
        .replace('</body>', '<script src="./renderer.js"></script></body>'),
    );
    const runtime = prepareDevRuntime(root);
    const electron = runtime
      ? path.join(runtime, 'Electron.app', 'Contents', 'MacOS', 'Electron')
      : require('electron');
    const env = { ...process.env, CLEARDECK_DEV_SCENARIO: 'demo' };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.MOCK_UPDATE_BANNER;
    console.log('ClearDeck Demo · eigener synthetischer Bestand · Änderungen bleiben erhalten');
    const child = spawn(electron, [path.join(__dirname, 'demo-main.cjs')], {
      cwd: root,
      env,
      stdio: 'inherit',
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
    child.once('error', (error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
    child.once('exit', (code) => {
      process.exitCode = code ?? 0;
    });
  },
);
