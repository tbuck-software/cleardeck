// @vitest-environment node

import fs from 'fs';
import os from 'os';
import path from 'path';
import webpack from 'webpack';
import { describe, expect, it, vi } from 'vitest';

const compileFixture = (
  root: string,
  configuredPlugins: NonNullable<webpack.Configuration['plugins']>,
): Promise<string> => new Promise((resolve, reject) => {
  const outputPath = path.join(root, 'dist', 'bundle.js');
  const compiler = webpack({
    context: root,
    mode: 'none',
    target: 'node',
    entry: './fixture.js',
    output: { path: path.dirname(outputPath), filename: path.basename(outputPath) },
    plugins: configuredPlugins,
    optimization: { minimize: false },
    devtool: false,
  });

  compiler.run((error, stats) => {
    compiler.close((closeError) => {
      if (error || closeError) {
        reject(error ?? closeError);
        return;
      }
      if (!stats || stats.hasErrors()) {
        reject(new Error(stats?.toString({ all: false, errors: true }) || 'Webpack compilation failed.'));
        return;
      }
      resolve(fs.readFileSync(outputPath, 'utf8'));
    });
  });
});

describe('webpack runtime environment access', () => {
  it('does not embed GH_TOKEN while retaining the runtime lookup', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleardeck-webpack-'));
    const sentinel = 'ghp_build_fixture_sentinel_that_must_not_ship';
    const previousToken = process.env.GH_TOKEN;
    process.env.GH_TOKEN = sentinel;

    try {
      fs.writeFileSync(
        path.join(root, 'fixture.js'),
        'module.exports = () => process.env.GH_TOKEN || "";\n',
      );
      // Give ForkTsCheckerWebpackPlugin an isolated, empty project. The fixture
      // itself is JavaScript, so type-checking is not part of this assertion.
      fs.writeFileSync(
        path.join(root, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { allowJs: true, checkJs: false }, include: ['fixture.js'] }),
      );

      vi.resetModules();
      const { plugins } = await import('../../webpack.plugins');
      const bundle = await compileFixture(root, plugins);

      expect(bundle).not.toContain(sentinel);
      expect(bundle).toContain('process.env.GH_TOKEN');
    } finally {
      if (previousToken === undefined) delete process.env.GH_TOKEN;
      else process.env.GH_TOKEN = previousToken;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
