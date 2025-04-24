import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: "../../../.env" });

const {
  MYSQL_HOST = "localhost",
  MYSQL_PORT = "3306",
  MYSQL_USER = "root",
  MYSQL_PASSWORD = "",
  MYSQL_DATABASE = "test",
} = process.env;

export const db = mysql.createPool({
  host: MYSQL_HOST,
  port: Number(MYSQL_PORT),
  user: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});

const connectToDatabase = async () => {
  try {
    const connection = await db.getConnection();

    console.log("✅ Connected to MySQL!");
    return connection;
  } catch (err) {
    console.error("❌ Failed to connect to MySQL:", err);
    return null;
  }
};

connectToDatabase();
