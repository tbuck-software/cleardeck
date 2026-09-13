import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['--test', 'test/integration.test.mjs'], {
  env: { ...process.env, RUN_SERVER_INTEGRATION: '1' },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
