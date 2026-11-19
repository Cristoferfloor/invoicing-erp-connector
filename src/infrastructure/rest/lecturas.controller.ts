import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { Matches } from 'class-validator';

import { LeerErpService } from '../../application/leer-erp.service';
import { ProgramadorLecturasService } from '../../application/programador-lecturas.service';
import { LECTURAS_PORT, LecturasPort } from '../../domain/puertos';
import { TokenAdminGuard } from './token-admin.guard';

export class EmpresaDto {
  @Matches(/^\d{10}00[1-9]$/, { message: 'empresaRuc debe ser un RUC de 13 digitos.' })
  empresaRuc!: string;
}

@Controller('v1/lecturas')
@UseGuards(TokenAdminGuard)
export class LecturasController {
  constructor(
    private readonly lector: LeerErpService,
    private readonly programador: ProgramadorLecturasService,
    @Inject(LECTURAS_PORT) private readonly lecturas: LecturasPort,
  ) {}

  // Lee el ERP ahora, sin esperar al intervalo.
  @Post()
  @HttpCode(HttpStatus.OK)
  leer(@Body() cuerpo: EmpresaDto) {
    return this.lector.leerAhora(cuerpo.empresaRuc);
  }

  @Get(':empresaRuc')
  async estado(@Param('empresaRuc') empresaRuc: string) {
    return {
      empresaRuc,
      programacion: this.programador.proximaLectura(empresaRuc),
      ultimaLectura: await this.lecturas.ultima(empresaRuc),
    };
  }
}
