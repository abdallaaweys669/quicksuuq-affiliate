import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SHOP = 'quicksuuq-test.myshopify.com';
const TOKEN = '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';
const THEME_ID = 196285956462;

const IMAGES = [
  {
    input: 'C:/Users/abdal/.gemini/antigravity/brain/0bd00364-c338-4663-9185-3f93c65d1c49/.user_uploaded/media_1794208603904_8a953441.jpg',
    filename: 'quicksuuq-hero-slide-1-v2.png',
    alt: 'QuickSuuq delivery courier holding fresh groceries',
    skipBottomCenter: true
  }
];

async function removeOuterBlackBg(inputPath, outputPath, skipBottomCenter = false) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const isBg = new Uint8Array(width * height);

  // Check if a pixel is near-black background
  function isNearBlack(idx) {
    const r = data[idx * 4];
    const g = data[idx * 4 + 1];
    const b = data[idx * 4 + 2];
    const maxC = Math.max(r, g, b);
    return maxC <= 18;
  }

  // BFS flood fill from borders
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  function pushIfBg(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    if (skipBottomCenter && y > height - 45 && x >= 320 && x <= 820) return;
    const i = y * width + x;
    if (visited[i]) return;
    visited[i] = 1;
    if (isNearBlack(i)) {
      isBg[i] = 1;
      queue[tail++] = i;
    }
  }

  for (let x = 0; x < width; x++) {
    pushIfBg(x, 0);
    if (!skipBottomCenter || x < 320 || x > 820) {
      pushIfBg(x, height - 1);
    }
  }
  for (let y = 0; y < height; y++) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = (curr / width) | 0;
    pushIfBg(cx + 1, cy);
    pushIfBg(cx - 1, cy);
    pushIfBg(cx, cy + 1);
    pushIfBg(cx, cy - 1);
  }

  // Apply transparency and soft edge anti-aliasing next to background pixels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (isBg[i]) {
        data[i * 4 + 3] = 0;
      } else {
        // Check if adjacent to background for smooth feathering
        let adjBg = 0;
        if (x > 0 && isBg[i - 1]) adjBg++;
        if (x < width - 1 && isBg[i + 1]) adjBg++;
        if (y > 0 && isBg[i - width]) adjBg++;
        if (y < height - 1 && isBg[i + width]) adjBg++;
        if (adjBg > 0) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const brightness = Math.max(r, g, b);
          if (brightness < 45) {
            data[i * 4 + 3] = Math.round((brightness / 45) * 200);
          }
        }
      }
    }
  }

  const outBuf = await sharp(data, {
    raw: { width, height, channels: 4 }
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(outputPath, outBuf);
  return outBuf;
}

async function uploadThemeAsset(filename, buf) {
  const res = await fetch(`https://${SHOP}/admin/api/2025-01/themes/${THEME_ID}/assets.json`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN
    },
    body: JSON.stringify({
      asset: {
        key: `assets/${filename}`,
        attachment: buf.toString('base64')
      }
    })
  });
  const data = await res.json();
  console.log(`Uploaded theme asset assets/${filename}:`, res.status, data.asset?.public_url || '');
  return data.asset?.public_url;
}

async function uploadToShopifyFiles(filename, buf, alt) {
  // 1. stagedUploadsCreate
  const gqlRes1 = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN
    },
    body: JSON.stringify({
      query: `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters { name value }
            }
            userErrors { field message }
          }
        }
      `,
      variables: {
        input: [
          {
            filename,
            mimeType: 'image/png',
            httpMethod: 'POST',
            resource: 'IMAGE'
          }
        ]
      }
    })
  });
  const stagedData = await gqlRes1.json();
  const target = stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) {
    console.warn('stagedUploadsCreate failed:', JSON.stringify(stagedData));
    return null;
  }

  const form = new FormData();
  for (const p of target.parameters) {
    form.append(p.name, p.value);
  }
  form.append('file', new Blob([buf], { type: 'image/png' }), filename);

  const upRes = await fetch(target.url, { method: 'POST', body: form });
  console.log(`Staged upload for ${filename}:`, upRes.status);

  // 2. fileCreate
  const gqlRes2 = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN
    },
    body: JSON.stringify({
      query: `
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              alt
              ... on MediaImage {
                image { url }
              }
            }
            userErrors { field message }
          }
        }
      `,
      variables: {
        files: [
          {
            alt,
            contentType: 'IMAGE',
            originalSource: target.resourceUrl
          }
        ]
      }
    })
  });
  const fileData = await gqlRes2.json();
  console.log(`fileCreate for ${filename}:`, JSON.stringify(fileData.data?.fileCreate || fileData.errors));
  return fileData.data?.fileCreate?.files?.[0];
}

async function run() {
  for (const item of IMAGES) {
    const outPath = path.join('..', item.filename);
    console.log(`Processing ${item.filename}...`);
    const buf = await removeOuterBlackBg(item.input, outPath, item.skipBottomCenter);
    await uploadThemeAsset(item.filename, buf);
    await uploadToShopifyFiles(item.filename, buf, item.alt);
  }
}

run().catch(console.error);
