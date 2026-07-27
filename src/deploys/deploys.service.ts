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
}

export interface DeployEvent {
  type: 'added' | 'updated' | 'removed';
  deploy: Deploy;
}

@Injectable()
export class DeploysService implements OnModuleInit {
  // Subject de RxJS para transmitir eventos de cambios en tiempo real
  private events$ = new Subject<DeployEvent>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarioService: UsuarioService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.deploy.count();
      if (count === 0) {
        console.log(
          'Database deploy table is empty. Seeding initial data with Prisma...',
        );
        const defaultUser = await this.usuarioService.findOrCreateDefaultUser();

        const initialDeploys = [
          {
            projectName: 'DB de Producción',
            startedAt: new Date(Date.now() - 3600000 * 24),
            status: 'success',
            environment: 'production',
            url: 'https://db.pulse.monitor/health',
            duration: 12,
          },
          {
            projectName: 'API Core',
            startedAt: new Date(Date.now() - 3600000 * 2),
            status: 'success',
            environment: 'production',
            url: 'https://api.pulse.monitor/health',
            duration: 45,
          },
          {
            projectName: 'Web Frontend',
            startedAt: new Date(Date.now() - 600000),
            status: 'running',
            environment: 'production',
            url: 'https://pulse.monitor/health',
            duration: null,
          },
        ];

        for (const d of initialDeploys) {
          await this.prisma.deploy.create({
            data: {
              usuarioId: defaultUser.id,
              projectName: d.projectName,
              startedAt: d.startedAt,
              status: d.status,
              environment: d.environment,
              url: d.url,
              duration: d.duration,
            },
          });
        }
        console.log('Seeded 3 initial deploys in database successfully.');
      }
    } catch (err) {
      console.error('Error seeding initial deploys:', err.message);
    }
  }

  async findAll(): Promise<Deploy[]> {
    const result = await this.prisma.deploy.findMany({
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
    };
  }

  async create(
    data: Omit<Deploy, 'id' | 'startedAt' | 'status'>,
  ): Promise<Deploy> {
    const defaultUser = await this.usuarioService.findOrCreateDefaultUser();

    const row = await this.prisma.deploy.create({
      data: {
        usuarioId: defaultUser.id,
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
    };

    this.emitEvent('added', newDeploy);
    this.simulateDeploymentLifecycle(newDeploy.id);
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

  private simulateDeploymentLifecycle(deployId: string) {
    setTimeout(async () => {
      const deploy = await this.findOne(deployId);
      if (!deploy) return;

      await this.updateStatus(deployId, 'running');

      setTimeout(async () => {
        const checkDeploy = await this.findOne(deployId);
        if (!checkDeploy) return;

        const isSuccessful = Math.random() > 0.2;
        const duration = Math.floor(Math.random() * 20) + 10;
        const finishedAt = new Date().toISOString();

        await this.updateStatus(
          deployId,
          isSuccessful ? 'success' : 'failed',
          finishedAt,
          duration,
        );
      }, 8000);
    }, 3000);
  }
}
