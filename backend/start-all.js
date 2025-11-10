import { spawn } from 'child_process';

console.log('🚀 Starting Face Media Sharing Backend...');

// Start the API server
const api = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, PROCESS_TYPE: 'api' }
});

// Start the worker
const worker = spawn('node', ['dist/workers/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, PROCESS_TYPE: 'worker' }
});

// Handle process exits
api.on('exit', (code) => {
  console.error(`❌ API server exited with code ${code}`);
  process.exit(code);
});

worker.on('exit', (code) => {
  console.error(`❌ Worker exited with code ${code}`);
  process.exit(code);
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('⏹️  Received SIGTERM, shutting down gracefully...');
  api.kill('SIGTERM');
  worker.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('⏹️  Received SIGINT, shutting down gracefully...');
  api.kill('SIGINT');
  worker.kill('SIGINT');
});

console.log('✅ API Server and Worker started successfully');
