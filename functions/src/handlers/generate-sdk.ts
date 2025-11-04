import { Request, Response } from 'express';
import Busboy from 'busboy';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs-extra';
import archiver from 'archiver';
import { generateSDKFromBuffer } from '../services/sdk-generator';

interface GenerateOptions {
  moduleName?: string;
  baseURL?: string;
}

export async function generateSDKHandler(req: Request, res: Response) {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const busboy = Busboy({ headers: req.headers });

  let fileBuffer: Buffer | null = null;
  let fileName = 'openapi.yaml';
  let options: GenerateOptions = {};

  // Handle file upload
  busboy.on('file', (fieldname, file, info) => {
    const { filename, mimeType } = info;
    fileName = filename;

    const chunks: Buffer[] = [];
    file.on('data', (chunk) => {
      chunks.push(chunk);
    });

    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
    });
  });

  // Handle form fields
  busboy.on('field', (fieldname, value) => {
    if (fieldname === 'moduleName') {
      options.moduleName = value;
    } else if (fieldname === 'baseURL') {
      options.baseURL = value;
    }
  });

  // Handle finish
  busboy.on('finish', async () => {
    try {
      if (!fileBuffer) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      console.log(`Processing file: ${fileName}`);
      console.log(`Options:`, options);

      // Generate SDK
      const zipBuffer = await generateSDKFromBuffer(
        fileBuffer,
        fileName,
        options.moduleName || 'api',
        options.baseURL
      );

      // Send the zip file
      const sdkFileName = `${options.moduleName || 'api'}-sdk.zip`;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${sdkFileName}"`);
      res.send(zipBuffer);

      console.log('SDK generated and sent successfully');
    } catch (error) {
      console.error('Error generating SDK:', error);
      res.status(500).json({
        error: 'Failed to generate SDK',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Handle errors
  busboy.on('error', (error) => {
    console.error('Busboy error:', error);
    res.status(500).json({ error: 'File upload error' });
  });

  req.pipe(busboy);
}
