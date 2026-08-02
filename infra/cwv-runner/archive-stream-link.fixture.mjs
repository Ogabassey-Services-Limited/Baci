const block = 512;

const octal = (value, width) =>
  `${value.toString(8).padStart(width - 1, '0')}\0`;

function header({ linkTarget = '', name, size = 0, type = '0' }) {
  const bytes = Buffer.alloc(block);
  bytes.write(name);
  bytes.write(octal(0o644, 8), 100);
  bytes.write(octal(size, 12), 124);
  bytes[156] = type.charCodeAt(0);
  bytes.write(linkTarget, 157);
  bytes.fill(32, 148, 156);
  let checksum = 0;
  for (const value of bytes) checksum += value;
  bytes.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1');
  return bytes;
}

export function layerTar(...members) {
  const entries = members.map((member) => {
    const payload = Buffer.from(member.payload ?? '');
    const size = member.size ?? payload.length;
    const padding = Buffer.alloc(Math.ceil(size / block) * block);
    payload.copy(padding);
    return Buffer.concat([header({ ...member, size }), padding]);
  });
  return Buffer.concat([...entries, Buffer.alloc(block * 2)]);
}
