import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Asegurar que el directorio de datos existe
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './data/tracking.db';
const db = new Database(dbPath);
const adapter = new PrismaBetterSqlite3(db);

export const prisma = new PrismaClient({ adapter });

// Asegurar que la conexión se cierra correctamente
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
