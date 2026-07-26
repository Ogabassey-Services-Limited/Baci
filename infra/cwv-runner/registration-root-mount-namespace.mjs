const TOKEN = '/run/secrets/runner-registration-token';
const fail = () => {
  throw new TypeError('registration inspection refused');
};

export function verifyRegistrationTokenMount(bytes, present) {
  if (!Buffer.isBuffer(bytes)) fail();
  const count = bytes
    .toString('utf8')
    .split('\n')
    .filter((row) => row.split(' ')[4] === TOKEN).length;
  if (count !== (present ? 1 : 0)) fail();
}
