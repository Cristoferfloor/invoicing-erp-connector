import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';

import { CONFIGURACION_PORT, ConfiguracionPort } from '../domain/puertos';
import { ConexionErp } from '../domain/modelo';
import { ErrorConector } from '../domain/errores';
import { LeerErpService } from './leer-erp.service';

export const CONFIGURACION_PROGRAMADOR = Symbol('CONFIGURACION_PROGRAMADOR');

export interface ConfiguracionProgramador {
  // Cada cuanto revisa si a alguna empresa le toca leer.
  pulsoMs: number;
  // Cada cuanto vuelve a pedir las conexiones a Configuracion.
  refrescoConexionesMs: number;
}

// Lee el ERP de cada empresa con conexion activa, cada intervaloSegundos.
// Transitorio: cuando los ERP envien los comprobantes a la API, esto sobra.
@Injectable()
export class ProgramadorLecturasService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ProgramadorLecturasService.name);
  private temporizador?: NodeJS.Timeout;
  private conexiones: ConexionErp[] = [];
  private conexionesCargadasEn = 0;
  private readonly ultimaLectura = new Map<string, number>();

  constructor(
    private readonly lector: LeerErpService,
    @Inject(CONFIGURACION_PORT) private readonly configuracion: ConfiguracionPort,
    @Inject(CONFIGURACION_PROGRAMADOR) private readonly config: ConfiguracionProgramador,
  ) {}

  onApplicationBootstrap(): void {
    this.temporizador = setInterval(() => void this.pulso(), this.config.pulsoMs);
  }

  onApplicationShutdown(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  proximaLectura(empresaRuc: string): { activa: boolean; intervaloSegundos: number | null; proximaEn: Date | null } {
    const conexion = this.conexiones.find((c) => c.empresaRuc === empresaRuc);
    if (!conexion) return { activa: false, intervaloSegundos: null, proximaEn: null };
    const ultima = this.ultimaLectura.get(empresaRuc) ?? 0;
    return { activa: true, intervaloSegundos: conexion.intervaloSegundos, proximaEn: new Date(Math.max(Date.now(), ultima + conexion.intervaloSegundos * 1000)) };
  }

  private async pulso(): Promise<void> {
    try {
      if (Date.now() - this.conexionesCargadasEn >= this.config.refrescoConexionesMs) {
        const anteriores = new Set(this.conexiones.map((c) => c.empresaRuc));
        this.conexiones = await this.configuracion.conexiones(true);
        this.conexionesCargadasEn = Date.now();
        const actuales = this.conexiones.map((c) => c.empresaRuc);
        if (actuales.length !== anteriores.size || actuales.some((r) => !anteriores.has(r))) {
          this.logger.log(JSON.stringify({ evento: 'conexiones_activas', empresas: actuales }));
        }
      }
    } catch (error) {
      if (!(error instanceof ErrorConector)) throw error;
      this.logger.warn(JSON.stringify({ evento: 'configuracion_no_disponible', error: error.message }));
      return;
    }

    const ahora = Date.now();
    for (const conexion of this.conexiones) {
      const ultima = this.ultimaLectura.get(conexion.empresaRuc) ?? 0;
      if (ahora - ultima < conexion.intervaloSegundos * 1000 || this.lector.estaLeyendo(conexion.empresaRuc)) continue;
      this.ultimaLectura.set(conexion.empresaRuc, ahora);
      void this.lector.leer(conexion).catch((error: Error) =>
        this.logger.error(JSON.stringify({ evento: 'lectura_fallida', empresaRuc: conexion.empresaRuc, error: error.message })),
      );
    }
  }
}
