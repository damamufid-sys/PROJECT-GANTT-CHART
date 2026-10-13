import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { analysisRouter } from './routes/analysis.js';
import { assignmentRouter } from './routes/assignments.js';
import { authRouter } from './routes/auth.js';
import { calendarRouter } from './routes/calendar.js';
import { dependencyRouter } from './routes/dependencies.js';
import { projectRouter } from './routes/projects.js';
import { resourceRouter } from './routes/resources.js';
import { taskRouter } from './routes/tasks.js';

/** Membangun aplikasi Express lengkap (dipakai server dan test integrasi). */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', projectRouter);
  app.use('/api', taskRouter);
  app.use('/api', dependencyRouter);
  app.use('/api', resourceRouter);
  app.use('/api', assignmentRouter);
  app.use('/api', calendarRouter);
  app.use('/api', analysisRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
