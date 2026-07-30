import { Module } from '@nestjs/common';
import { DeploysController } from './deploys.controller';
import { DeploysService } from './deploys.service';
import { UsuarioModule } from '../usuario/usuario.module';

@Module({
  imports: [UsuarioModule],
  controllers: [DeploysController],
  providers: [DeploysService],
})
export class DeploysModule {}
