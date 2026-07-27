import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsuarioService, Usuario } from './usuario.service';

@Controller('usuarios')
export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  @Get()
  async findAll(): Promise<Usuario[]> {
    return this.usuarioService.findAll();
  }

  @Post()
  async create(
    @Body() data: { nombre: string; email: string },
  ): Promise<Usuario> {
    return this.usuarioService.create(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Usuario | null> {
    return this.usuarioService.findOne(id);
  }
}
