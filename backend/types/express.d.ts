import { Database } from 'sqlite3';

declare module 'express-serve-static-core' {
  interface Request {
    db: Database;
    user?: { email: string };
  }
}
