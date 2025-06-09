import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use HTTP-based connection instead of WebSocket for better stability
const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Keep pool export for backward compatibility (using the same connection)
export const pool = { query: sql };