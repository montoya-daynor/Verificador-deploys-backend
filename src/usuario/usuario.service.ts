import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  fechaCreacion: Date;
}

@Injectable()
export class UsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Usuario[]> {
    return this.prisma.usuario.findMany({
      orderBy: {
        fechaCreacion: 'desc',
      },
    });
  }

  async findOne(id: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { email },
    });
  }

  async create(data: { nombre: string; email: string }): Promise<Usuario> {
    return this.prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
      },
    });
  }

  async findOrCreate(data: { nombre: string; email: string }): Promise<Usuario> {
    let user = await this.findByEmail(data.email);
    if (!user) {
      user = await this.create({
        nombre: data.nombre,
        email: data.email,
      });
    }
    return user;
  }
}
