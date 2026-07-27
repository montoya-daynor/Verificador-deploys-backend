import { Module } from '@nestjs/common';
import { DeploysController } from './deploys.controller';
import { DeploysService } from './deploys.service';

@Module({
  controllers: [DeploysController],
  providers: [DeploysService],
})
export class DeploysModule {}
