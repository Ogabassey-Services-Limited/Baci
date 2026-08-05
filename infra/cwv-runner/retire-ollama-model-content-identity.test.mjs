import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('refuses deletion after a same-size model content swap with preserved mtime', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-model-content-'));
  const bin = join(directory, 'bin');
  const store = join(directory, 'models');
  const blob = join(store, 'blob');
  const receipt = join(directory, 'receipt.json');
  try {
    await Promise.all([mkdir(bin), mkdir(store)]);
    await writeFile(blob, 'AAAA');
    const fixedTime = new Date('2020-01-02T03:04:05.000Z');
    await utimes(blob, fixedTime, fixedTime);
    await writeFile(
      join(bin, 'stat'),
      '#!/bin/sh\ncase "$2" in "%u:%a") printf "0:755\\n";; "%a") printf "755\\n";; *) printf "1:2:41ed:0:0:755\\n1:3:41ed:0:0:755\\n";; esac\n'
    );
    await writeFile(
      join(bin, 'findmnt'),
      '#!/bin/sh\nprintf "/ fixture apfs ro\\n"\n'
    );
    await writeFile(
      join(bin, 'readlink'),
      '#!/bin/sh\nfor value do last=$value; done\nprintf "%s\\n" "$last"\n'
    );
    await writeFile(
      join(bin, 'sha256sum'),
      `#!${process.execPath}\nconst fs=require('node:fs'),crypto=require('node:crypto');const path=process.argv.at(-1),bytes=fs.readFileSync(path);process.stdout.write(crypto.createHash('sha256').update(bytes).digest('hex')+'  '+path+'\\n');\n`
    );
    await writeFile(
      join(bin, 'find'),
      `#!${process.execPath}\nconst fs=require('node:fs'),crypto=require('node:crypto');const a=process.argv.slice(2),root=a[0],blob=root+'/blob',s=fs.statSync(blob),stamp=(s.mtimeMs/1000).toFixed(9);if(a.includes('-type')){if(a.includes('!'))process.stdout.write('d:755:0:'+stamp+':'+root+'\\n');else{const digest=crypto.createHash('sha256').update(fs.readFileSync(blob)).digest('hex');process.stdout.write('f:644:'+s.size+':'+stamp+':'+blob+':'+digest+'  '+blob+'\\n')}}else process.stdout.write('d:755:0:'+stamp+':'+root+'\\nf:644:'+s.size+':'+stamp+':'+blob+'\\n');\n`
    );
    await writeFile(
      join(bin, 'mutate-model'),
      `#!${process.execPath}\nconst fs=require('node:fs');const path=process.argv[2],before=fs.statSync(path);fs.writeFileSync(path,'BBBB');fs.utimesSync(path,before.atime,before.mtime);\n`
    );
    await Promise.all(
      ['find', 'findmnt', 'mutate-model', 'readlink', 'sha256sum', 'stat'].map(
        (name) => chmod(join(bin, name), 0o755)
      )
    );
    const command = `. "$1"; STORE="$2"; RECEIPT="$3"; init_temp_root; trap cleanup_temp EXIT; before=$(model_identity); printf '{"scan":{"model":{"treeSha256":"%s"}}}\\n' "$before" >"$RECEIPT"; mutate-model "$STORE/blob"; if (delete_models); then die "changed model was deleted"; fi; [ -f "$STORE/blob" ] || die "changed model was removed"; printf "%s\\n" refused`;
    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        command,
        'model-content-identity-test',
        script.pathname,
        store,
        receipt,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    assert.equal(stdout, 'refused\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
