const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const reactNativeCli = path.join(
  projectRoot,
  'node_modules',
  '@react-native-community',
  'cli',
  'build',
  'bin.js',
);

// Keep Gradle's transformed Android headers on a short path so Windows Ninja
// does not hit its 260-character path limit in this deeply nested workspace.
const gradleHome = path.join(process.env.USERPROFILE || process.env.HOME, '.gradle');
const result = spawnSync(process.execPath, [reactNativeCli, 'run-android'], {
  cwd: projectRoot,
  env: { ...process.env, GRADLE_USER_HOME: gradleHome },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
