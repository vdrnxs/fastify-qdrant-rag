import { FastifyInstance } from 'fastify';
import { fileTrackerService } from '../services/fileTrackerService';
import { z } from 'zod';

const addFolderSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  recursive: z.boolean().optional(),
  scanPattern: z.string().optional()
});

const scanFolderSchema = z.object({
  folderId: z.string()
});

export async function folderRoutes(fastify: FastifyInstance) {
  // Listar folders monitorizados
  fastify.get('/folders', async (request, reply) => {
    try {
      const folders = await fileTrackerService.listMonitoredFolders();
      return reply.send({
        success: true,
        data: folders
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Agregar folder monitorizado
  fastify.post('/folders', async (request, reply) => {
    try {
      const body = addFolderSchema.parse(request.body);

      const folderId = await fileTrackerService.addMonitoredFolder(
        body.path,
        body.name,
        {
          recursive: body.recursive,
          scanPattern: body.scanPattern
        }
      );

      return reply.status(201).send({
        success: true,
        data: { id: folderId }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors
        });
      }

      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Escanear un folder específico
  fastify.post('/folders/scan', async (request, reply) => {
    try {
      const body = scanFolderSchema.parse(request.body);

      const stats = await fileTrackerService.scanFolder(body.folderId);

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.errors
        });
      }

      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Escanear todos los folders
  fastify.post('/folders/scan-all', async (request, reply) => {
    try {
      const results = await fileTrackerService.scanAllFolders();

      return reply.send({
        success: true,
        data: results
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Activar folder
  fastify.post('/folders/:id/activate', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await fileTrackerService.activateFolder(id);

      return reply.send({
        success: true,
        message: 'Folder activated'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Desactivar folder
  fastify.post('/folders/:id/deactivate', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await fileTrackerService.deactivateFolder(id);

      return reply.send({
        success: true,
        message: 'Folder deactivated'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Obtener archivos pendientes
  fastify.get('/folders/pending-files', async (request, reply) => {
    try {
      const { limit } = request.query as { limit?: string };
      const files = await fileTrackerService.getPendingFiles(
        limit ? parseInt(limit) : 10
      );

      return reply.send({
        success: true,
        data: files
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
