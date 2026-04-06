import https from 'node:https';
import type { ReleaseAsset } from '../types';

const REPO = 'TheDigitalGriot/prism-plugin';
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

type GitHubRelease = {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
};

/** Fetch the latest release from GitHub */
export async function getLatestRelease(): Promise<{ version: string; assets: ReleaseAsset[] }> {
  return new Promise((resolve, reject) => {
    const req = https.get(API_URL, {
      headers: {
        'User-Agent': 'prism-setup/2.4.6',
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          https.get(location, {
            headers: { 'User-Agent': 'prism-setup/2.4.6', 'Accept': 'application/vnd.github.v3+json' },
          }, handleResponse).on('error', reject);
          return;
        }
      }
      handleResponse(res);

      function handleResponse(response: typeof res) {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          try {
            if (response.statusCode !== 200) {
              reject(new Error(`GitHub API returned ${response.statusCode}`));
              return;
            }
            const release: GitHubRelease = JSON.parse(data);
            const version = release.tag_name.replace(/^v/, '');
            const assets: ReleaseAsset[] = release.assets.map(a => ({
              name: a.name,
              browser_download_url: a.browser_download_url,
              size: a.size,
            }));
            resolve({ version, assets });
          } catch (err) {
            reject(err);
          }
        });
      }
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('GitHub API request timed out'));
    });
  });
}

/** Compare two semver strings. Returns comparison result. */
export function compareVersions(
  current: string,
  latest: string,
): 'up-to-date' | 'update-available' | 'newer-than-latest' {
  const parse = (v: string) => {
    const parts = v.replace(/^v/, '').split('.').map(Number);
    return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
  };

  const c = parse(current);
  const l = parse(latest);

  if (c.major > l.major) return 'newer-than-latest';
  if (c.major < l.major) return 'update-available';
  if (c.minor > l.minor) return 'newer-than-latest';
  if (c.minor < l.minor) return 'update-available';
  if (c.patch > l.patch) return 'newer-than-latest';
  if (c.patch < l.patch) return 'update-available';
  return 'up-to-date';
}
