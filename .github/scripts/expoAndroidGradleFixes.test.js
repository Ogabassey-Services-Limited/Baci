const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ensureGradleProperty,
  ensureMergedJvmArgs,
  fixProguardOptimize,
} = require('./expoAndroidGradleFixes.js');

test('ensureGradleProperty: overwrites existing property', () => {
  const content = 'some.key=old_value\nanother.key=val';
  const result = ensureGradleProperty(content, 'some.key', 'new_value');
  assert.equal(result, 'some.key=new_value\nanother.key=val');
});

test('ensureGradleProperty: appends new property', () => {
  const content = 'another.key=val\n';
  const result = ensureGradleProperty(content, 'some.key', 'new_value');
  assert.equal(result, 'another.key=val\nsome.key=new_value\n');
});

test('ensureMergedJvmArgs: creates org.gradle.jvmargs if not exists', () => {
  const content = 'some.prop=value\n';
  const desiredArgs = ['-Xmx2048m', '-XX:MaxMetaspaceSize=1024m'];
  const result = ensureMergedJvmArgs(content, desiredArgs);
  assert.match(result, /org\.gradle\.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m/);
});

test('ensureMergedJvmArgs: overrides existing JVM arguments with desired values', () => {
  const content = 'org.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=512m\nsome.prop=value';
  const desiredArgs = ['-Xmx2048m', '-XX:MaxMetaspaceSize=1024m'];
  const result = ensureMergedJvmArgs(content, desiredArgs);
  assert.match(result, /org\.gradle\.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m/);
});

test('ensureMergedJvmArgs: preserves unrelated raw tokens and overrides specified ones', () => {
  const content = 'org.gradle.jvmargs=-Xmx1024m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC\nsome.prop=value';
  const desiredArgs = ['-Xmx2048m', '-XX:MaxMetaspaceSize=1024m'];
  const result = ensureMergedJvmArgs(content, desiredArgs);

  // The result should have: -Xmx2048m, -XX:MaxMetaspaceSize=1024m, and -XX:+UseG1GC
  assert.match(result, /-Xmx2048m/);
  assert.match(result, /-XX:MaxMetaspaceSize=1024m/);
  assert.match(result, /-XX:\+UseG1GC/);
});

test('ensureMergedJvmArgs: preserves repeated key-value JVM flags outside managed memory args', () => {
  const content =
    'org.gradle.jvmargs=--add-opens=java.base/java.io=ALL-UNNAMED --add-opens=java.base/java.lang=ALL-UNNAMED -Xmx1024m\n';
  const desiredArgs = ['-Xmx2048m'];
  const result = ensureMergedJvmArgs(content, desiredArgs);

  assert.match(result, /--add-opens=java\.base\/java\.io=ALL-UNNAMED/);
  assert.match(result, /--add-opens=java\.base\/java\.lang=ALL-UNNAMED/);
  assert.match(result, /-Xmx2048m/);
});

test('ensureMergedJvmArgs: replaces initial heap and metaspace values', () => {
  const content =
    'org.gradle.jvmargs=-Xms256m -XX:MetaspaceSize=256m -Xmx1024m -XX:MaxMetaspaceSize=512m\n';
  const desiredArgs = [
    '-Xms512m',
    '-XX:MetaspaceSize=384m',
    '-Xmx2048m',
    '-XX:MaxMetaspaceSize=1024m',
  ];
  const result = ensureMergedJvmArgs(content, desiredArgs);

  assert.match(result, /-Xms512m/);
  assert.match(result, /-XX:MetaspaceSize=384m/);
  assert.match(result, /-Xmx2048m/);
  assert.match(result, /-XX:MaxMetaspaceSize=1024m/);
  assert.doesNotMatch(result, /-Xms256m/);
  assert.doesNotMatch(result, /-XX:MetaspaceSize=256m/);
});

test('fixProguardOptimize: updates Proguard filename if optimize not present', () => {
  const content = 'proguardFiles getDefaultProguardFile(\'proguard-android.txt\'), \'proguard-rules.pro\'';
  const result = fixProguardOptimize(content, 'test');
  assert.equal(result, 'proguardFiles getDefaultProguardFile(\'proguard-android-optimize.txt\'), \'proguard-rules.pro\'');
});

test('fixProguardOptimize: no-op if optimize already present', () => {
  const content = 'proguardFiles getDefaultProguardFile(\'proguard-android-optimize.txt\'), \'proguard-rules.pro\'';
  const result = fixProguardOptimize(content, 'test');
  assert.equal(result, content);
});
