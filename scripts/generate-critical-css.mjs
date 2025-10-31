import { generate } from 'critical';
import { writeFile, mkdir } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

const a = async () => {
  const files = await glob('./.next/server/app/**/*.html');
  const promises = files.map(async (file) => {
    const css = await generate({
      base: '.next',
      src: file,
      rebase: (asset) => `/_next/${asset.url}`,
      width: 1300,
      height: 900,
    });
    const dir = path.dirname(file).replace('.next/server/app', 'src/app');
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/critical.css`, css, 'utf8');
  });
  await Promise.all(promises);
};

a();
