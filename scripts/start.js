const { spawn } = require('child_process');
const os = require('os');

// Calculate memory limits based on available system memory
const systemMemory = os.totalmem();
const memoryLimit = Math.min(
  Math.floor(systemMemory * 0.75 / 1024 / 1024), // 75% of system memory in MB
  8192 // Max 8GB
);

// Node.js flags for optimized production performance
const nodeFlags = [
  `--max-old-space-size=${memoryLimit}`,
  '--optimize-for-size',
  '--gc-interval=100',
  '--max-semi-space-size=128'
];

// Environment-specific settings
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  nodeFlags.push('--inspect'); // Enable debugging in development
}

// Start the application
const tsNode = spawn(
  'node',
  [
    ...nodeFlags,
    '-r',
    'ts-node/register',
    'server.ts'
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TS_NODE_TRANSPILE_ONLY: isDev ? undefined : 'true'
    }
  }
);

tsNode.on('error', (err) => {
  console.error('Failed to start process:', err);
  process.exit(1);
});

process.on('SIGTERM', () => {
  tsNode.kill('SIGTERM');
});

process.on('SIGINT', () => {
  tsNode.kill('SIGINT');
});
