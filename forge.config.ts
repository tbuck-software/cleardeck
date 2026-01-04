import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const shouldUseFuses = process.env.SKIP_FUSES !== '1';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'cleardeck',
    icon: './assets/icon',
    extraResource: ['./assets/app-update.yml'],
    osxSign: {
      identity: '-', // ad-hoc signing to satisfy macOS Gatekeeper
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin', 'win32']),
    new MakerDMG({}),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    ...(shouldUseFuses
      ? [
          new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            // OnlyLoadAppFromAsar must be false for Squirrel.Windows updates to work
            // Squirrel.exe needs to create temporary files outside the ASAR during updates
            [FuseV1Options.OnlyLoadAppFromAsar]: false,
          }),
        ]
      : []),
  ],
  hooks: {
    postPackage: async (_forgeConfig, options) => {
      if (options.platform !== 'darwin') {
        return;
      }

      const packageAppName =
        // forge <=7.3 exposes appName, newer exposes packageJSON
        (options as any).appName ||
        options.packageJSON?.productName ||
        options.packageJSON?.name ||
        undefined;

      const appPaths =
        options.packagePaths?.flatMap((packagePath) => {
          if (packagePath.endsWith('.app')) {
            return [packagePath];
          }

          const base =
            packageAppName ||
            path.basename(packagePath, path.extname(packagePath));

          // electron-packager usually puts the .app inside the output directory
          return [path.join(packagePath, `${base}.app`)];
        }) ?? [];

      if (appPaths.length === 0) {
        return;
      }

      for (const appPath of appPaths) {
        if (!existsSync(appPath)) {
          continue;
        }

        // Deep ad-hoc sign the bundle so electron-updater can validate it
        execSync(`codesign --force --deep --sign - "${appPath}"`, {
          stdio: 'inherit',
        });
      }
    },
  },
};

export default config;
