import mysql from 'mysql2/promise';
import { config } from '../config';

let pool: mysql.Pool | null = null;

export const getMysqlPool = (): mysql.Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      connectionLimit: 10,
    });
  }

  return pool;
};

export const testMysqlConnection = async (): Promise<void> => {
  const connection = await getMysqlPool().getConnection();
  connection.release();
};
