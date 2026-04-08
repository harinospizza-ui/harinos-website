import express from 'express';
import cors from 'cors';
import { config } from './config';
import ordersRouter from './routes/orders';
import { isPortableSsdConfigured } from './storage/portableSsd';
import { testMysqlConnection } from './db/mysql';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    database: config.mysql.database,
    portableSsdConfigured: isPortableSsdConfigured(),
  });
});

app.use('/', ordersRouter);

const startServer = async () => {
  try {
    await testMysqlConnection();
    app.listen(config.server.port, () => {
      console.log(`Harino's backend listening on port ${config.server.port}`);
    });
  } catch (error) {
    console.error('Unable to start backend:', error);
    process.exit(1);
  }
};

void startServer();
