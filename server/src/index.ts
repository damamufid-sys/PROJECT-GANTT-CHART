import { createApp } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[server] REST API berjalan di http://localhost:${config.port}/api`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] Menerima ${signal}, menutup server...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
