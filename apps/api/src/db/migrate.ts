import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { schema, users } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://streamflow:streamflow@localhost:5432/streamflow';

  console.log('⏳ Conectando a la base de datos para ejecutar migraciones...');
  const migrationClient = postgres(connectionString, { max: 1 });
  const db = drizzle(migrationClient, { schema });

  try {
    const migrationsFolder =
      process.env.DRIZZLE_MIGRATIONS_FOLDER || path.resolve(__dirname, '../../drizzle');

    console.log(`📦 Aplicando migraciones Drizzle desde: ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('✅ Migraciones aplicadas con éxito.');

    // Bootstrap de Administrador inicial si se definieron variables de entorno
    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
    const adminName = process.env.ADMIN_NAME?.trim() || 'Admin';

    if (adminEmail && adminPassword) {
      console.log(`👤 Verificando usuario administrador inicial (${adminEmail})...`);
      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, adminEmail)
      });

      if (!existingUser) {
        console.log(`🚀 Creando usuario administrador inicial: ${adminEmail}`);
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await db.insert(users).values({
          email: adminEmail,
          passwordHash,
          name: adminName,
          role: 'admin'
        });
        console.log('✅ Usuario administrador creado con éxito.');
      } else {
        console.log('ℹ️ Usuario administrador ya existe en la base de datos.');
      }
    }
  } catch (error) {
    console.error('❌ Error aplicando migraciones o bootstrap:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Ejecutar automáticamente si es invocado directamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations();
}
