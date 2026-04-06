import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

// TODO Phase 10: add electron-forge-maker-nsis for Windows NSIS installer
// import MakerNSIS from 'electron-forge-maker-nsis';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: [
      './resources/binaries',
      './resources/extensions',
      './resources/plugin',
    ],
  },
  rebuildConfig: {},
  makers: [
    // TODO Phase 10: replace with MakerNSIS for Windows
    new MakerZIP({}, ['win32']),
    new MakerDMG({
      contents: [
        { x: 130, y: 220, type: 'file' },
        { x: 410, y: 220, type: 'link', path: '/Applications' },
      ],
    }),
    new MakerZIP({}, ['linux']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
