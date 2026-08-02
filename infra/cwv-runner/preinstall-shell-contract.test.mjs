import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const allowedCommands = new Set([
  '/usr/bin/awk',
  '/usr/bin/bash',
  '/usr/bin/chmod',
  '/usr/bin/dpkg-query',
  '/usr/bin/gpgv',
  '/usr/bin/mv',
  '/usr/bin/sha256sum',
  '/usr/bin/stat',
  '/usr/bin/wc',
]);
const commandControl = /^(?:do|done|elif|else|esac|fi|if|then|until|while)$/;
const invocableBuiltin =
  /^(?::|alias|bg|bind|break|caller|cd|command|compgen|complete|compopt|continue|declare|dirs|disown|echo|enable|exit|export|false|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readonly|return|set|shift|shopt|suspend|test|times|trap|true|type|typeset|ulimit|umask|unalias|unset|wait)$/;
const commandSeparators = new Set(['\n', '&&', '||', ';', '|', '&', '(', '{']);
const redirectionOperator = /^(?:[0-9]+)?(?:<<<|<<-?|>>|<&|>&|<>|<|>)$/;
function guardedCommandWords(source, functions) {
  const commands = new Set();
  let atCommandPosition = true;
  let assignmentMayOpenArray = false;
  let arrayDepth = 0;
  let inConditional = false;
  let redirectionOperandPending = false;
  let inCaseHeader = false;
  let inForHeader = false;
  let functionNamePending = false;
  const tokens = source
    .replace(/\\\n/g, ' ')
    .matchAll(
      /#[^\n]*|\n|&&|\|\||(?:[0-9]+)?(?:<<<|<<-?|>>|<&|>&|<>|<|>)|[;|&(){}]|(?:\$'[^']*'|\$"[^"]*"|\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9@*#?$!-]|[^\s;|&(){}<>'"$]+|'[^']*'|"[^"]*")+/g
    );
  for (const match of tokens) {
    const token = match[0];
    if (arrayDepth > 0) {
      if (token === '(') arrayDepth += 1;
      if (token === ')') arrayDepth -= 1;
      continue;
    }
    if (inConditional) {
      if (token === ']]') inConditional = false;
      continue;
    }
    if (token.startsWith('#')) continue;
    if (redirectionOperandPending) {
      redirectionOperandPending = false;
      continue;
    }
    if (redirectionOperator.test(token)) {
      redirectionOperandPending = true;
      continue;
    }
    if (inCaseHeader) {
      if (token === ')') [inCaseHeader, atCommandPosition] = [false, true];
      continue;
    }
    if (inForHeader) {
      if (token === 'do') [inForHeader, atCommandPosition] = [false, true];
      continue;
    }
    if (functionNamePending) {
      functionNamePending = false;
      atCommandPosition = false;
      continue;
    }
    if (token === '(' && assignmentMayOpenArray) {
      arrayDepth = 1;
      atCommandPosition = false;
      assignmentMayOpenArray = false;
      continue;
    }
    if (commandSeparators.has(token)) {
      atCommandPosition = true;
      assignmentMayOpenArray = false;
      continue;
    }
    if (token === ')' || token === '}') atCommandPosition = false;
    if (!atCommandPosition) continue;
    const quotedOrEscaped = /[\\'"]/.test(token);
    const command = token
      .replace(/\\(.)/gs, '$1')
      .replace(
        /'([^']*)'|"([^"]*)"/g,
        (_quoted, single, double) => single ?? double
      );
    if (!quotedOrEscaped && command === 'case') {
      inCaseHeader = true;
      atCommandPosition = false;
      continue;
    }
    if (!quotedOrEscaped && (command === 'for' || command === 'select')) {
      inForHeader = true;
      atCommandPosition = false;
      continue;
    }
    if (!quotedOrEscaped && command === 'function') {
      functionNamePending = true;
      atCommandPosition = false;
      continue;
    }
    if (
      (!quotedOrEscaped && commandControl.test(command)) ||
      (!quotedOrEscaped && command === '!') ||
      (!quotedOrEscaped && command === 'command')
    )
      continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(token)) {
      assignmentMayOpenArray = token.endsWith('=');
      continue;
    }
    if (/^[0-9]*[<>]/.test(token)) continue;
    if (token === '[[') {
      inConditional = true;
      atCommandPosition = false;
      continue;
    }
    if (!invocableBuiltin.test(command) && !functions.has(command))
      commands.add(command);
    atCommandPosition = false;
  }
  return commands;
}
function externalCommands(source) {
  const commands = new Set();
  const functions = new Set(
    [...source.matchAll(/(?:^|\n)([A-Za-z_][A-Za-z0-9_]*)\(\)\s*\{/g)].map(
      (match) => match[1]
    )
  );
  const trapActions = [...source.matchAll(/\btrap\s+'([^']*)'/g)]
    .map((match) => match[1])
    .join('\n');
  const mask = (value) => value.replace(/[^\n]/g, ' ');
  const commandSubstitutions = [...source.matchAll(/\$\(([^()]*)\)/gs)]
    .map((match) => match[1])
    .join('\n');
  const executableSource = source
    .replace(/\$?\(\([^)]*\)\)/g, mask)
    .replace(/\$\([^()]*\)/g, mask);
  for (const command of guardedCommandWords(
    `${executableSource}\n${trapActions}\n${commandSubstitutions}`,
    functions
  ))
    commands.add(command);
  return commands;
}
const expectedCommands = new Map([
  [
    'verify-node-bootstrap.sh',
    new Set([
      '/usr/bin/awk',
      '/usr/bin/chmod',
      '/usr/bin/gpgv',
      '/usr/bin/mv',
      '/usr/bin/sha256sum',
      '/usr/bin/wc',
    ]),
  ],
  [
    'verify-apt-snapshot.sh',
    new Set([
      '/usr/bin/awk',
      '/usr/bin/gpgv',
      '/usr/bin/mv',
      '/usr/bin/sha256sum',
      '/usr/bin/stat',
    ]),
  ],
]);
for (const [name, expected] of expectedCommands) {
  test(`${name} uses only the frozen pre-install command authority`, () => {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8');
    assert.match(source, /^#!\/usr\/bin\/bash\n/);
    assert.match(source, /export LC_ALL=C/);
    assert.match(source, /trap cleanup EXIT/);
    assert.match(source, /trap 'cleanup; exit 1' HUP INT TERM/);
    const commands = externalCommands(source);
    assert.deepEqual(
      [...commands].filter((command) => !allowedCommands.has(command)),
      []
    );
    assert.deepEqual([...commands].sort(), [...expected].sort());
    assert.doesNotMatch(source, /\/usr\/bin\/rm/);
    assert.match(source, /temporary=\$receipt\.tmp\.\$\$/);
    assert.match(
      source,
      /cleanup\(\) \{ \[\[ -z \$temporary \]\] \|\| : >"\$temporary"; \}/
    );
    assert.match(source, /\/usr\/bin\/mv "\$temporary" "\$receipt"/);
    assert.doesNotMatch(
      source,
      /\b(?:basename|cat|cmp|cp|date|dirname|dpkg-deb|find|grep|head|jq|ldd|mktemp|readelf|realpath|sed|sort|tail|tr|uniq)\b/
    );
    assert.doesNotMatch(
      source,
      /(?:^|[;|&(){}\s])(?:command\s+)?(?:chmod|wc)(?=\s|$)/gm
    );
    assert.doesNotMatch(
      source,
      /`|\$\((?!(?:<|\(|digest\b|ordered\b|\/usr\/bin\/(?:awk|dpkg-query|sha256sum|stat|wc)\b))/
    );
  });
}
test('the frozen base-tool receipt verifier is present and colocated', () => {
  const source = readFileSync(
    new URL('verify-base-tools.sh', import.meta.url),
    'utf8'
  );
  const tests = readFileSync(
    new URL('verify-base-tools.test.mjs', import.meta.url),
    'utf8'
  );
  assert.match(source, /^#!\/usr\/bin\/bash\n/);
  assert.match(source, /ubuntu-archive-keyring\.gpg/);
  assert.match(tests, /interpreter/);
  assert.match(tests, /transitive library/);
});
test('pre-install parser detects bare, /bin, and command-prefixed authority bypasses', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        'gpgv x\n/bin/gpgv x\ncommand gpgv x\ncurl x\npython3 x'
      ),
    ].sort(),
    ['/bin/gpgv', 'curl', 'gpgv', 'python3']
  );
});
test('pre-install parser detects arbitrary command paths and redirection-adjacent words', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        './python3 true\n/opt/node/bin/node true\npython3</dev/null'
      ),
    ].sort(),
    ['./python3', '/opt/node/bin/node', 'python3']
  );
});
test('pre-install parser detects curl in same-line conditions and loops', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        'if curl --fail x; then :; elif curl --retry x; then :; fi\nwhile curl --silent x; do :; done\nuntil curl --head x; do :; done'
      ),
    ].sort(),
    ['curl']
  );
});
test('pre-install parser detects negated and assignment-prefixed condition commands', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        'if ! curl x; then :; elif X=1 wget x; then :; fi\nwhile ! python3 x; do :; done\nuntil Y=2 node x; do :; done\nif ! Z=3 ruby x; then :; fi'
      ),
    ].sort(),
    ['curl', 'node', 'python3', 'ruby', 'wget']
  );
});
test('pre-install parser ignores arithmetic and assignment-only condition words', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        "local_probe() { :; }\nif (( attempts += 1 )); then :; fi\nif SINGLE='curl'; then :; fi\nelif DOUBLE=\"python3\"; then :; fi\nwhile PLAIN=wget; do :; done\nuntil X='curl python3' local_probe; do :; done"
      ),
    ],
    []
  );
});
test('pre-install parser refuses quoted, indirect, and command-invoking words', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        `'python3' true\n"python3" true\nif 'python3' true; then :; fi\ncmd=python3; "$cmd" true; \${cmd} true\nexec python3\neval python3\nsource /tmp/payload\nbuiltin exec python3\n'if' true\n"if" true\n'case' true`
      ),
    ].sort(),
    `$cmd \${cmd} builtin case eval exec if python3 source`.split(' ')
  );
  assert.deepEqual(
    [
      ...externalCommands(
        `\\python3 true\nif ! \\curl true; then :; fi\nif X=1 \\/usr/bin/python3 true; then :; fi\npyt\\hon3 true\n\\if true\n\\while true`
      ),
    ].sort(),
    ['/usr/bin/python3', 'curl', 'if', 'python3', 'while']
  );
});
test('pre-install parser ignores quoted arguments and assignment values', () => {
  assert.deepEqual(
    [
      ...externalCommands(
        `local_probe() { :; }\nprintf '%s' 'python3' '/usr/bin/python3' pyt\\hon3 \\/usr/bin/python3\nSINGLE='python3'\nDOUBLE="python3"\nBRACED=\${DOUBLE}\nESCAPED=pyt\\hon3\nprintf '%s' \${BRACED}\nif test "$DOUBLE" = 'python3'; then local_probe "python3"; fi\nif true; then :; fi\nwhile false; do :; done\ncase x in x) : ;; esac`
      ),
    ],
    []
  );
});
