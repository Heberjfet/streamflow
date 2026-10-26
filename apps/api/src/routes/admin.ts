import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import os from 'os';
import { sql, eq } from 'drizzle-orm';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSettings } from '../services/settings.service.js';
import { AVAILABLE_ENCODERS } from '../db/schema.js';

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'warning';
  latencyMs: number;
  details: string;
  metadata?: Record<string, unknown>;
}

export interface ServicesStatus {
  api: ServiceHealth;
  database: ServiceHealth;
  redis: ServiceHealth;
  s3: ServiceHealth;
  worker: ServiceHealth;
}

export interface AuditItem {
  id: string;
  timestamp: string;
  actor: {
    id?: string;
    name: string;
    email?: string;
    role?: string;
    isSystem?: boolean;
  };
  action: string;
  actionLabel: string;
  resource: {
    type: 'asset' | 'user' | 'system';
    id: string;
    title: string;
  };
  status: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  metadata?: Record<string, unknown>;
}

export interface HostMetrics {
  uptime: number;
  platform: string;
  arch: string;
  release: string;
  cpus: {
    cores: number;
    model: string;
    speedMHz: number;
    loadAvg: [number, number, number];
    loadAvgPercent: number;
    usagePercent: number;
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    totalMB: number;
    freeMB: number;
    usedMB: number;
    usedPercent: number;
  };
}

export interface ProcessMetrics {
  uptime: number;
  pid: number;
  nodeVersion: string;
  cpuUsage: {
    userMicroseconds: number;
    systemMicroseconds: number;
    userSeconds: number;
    systemSeconds: number;
    usagePercent: number;
  };
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    heapUsedPercent: number;
  };
}

interface StatsResponse {
  totalAssets: number;
  totalUsers: number;
  totalViews: number;
  serverTime: string;
  serverTimezone: string;
  assetsByStatus: Record<string, number>;
  recentAssets: Array<{
    id: string;
    title: string;
    status: string;
    views: number;
    createdAt: string;
  }>;
  queueStats: {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
    workersCount: number;
  };
  storageStats: {
    totalDurationSeconds: number;
    readyCount: number;
    failedCount: number;
    processingCount: number;
    successRate: number;
  };
  services: ServicesStatus;
  host: HostMetrics;
  process: ProcessMetrics;
  systemInfo: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    cpuUsage: {
      user: number;
      system: number;
    };
    host: HostMetrics;
    process: ProcessMetrics;
    serverTime: string;
    serverTimezone: string;
  };
}

interface CpuSnapshot {
  timestamp: number;
  hostTotal: number;
  hostIdle: number;
  processCpu: NodeJS.CpuUsage;
}

function getCpuSnapshot(): CpuSnapshot {
  const cpus = os.cpus();
  let hostTotal = 0;
  let hostIdle = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      hostTotal += (cpu.times as any)[type];
    }
    hostIdle += cpu.times.idle;
  }
  return {
    timestamp: Date.now(),
    hostTotal,
    hostIdle,
    processCpu: process.cpuUsage()
  };
}

let lastCpuSnapshot: CpuSnapshot = getCpuSnapshot();
let currentHostCpuPercent = 0;
let currentProcessCpuPercent = 0;

function sampleCpu() {
  const nowSnapshot = getCpuSnapshot();
  const deltaMs = nowSnapshot.timestamp - lastCpuSnapshot.timestamp;
  if (deltaMs >= 400) {
    const dTotal = nowSnapshot.hostTotal - lastCpuSnapshot.hostTotal;
    const dIdle = nowSnapshot.hostIdle - lastCpuSnapshot.hostIdle;
    if (dTotal > 0) {
      currentHostCpuPercent = Math.max(0, Math.min(100, Math.round(((dTotal - dIdle) / dTotal) * 1000) / 10));
    }

    const dUser = nowSnapshot.processCpu.user - lastCpuSnapshot.processCpu.user;
    const dSys = nowSnapshot.processCpu.system - lastCpuSnapshot.processCpu.system;
    const dProcessMicros = dUser + dSys;
    const deltaMicros = deltaMs * 1000;
    if (deltaMicros > 0) {
      const cpusCount = Math.max(1, os.cpus().length);
      const rawProcessPercent = (dProcessMicros / deltaMicros) * 100;
      currentProcessCpuPercent = Math.max(0, Math.min(100, Math.round((rawProcessPercent / cpusCount) * 10) / 10));
    }

    lastCpuSnapshot = nowSnapshot;
  }
}

// Muestreador en segundo plano para métricas instantáneas sin latencia en la petición
setInterval(sampleCpu, 2000).unref();

async function checkServices(fastify: FastifyInstance): Promise<ServicesStatus> {
  // 1. API
  const apiMem = process.memoryUsage();
  const apiHealth: ServiceHealth = {
    name: 'API Fastify',
    status: 'healthy',
    latencyMs: 0,
    details: `Uptime: ${Math.round(process.uptime())}s | RSS: ${Math.round(apiMem.rss / 1024 / 1024)} MB`,
    metadata: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid,
      memoryRssMb: Math.round(apiMem.rss / 1024 / 1024),
      heapUsedMb: Math.round(apiMem.heapUsed / 1024 / 1024)
    }
  };

  // 2. Base de Datos (PostgreSQL)
  const dbStart = Date.now();
  let dbStatus: 'healthy' | 'down' = 'healthy';
  let dbDetails = 'Conexión activa (PostgreSQL 16)';
  try {
    await fastify.db.execute(sql`SELECT 1 as ping`);
  } catch (err: unknown) {
    dbStatus = 'down';
    dbDetails = (err as Error)?.message || 'Error de conexión con la base de datos';
  }
  const dbLatencyMs = Date.now() - dbStart;
  const dbHealth: ServiceHealth = {
    name: 'PostgreSQL',
    status: dbStatus,
    latencyMs: dbLatencyMs,
    details: dbDetails
  };

  // 3. Redis
  const redisStart = Date.now();
  let redisStatus: 'healthy' | 'down' = 'healthy';
  let redisDetails = 'Conexión activa (Redis 7)';
  try {
    const pong = await fastify.redis.ping();
    if (pong !== 'PONG') {
      redisStatus = 'down';
      redisDetails = `Respuesta inesperada: ${pong}`;
    }
  } catch (err: unknown) {
    redisStatus = 'down';
    redisDetails = (err as Error)?.message || 'Error de conexión con Redis';
  }
  const redisLatencyMs = Date.now() - redisStart;
  const redisHealth: ServiceHealth = {
    name: 'Redis',
    status: redisStatus,
    latencyMs: redisLatencyMs,
    details: redisDetails
  };

  // 4. S3 (SeaweedFS)
  const s3Start = Date.now();
  let s3Status: 'healthy' | 'down' = 'healthy';
  let s3Details = `Bucket: ${fastify.s3Config.bucket}`;
  try {
    await fastify.s3.send(new HeadBucketCommand({ Bucket: fastify.s3Config.bucket }));
  } catch (err: unknown) {
    s3Status = 'down';
    s3Details = (err as Error)?.message || 'Error al conectar con SeaweedFS S3';
  }
  const s3LatencyMs = Date.now() - s3Start;
  const s3Health: ServiceHealth = {
    name: 'SeaweedFS (S3)',
    status: s3Status,
    latencyMs: s3LatencyMs,
    details: s3Details,
    metadata: {
      bucket: fastify.s3Config.bucket,
      endpoint: fastify.s3Config.endpoint
    }
  };

  // 5. Worker (BullMQ)
  const workerStart = Date.now();
  let workerStatus: 'healthy' | 'warning' | 'down' = 'healthy';
  let workerDetails = 'Worker activo y procesando';
  let workersCount = 0;
  let jobCounts = { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 };
  try {
    const workers = await fastify.transcodeQueue.getWorkers();
    workersCount = workers.length;
    const counts = await fastify.transcodeQueue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed');
    jobCounts = {
      active: counts.active || 0,
      waiting: counts.waiting || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0
    };
    if (workersCount === 0) {
      workerStatus = 'warning';
      workerDetails = 'Cola accesible, pero sin workers registrados';
    } else {
      workerDetails = `${workersCount} worker(s) escuchando cola "video-processing"`;
    }
  } catch (err: unknown) {
    workerStatus = 'down';
    workerDetails = (err as Error)?.message || 'Error al consultar cola BullMQ';
  }
  const workerLatencyMs = Date.now() - workerStart;
  const workerHealth: ServiceHealth = {
    name: 'Worker BullMQ',
    status: workerStatus,
    latencyMs: workerLatencyMs,
    details: workerDetails,
    metadata: {
      workersCount,
      ...jobCounts
    }
  };

  return {
    api: apiHealth,
    database: dbHealth,
    redis: redisHealth,
    s3: s3Health,
    worker: workerHealth
  };
}

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify() as { userId: string; email: string; role: 'admin' | 'editor' | 'viewer'; name?: string };
      request.currentUser = {
        userId: decoded.userId,
        email: decoded.email,
        name: decoded.name || '',
        role: decoded.role
      };
    } catch (err) {
      fastify.log.error({ err }, 'JWT verify failed');
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (request.currentUser?.role !== 'admin') {
      return reply.status(403).send({ error: 'Forbidden - Admin only' });
    }
  });

  fastify.get('/stats', async (_request, reply) => {
    try {
      const assetsResult = await fastify.db.execute(sql`SELECT COUNT(*) as count FROM assets`);
      const usersResult = await fastify.db.execute(sql`SELECT COUNT(*) as count FROM users`);

      const totalAssets = Number(assetsResult[0]?.count || 0);
      const totalUsers = Number(usersResult[0]?.count || 0);

      const assets = await fastify.db
        .select({
          id: fastify.schema.assets.id,
          title: fastify.schema.assets.title,
          status: fastify.schema.assets.status,
          views: fastify.schema.assets.views,
          createdAt: fastify.schema.assets.createdAt
        })
        .from(fastify.schema.assets)
        .orderBy(fastify.desc(fastify.schema.assets.createdAt))
        .limit(10);

      // Métricas agregadas en la base de datos
      const statusRows = await fastify.db.execute(sql`SELECT status, COUNT(*)::int AS count FROM assets GROUP BY status`);
      const assetsByStatus: Record<string, number> = {};
      for (const row of statusRows as unknown as Array<{ status: string; count: number }>) {
        assetsByStatus[row.status] = Number(row.count);
      }

      const viewsRows = await fastify.db.execute(sql`SELECT COALESCE(SUM(views), 0)::bigint AS total FROM assets`);
      const totalViews = Number(viewsRows[0]?.total ?? 0);

      const durationRows = await fastify.db.execute(sql`SELECT COALESCE(SUM(duration), 0)::bigint AS total_duration FROM assets`);
      const totalDurationSeconds = Number(durationRows[0]?.total_duration ?? 0);

      const readyCount = assetsByStatus['ready'] || 0;
      const failedCount = assetsByStatus['failed'] || 0;
      const processingCount = assetsByStatus['processing'] || 0;
      const totalFinished = readyCount + failedCount;
      const successRate = totalFinished > 0 ? Math.round((readyCount / totalFinished) * 100) : 100;

      // Obtener estado real de servicios
      const services = await checkServices(fastify);

      // BullMQ Queue stats
      let queueStats = {
        active: 0,
        waiting: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        workersCount: (services.worker.metadata?.workersCount as number) || 0
      };
      if (services.worker.metadata) {
        queueStats = {
          active: (services.worker.metadata.active as number) || 0,
          waiting: (services.worker.metadata.waiting as number) || 0,
          completed: (services.worker.metadata.completed as number) || 0,
          failed: (services.worker.metadata.failed as number) || 0,
          delayed: (services.worker.metadata.delayed as number) || 0,
          workersCount: (services.worker.metadata.workersCount as number) || 0
        };
      }

      sampleCpu();

      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const coresCount = Math.max(1, cpus.length);
      const totalMemBytes = os.totalmem();
      const freeMemBytes = os.freemem();
      const usedMemBytes = Math.max(0, totalMemBytes - freeMemBytes);

      const hostMetrics: HostMetrics = {
        uptime: Math.round(os.uptime()),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        cpus: {
          cores: coresCount,
          model: cpus[0]?.model || 'Desconocido',
          speedMHz: cpus[0]?.speed || 0,
          loadAvg: [
            Math.round(loadAvg[0] * 100) / 100,
            Math.round(loadAvg[1] * 100) / 100,
            Math.round(loadAvg[2] * 100) / 100
          ],
          loadAvgPercent: Math.max(0, Math.min(100, Math.round((loadAvg[0] / coresCount) * 100))),
          usagePercent: currentHostCpuPercent
        },
        memory: {
          totalBytes: totalMemBytes,
          freeBytes: freeMemBytes,
          usedBytes: usedMemBytes,
          totalMB: Math.round(totalMemBytes / 1024 / 1024),
          freeMB: Math.round(freeMemBytes / 1024 / 1024),
          usedMB: Math.round(usedMemBytes / 1024 / 1024),
          usedPercent: Math.round((usedMemBytes / totalMemBytes) * 1000) / 10
        }
      };

      const processMetrics: ProcessMetrics = {
        uptime: Math.round(process.uptime()),
        pid: process.pid,
        nodeVersion: process.version,
        cpuUsage: {
          userMicroseconds: cpuUsage.user,
          systemMicroseconds: cpuUsage.system,
          userSeconds: Math.round((cpuUsage.user / 1e6) * 100) / 100,
          systemSeconds: Math.round((cpuUsage.system / 1e6) * 100) / 100,
          usagePercent: currentProcessCpuPercent
        },
        memoryUsage: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          heapUsedPercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        }
      };

      const serverTime = new Date().toISOString();
      const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      return reply.send({
        totalAssets,
        totalUsers,
        totalViews,
        serverTime,
        serverTimezone,
        assetsByStatus,
        recentAssets: assets.map(a => ({
          id: a.id,
          title: a.title,
          status: a.status,
          views: a.views || 0,
          createdAt: a.createdAt?.toISOString() || ''
        })),
        queueStats,
        storageStats: {
          totalDurationSeconds,
          readyCount,
          failedCount,
          processingCount,
          successRate
        },
        services,
        host: hostMetrics,
        process: processMetrics,
        systemInfo: {
          uptime: process.uptime(),
          memoryUsage: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
          },
          cpuUsage: {
            user: cpuUsage.user,
            system: cpuUsage.system
          },
          host: hostMetrics,
          process: processMetrics,
          serverTime,
          serverTimezone
        }
      } as StatsResponse);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/services', async (_request, reply) => {
    try {
      const services = await checkServices(fastify);
      const isHealthy = Object.values(services).every(s => s.status === 'healthy' || s.status === 'warning');
      return reply.send({
        status: isHealthy ? 'healthy' : 'degraded',
        services,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/logs', async (request, reply) => {
    try {
      const query = request.query as {
        limit?: string;
        page?: string;
        search?: string;
        type?: string;
        status?: string;
      };

      const limit = Math.max(1, Math.min(200, parseInt(query.limit || '50')));
      const page = Math.max(1, parseInt(query.page || '1'));
      const search = (query.search || '').trim().toLowerCase();
      const typeFilter = (query.type || 'all').toLowerCase();
      const statusFilter = (query.status || 'all').toLowerCase();

      // Consultar assets con usuario creador
      const assetRows = await fastify.db
        .select({
          id: fastify.schema.assets.id,
          title: fastify.schema.assets.title,
          description: fastify.schema.assets.description,
          status: fastify.schema.assets.status,
          progress: fastify.schema.assets.progress,
          playbackId: fastify.schema.assets.playbackId,
          duration: fastify.schema.assets.duration,
          views: fastify.schema.assets.views,
          sourceType: fastify.schema.assets.sourceType,
          thumbnailKey: fastify.schema.assets.thumbnailKey,
          hlsManifestKey: fastify.schema.assets.hlsManifestKey,
          allowDownload: fastify.schema.assets.allowDownload,
          createdAt: fastify.schema.assets.createdAt,
          updatedAt: fastify.schema.assets.updatedAt,
          userId: fastify.schema.assets.userId,
          user: {
            id: fastify.schema.users.id,
            name: fastify.schema.users.name,
            email: fastify.schema.users.email,
            role: fastify.schema.users.role
          }
        })
        .from(fastify.schema.assets)
        .leftJoin(fastify.schema.users, eq(fastify.schema.assets.userId, fastify.schema.users.id))
        .orderBy(fastify.desc(fastify.schema.assets.updatedAt))
        .limit(200);

      // Consultar usuarios
      const userRows = await fastify.db
        .select({
          id: fastify.schema.users.id,
          email: fastify.schema.users.email,
          name: fastify.schema.users.name,
          role: fastify.schema.users.role,
          createdAt: fastify.schema.users.createdAt,
          updatedAt: fastify.schema.users.updatedAt
        })
        .from(fastify.schema.users)
        .orderBy(fastify.desc(fastify.schema.users.createdAt))
        .limit(200);

      // Mapear eventos de auditoría desde assets
      const assetEvents: AuditItem[] = assetRows.map(row => {
        let action = 'ASSET_UPDATED';
        let actionLabel = 'Video actualizado';
        let severity: 'success' | 'info' | 'warning' | 'error' = 'info';

        if (row.status === 'ready') {
          action = 'TRANSCODE_COMPLETED';
          actionLabel = 'Video transcodificado y listo';
          severity = 'success';
        } else if (row.status === 'failed') {
          action = 'TRANSCODE_FAILED';
          actionLabel = 'Fallo en transcodificación';
          severity = 'error';
        } else if (row.status === 'processing') {
          action = 'TRANSCODE_PROCESSING';
          actionLabel = `Procesando video (${row.progress}%)`;
          severity = 'warning';
        } else if (row.status === 'uploaded') {
          action = 'ASSET_UPLOADED';
          actionLabel = 'Video cargado en storage';
          severity = 'info';
        } else if (row.status === 'uploading') {
          action = 'ASSET_UPLOADING';
          actionLabel = 'Subida de archivo en curso';
          severity = 'info';
        } else if (row.status === 'pending') {
          action = 'ASSET_CREATED';
          actionLabel = 'Asset registrado, pendiente de subida';
          severity = 'info';
        }

        const date = row.updatedAt || row.createdAt || new Date();
        return {
          id: `asset-${row.id}-${row.status}`,
          timestamp: date.toISOString(),
          actor: {
            id: row.user?.id || row.userId,
            name: row.user?.name || 'Sistema / Desconocido',
            email: row.user?.email || '',
            role: row.user?.role || 'user',
            isSystem: !row.user?.id
          },
          action,
          actionLabel,
          resource: {
            type: 'asset',
            id: row.id,
            title: row.title
          },
          status: row.status,
          severity,
          metadata: {
            duration: row.duration,
            views: row.views || 0,
            progress: row.progress || 0,
            playbackId: row.playbackId,
            sourceType: row.sourceType,
            hasThumbnail: !!row.thumbnailKey,
            hasManifest: !!row.hlsManifestKey,
            allowDownload: row.allowDownload,
            createdAt: row.createdAt?.toISOString(),
            updatedAt: row.updatedAt?.toISOString()
          }
        };
      });

      // Mapear eventos de auditoría desde users
      const userEvents: AuditItem[] = userRows.map(u => ({
        id: `user-${u.id}-reg`,
        timestamp: (u.createdAt || new Date()).toISOString(),
        actor: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isSystem: false
        },
        action: 'USER_REGISTERED',
        actionLabel: 'Usuario registrado en la plataforma',
        resource: {
          type: 'user',
          id: u.id,
          title: u.name
        },
        status: 'active',
        severity: 'info',
        metadata: {
          email: u.email,
          role: u.role,
          createdAt: u.createdAt?.toISOString()
        }
      }));

      // Unificar y ordenar cronológicamente
      let allEvents: AuditItem[] = [...assetEvents, ...userEvents].sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      // Aplicar filtros
      if (typeFilter === 'assets' || typeFilter === 'video') {
        allEvents = allEvents.filter(e => e.resource.type === 'asset');
      } else if (typeFilter === 'users') {
        allEvents = allEvents.filter(e => e.resource.type === 'user');
      } else if (typeFilter === 'failed' || statusFilter === 'failed') {
        allEvents = allEvents.filter(e => e.severity === 'error' || e.status === 'failed');
      }

      if (statusFilter !== 'all' && statusFilter !== 'failed') {
        allEvents = allEvents.filter(e => e.status.toLowerCase() === statusFilter);
      }

      if (search) {
        allEvents = allEvents.filter(e => {
          return (
            e.resource.title.toLowerCase().includes(search) ||
            e.actionLabel.toLowerCase().includes(search) ||
            e.actor.name.toLowerCase().includes(search) ||
            (e.actor.email && e.actor.email.toLowerCase().includes(search)) ||
            e.action.toLowerCase().includes(search) ||
            e.resource.id.toLowerCase().includes(search)
          );
        });
      }

      const total = allEvents.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const pageIndex = Math.min(page, totalPages);
      const items = allEvents.slice((pageIndex - 1) * limit, pageIndex * limit);

      return reply.send({
        items,
        total,
        page: pageIndex,
        limit,
        totalPages,
        // Mantener compatibilidad con contratos existentes
        assets: assetRows.slice(0, limit).map(a => ({
          id: a.id,
          title: a.title,
          status: a.status,
          views: a.views || 0,
          createdAt: a.createdAt?.toISOString() || '',
          updatedAt: a.updatedAt?.toISOString() || ''
        })),
        users: userRows.slice(0, limit).map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt?.toISOString() || ''
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get<{ Params: { userId: string } }>('/:userId/content', async (request, reply) => {
    try {
      const { userId } = request.params;

      const userAssets = await fastify.db.query.assets.findMany({
        where: (assets, { eq }) => eq(assets.userId, userId),
        orderBy: [fastify.desc(fastify.schema.assets.createdAt)],
        limit: 10
      });

      const userCategories = await fastify.db.query.categories.findMany({
        where: (categories, { eq }) => eq(categories.userId, userId),
        orderBy: [fastify.desc(fastify.schema.categories.createdAt)],
        limit: 10
      });

      return reply.send({
        assets: userAssets,
        categories: userCategories
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  fastify.get('/system', async (_request, reply) => {
    const totalMemGB = os.totalmem() / (1024 ** 3);
    const freeMemGB = os.freemem() / (1024 ** 3);
    return reply.send({
      cpuCores: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'desconocido',
      totalMemGB: Math.round(totalMemGB * 10) / 10,
      freeMemGB: Math.round(freeMemGB * 10) / 10,
      platform: `${os.platform()} ${os.arch()}`,
      availableEncoders: AVAILABLE_ENCODERS
    });
  });

  fastify.get('/settings', async (_request, reply) => {
    const settings = await getSettings(fastify);
    return reply.send({ ...settings, availableEncoders: AVAILABLE_ENCODERS });
  });

  fastify.put<{ Body: { transcodeProfiles?: unknown[]; allowedExtensions?: string[]; encoder?: string; concurrency?: number; ffmpegThreads?: number; allowRegistration?: boolean } }>('/settings', async (request, reply) => {
    try {
      const settings = await getSettings(fastify);
      const { transcodeProfiles, allowedExtensions, encoder, concurrency, ffmpegThreads, allowRegistration } = request.body;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (transcodeProfiles !== undefined) updates.transcodeProfiles = transcodeProfiles;
      if (allowedExtensions !== undefined) updates.allowedExtensions = allowedExtensions;
      if (encoder !== undefined) updates.encoder = encoder;
      if (concurrency !== undefined) updates.concurrency = concurrency;
      if (ffmpegThreads !== undefined) updates.ffmpegThreads = ffmpegThreads;
      if (allowRegistration !== undefined) updates.allowRegistration = allowRegistration;

      const [updated] = await fastify.db
        .update(fastify.schema.settings)
        .set(updates)
        .where(eq(fastify.schema.settings.id, settings.id))
        .returning();

      return reply.send(updated);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
