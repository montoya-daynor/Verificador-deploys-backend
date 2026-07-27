import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeploysModule } from './deploys/deploys.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsuarioModule } from './usuario/usuario.module';

@Module({
  imports: [PrismaModule, UsuarioModule, DeploysModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
