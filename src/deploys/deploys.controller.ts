import { Controller, Get, Post, Body, Sse } from '@nestjs/common';
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
  async findAll(): Promise<Deploy[]> {
    return this.deploysService.findAll();
  }

  @Post()
  async create(
    @Body() createDeployDto: Omit<Deploy, 'id' | 'startedAt' | 'status'>,
  ): Promise<Deploy> {
    return this.deploysService.create(createDeployDto);
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
