import { Controller, Get, Post, Body, Query, Sse } from '@nestjs/common';
import { DeploysService, Deploy } from './deploys.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('deploys')
export class DeploysController {
  constructor(private readonly deploysService: DeploysService) {}

  @Get()
  async findAll(@Query('usuarioId') usuarioId?: string): Promise<Deploy[]> {
    return this.deploysService.findAll(usuarioId);
  }

  @Post()
  async create(
    @Body() createDeployDto: Omit<Deploy, 'id' | 'startedAt' | 'status'> & { usuarioId?: string },
  ): Promise<Deploy> {
    return this.deploysService.create(createDeployDto, createDeployDto.usuarioId);
  }

  // Endpoint SSE expuesto en: GET /deploys/sse
  @Sse('sse')
  sse(): Observable<MessageEvent> {
    return this.deploysService.getEventsObservable().pipe(
      map((event) => ({
        data: event,
      })),
    );
  }
}
