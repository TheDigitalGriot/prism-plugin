import https from 'node:https';
import fs from 'node:fs';

/** Download a file with progress callbacks and cancellation support */
export async function downloadFile(options: {
  url: string;
  destPath: string;
  onProgress: (downloaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const { url, destPath, onProgress, signal } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Download cancelled'));
      return;
    }

    const makeRequest = (requestUrl: string, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }

      const req = https.get(requestUrl, {
        headers: { 'User-Agent': 'prism-setup/2.4.6' },
        timeout: 30000,
      }, (res) => {
        // Follow redirects (GitHub Releases redirect to CDN)
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          const location = res.headers.location;
          if (location) {
            res.resume(); // drain the response
            makeRequest(location, redirectCount + 1);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }

        const total = parseInt(res.headers['content-length'] ?? '0', 10);
        let downloaded = 0;

        const fileStream = fs.createWriteStream(destPath);

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          onProgress(downloaded, total);
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {}); // cleanup partial file
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error('Download timed out'));
      });

      // Handle cancellation
      if (signal) {
        const onAbort = () => {
          req.destroy();
          fs.unlink(destPath, () => {});
          reject(new Error('Download cancelled'));
        };
        signal.addEventListener('abort', onAbort, { once: true });
      }
    };

    makeRequest(url);
  });
}
