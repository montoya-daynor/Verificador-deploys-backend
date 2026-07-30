import { Injectable, OnModuleInit } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioService } from '../usuario/usuario.service';

export interface Deploy {
  id: string;
  projectName: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'failed' | 'pending';
  environment: string;
  url?: string;
  duration?: number;
  usuarioId?: string;
}

export interface DeployEvent {
  type: 'added' | 'updated' | 'removed';
  deploy: Deploy;
}

@Injectable()
export class DeploysService implements OnModuleInit {
  // Subject de RxJS para transmitir eventos de cambios en tiempo real
  private events$ = new Subject<DeployEvent>();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarioService: UsuarioService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.deploy.count();
      if (count === 0) {
        console.log('Deploy table is empty. Ready for new user deployments.');
      }
      
      // Iniciar el monitor periódico de salud por HTTP
      this.startHealthCheckWorker();
    } catch (err) {
      console.error('Error in deploys module init:', err.message);
    }
  }

  private startHealthCheckWorker() {
    if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);

    // Primer check rápido a los 2 segundos
    setTimeout(() => this.checkAllDeploymentsHealth(), 2000);

    // Repetir check cada 5 segundos para actualización instantánea
    this.healthCheckInterval = setInterval(() => {
      this.checkAllDeploymentsHealth();
    }, 5000);
  }

  async checkAllDeploymentsHealth() {
    try {
      const deploys = await this.prisma.deploy.findMany();

      for (const d of deploys) {
        if (!d.url) continue;

        const startTime = Date.now();
        let isHealthy = false;
        let latency = 0;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(d.url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'MonitorDeploys-HealthCheck/1.0',
            },
          });

          clearTimeout(timeoutId);
          latency = Date.now() - startTime;
          isHealthy = response.status >= 200 && response.status < 400;
        } catch {
          isHealthy = false;
          latency = 0;
        }

        const newStatus = isHealthy ? 'success' : 'failed';
        const hasStatusChanged = d.status !== newStatus;

        // Actualizar la base de datos y transmitir el evento en tiempo real por SSE
        if (hasStatusChanged || d.duration !== latency) {
          if (hasStatusChanged) {
            console.log(`[HealthCheck ALERT] ${d.projectName} (${d.url}) cambió de ${d.status} -> ${newStatus.toUpperCase()} (${latency}ms)`);
          }
          await this.updateStatus(d.id, newStatus, new Date().toISOString(), latency);
        }
      }
    } catch (err) {
      console.error('[HealthCheck Error]:', err.message);
    }
  }

  async findAll(usuarioId?: string): Promise<Deploy[]> {
    if (!usuarioId) return [];

    const result = await this.prisma.deploy.findMany({
      where: { usuarioId },
      orderBy: { startedAt: 'desc' },
    });

    return result.map((row) => ({
      id: row.id,
      projectName: row.projectName,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
      status: row.status as Deploy['status'],
      environment: row.environment,
      url: row.url || undefined,
      duration: row.duration !== null ? row.duration : undefined,
      usuarioId: row.usuarioId,
    }));
  }

  async findOne(id: string): Promise<Deploy | undefined> {
    const row = await this.prisma.deploy.findUnique({
      where: { id },
    });
    if (!row) return undefined;
    return {
      id: row.id,
      projectName: row.projectName,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
      status: row.status as Deploy['status'],
      environment: row.environment,
      url: row.url || undefined,
      duration: row.duration !== null ? row.duration : undefined,
      usuarioId: row.usuarioId,
    };
  }

  async create(
    data: Omit<Deploy, 'id' | 'startedAt' | 'status'>,
    usuarioId?: string,
  ): Promise<Deploy> {
    let targetUserId = usuarioId;

    if (targetUserId) {
      try {
        const exists = await this.usuarioService.findOne(targetUserId);
        if (!exists) {
          targetUserId = undefined;
        }
      } catch {
        targetUserId = undefined;
      }
    }

    if (!targetUserId) {
      const users = await this.usuarioService.findAll();
      if (users.length > 0) {
        targetUserId = users[0].id;
      } else {
        throw new Error('Debe iniciar sesión para asociar un nuevo despliegue.');
      }
    }

    const row = await this.prisma.deploy.create({
      data: {
        usuarioId: targetUserId,
        projectName: data.projectName,
        status: 'pending',
        environment: data.environment,
        url: data.url,
      },
    });

    const newDeploy: Deploy = {
      id: row.id,
      projectName: row.projectName,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
      status: row.status as Deploy['status'],
      environment: row.environment,
      url: row.url || undefined,
      duration: row.duration !== null ? row.duration : undefined,
      usuarioId: row.usuarioId,
    };

    this.emitEvent('added', newDeploy);
    
    // Verificar salud inmediatamente para el nuevo despliegue registrado
    setTimeout(() => this.checkAllDeploymentsHealth(), 500);

    return newDeploy;
  }

  async updateStatus(
    id: string,
    status: Deploy['status'],
    finishedAt?: string,
    duration?: number,
  ): Promise<Deploy | undefined> {
    const row = await this.prisma.deploy.update({
      where: { id },
      data: {
        status,
        finishedAt: finishedAt ? new Date(finishedAt) : undefined,
        duration: duration !== undefined ? duration : undefined,
      },
    });

    const updatedDeploy: Deploy = {
      id: row.id,
      projectName: row.projectName,
      startedAt: row.startedAt.toISOString(),
      finishedAt: row.finishedAt ? row.finishedAt.toISOString() : undefined,
      status: row.status as Deploy['status'],
      environment: row.environment,
      url: row.url || undefined,
      duration: row.duration !== null ? row.duration : undefined,
      usuarioId: row.usuarioId,
    };

    this.emitEvent('updated', updatedDeploy);
    return updatedDeploy;
  }

  getEventsObservable(): Observable<DeployEvent> {
    return this.events$.asObservable();
  }

  private emitEvent(type: DeployEvent['type'], deploy: Deploy) {
    this.events$.next({ type, deploy });
  }
}
