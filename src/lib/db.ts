import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || "email_platform",
  password: process.env.DB_PASSWORD || "",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
});

async function initTables() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS email_lists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description VARCHAR(500) NOT NULL DEFAULT '',
        created_at VARCHAR(50) NOT NULL DEFAULT ''
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL DEFAULT '',
        list_id INT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        token VARCHAR(255) NOT NULL DEFAULT '',
        gdpr_consent BOOLEAN NOT NULL DEFAULT FALSE,
        subscribed_at VARCHAR(50) NOT NULL DEFAULT '',
        verified_at VARCHAR(50) NOT NULL DEFAULT '',
        INDEX idx_subscribers_list_id (list_id),
        INDEX idx_subscribers_email (email),
        INDEX idx_subscribers_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL DEFAULT '',
        list_id INT NOT NULL,
        template TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        scheduled_at VARCHAR(50) NOT NULL DEFAULT '',
        sent_at VARCHAR(50) NOT NULL DEFAULT '',
        sent_count INT NOT NULL DEFAULT 0,
        created_at VARCHAR(50) NOT NULL DEFAULT '',
        INDEX idx_campaigns_list_id (list_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    conn.release();
  }
}

const _init = initTables().catch(console.error);

export const db = drizzle(pool, { schema, mode: "default" });
export { _init as dbReady };
