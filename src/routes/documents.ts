import { FastifyInstance } from 'fastify';
import { IngestSchema } from '../schemas';
import { documentQueue } from '../queues/documentQueue';
import { config } from '../config';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { JobType } from '../types/jobs.types';

export async function documentsRoutes(fastify: FastifyInstance) {
  // Ensure temp directory exists
  await mkdir(config.upload.tempDir, { recursive: true });

  fastify.post('/documents/ingest', async (request) => {
    const body = IngestSchema.parse(request.body);

    const job = await documentQueue.add('ingest', {
      text: body.text,
      metadata: body.metadata
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        count: 100,
        age: 3600
      },
      removeOnFail: {
        age: 604800
      }
    });

    return {
      jobId: job.id,
      message: 'Document queued for processing'
    };
  });

  fastify.post('/documents/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({
        error: 'No file uploaded'
      });
    }

    // Get file extension
    const fileExt = path.extname(data.filename).toLowerCase().slice(1);

    // Validate file type
    if (!config.upload.allowedTypes.includes(fileExt)) {
      return reply.code(400).send({
        error: `File type '${fileExt}' not supported. Allowed types: ${config.upload.allowedTypes.join(', ')}`
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const safeFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const tempFilePath = path.join(config.upload.tempDir, `${timestamp}_${safeFilename}`);

    // Save file to temp directory
    const buffer = await data.toBuffer();
    await writeFile(tempFilePath, buffer);

    // Enqueue parse job
    const job = await documentQueue.add('parse', {
      jobType: JobType.PARSE_DOCUMENT,
      filePath: tempFilePath,
      filename: data.filename,
      fileType: fileExt,
      metadata: {
        uploadedAt: new Date().toISOString(),
        originalSize: buffer.length
      }
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000
      },
      removeOnComplete: {
        count: 100,
        age: 3600
      },
      removeOnFail: {
        age: 604800
      }
    });

    return {
      jobId: job.id,
      message: 'File uploaded and queued for processing',
      filename: data.filename,
      fileType: fileExt
    };
  });
}
