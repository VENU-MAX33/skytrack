import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDb(): Promise<void> {
  try {
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB connected: ${env.mongodbUri}`);
  } catch (err) {
    console.error(
      [
        '',
        `Could not connect to MongoDB at ${env.mongodbUri}`,
        '',
        'Fix one of the following and restart:',
        '  1. Local MongoDB: install with `winget install MongoDB.Server`',
        '     and make sure the "MongoDB" Windows service is running.',
        '  2. MongoDB Atlas (free tier): create a cluster at https://www.mongodb.com/atlas',
        '     and set MONGODB_URI in backend/.env to your connection string.',
        '',
        `Underlying error: ${(err as Error).message}`,
      ].join('\n')
    );
    process.exit(1);
  }
}
