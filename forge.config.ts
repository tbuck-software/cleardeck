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
import { signMacBundles } from './scripts/sign-mac-bundles';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import { productName, version } from './package.json';

const shouldUseFuses = process.env.SKIP_FUSES !== '1';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'cleardeck',
    icon: './assets/icon',
    extraResource: ['./assets/app-update.yml'],
    osxSign: {
      identity: process.env.MAC_SIGN_IDENTITY || '-',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({ setupExe: `${productName}-${version}-Setup.exe` }),
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
      signMacBundles(options, {
        identity: process.env.MAC_SIGN_IDENTITY,
        requireDeveloperId: process.env.CI === 'true',
      });
    },
  },
};

export default config;
