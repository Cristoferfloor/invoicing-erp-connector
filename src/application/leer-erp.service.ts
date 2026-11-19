import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  COMPROBANTES_PORT,
  CONFIGURACION_PORT,
  ComprobantesPort,
  ConfiguracionPort,
  ERP_PORT,
  ErpPort,
  LECTURAS_PORT,
  LecturasPort,
} from '../domain/puertos';
import { ConexionErp, ResultadoLectura } from '../domain/modelo';
import { claveDeFactura, motivoDeRechazo } from '../domain/factura-erp';
import { ErrorConector, SinConexionErpError } from '../domain/errores';

@Injectable()
export class LeerErpService {
  private readonly logger = new Logger(LeerErpService.name);
  // Nunca dos lecturas a la vez para la misma empresa.
  private readonly enCurso = new Set<string>();

  constructor(
    @Inject(ERP_PORT) private readonly erp: ErpPort,
    @Inject(CONFIGURACION_PORT) private readonly configuracion: ConfiguracionPort,
    @Inject(COMPROBANTES_PORT) private readonly comprobantes: ComprobantesPort,
    @Inject(LECTURAS_PORT) private readonly lecturas: LecturasPort,
  ) {}

  estaLeyendo(empresaRuc: string): boolean {
    return this.enCurso.has(empresaRuc);
  }

  // Lectura manual: sirve aunque la conexion este inactiva.
  async leerAhora(empresaRuc: string): Promise<ResultadoLectura> {
    const conexion = (await this.configuracion.conexiones(false)).find((c) => c.empresaRuc === empresaRuc);
    if (!conexion) throw new SinConexionErpError(`La empresa ${empresaRuc} no tiene conexion al ERP en Configuracion.`);
    return this.leer(conexion);
  }

  async leer(conexion: ConexionErp): Promise<ResultadoLectura> {
    const iniciadaEn = new Date();
    const resultado: ResultadoLectura = {
      empresaRuc: conexion.empresaRuc, iniciadaEn, terminadaEn: iniciadaEn, duracionMs: 0,
      leidas: 0, nuevas: [], yaEstaban: 0, rechazadas: [], error: null,
    };

    if (this.enCurso.has(conexion.empresaRuc)) {
      resultado.error = 'Ya hay una lectura en curso para esta empresa.';
      return resultado;
    }
    this.enCurso.add(conexion.empresaRuc);

    try {
      const empresa = await this.configuracion.empresa(conexion.empresaRuc);
      const plantilla = await this.configuracion.plantilla(conexion.empresaRuc, '01');
      const facturas = await this.erp.facturasPendientes(conexion);
      resultado.leidas = facturas.length;

      for (const datos of facturas) {
        const numero = String(datos.numero ?? `${datos.serie}-${datos.punto_emision}-${datos.secuencial}`);
        const motivo = motivoDeRechazo(datos);
        if (motivo) {
          resultado.rechazadas.push({ numero, motivo });
          continue;
        }
        const claveAcceso = claveDeFactura(datos, empresa.ruc, empresa.ambiente);
        const estado = await this.comprobantes.registrar({ empresa, plantilla, claveAcceso, datos });
        if (estado === 'NUEVO') resultado.nuevas.push(numero);
        else resultado.yaEstaban++;
      }
    } catch (error) {
      if (!(error instanceof ErrorConector)) throw error;
      resultado.error = `${error.codigo}: ${error.message}`;
    } finally {
      this.enCurso.delete(conexion.empresaRuc);
      resultado.terminadaEn = new Date();
      resultado.duracionMs = resultado.terminadaEn.getTime() - iniciadaEn.getTime();
      await this.lecturas.guardar(resultado);
    }

    const evento = {
      evento: 'lectura_erp', empresaRuc: conexion.empresaRuc, leidas: resultado.leidas, nuevas: resultado.nuevas.length,
      yaEstaban: resultado.yaEstaban, rechazadas: resultado.rechazadas.length, duracionMs: resultado.duracionMs, error: resultado.error,
    };
    if (resultado.error) this.logger.warn(JSON.stringify(evento));
    else if (resultado.nuevas.length > 0) this.logger.log(JSON.stringify({ ...evento, numeros: resultado.nuevas }));
    return resultado;
  }
}
