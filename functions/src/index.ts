import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { generateSDKHandler } from './handlers/generate-sdk';

admin.initializeApp();

const app = express();

// Middleware
app.use(cors({ origin: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SDK generation endpoint
app.post('/generate', generateSDKHandler);

// Export the API
export const api = functions.https.onRequest(app);
