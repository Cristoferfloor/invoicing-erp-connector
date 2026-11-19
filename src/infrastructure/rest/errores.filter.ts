import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

import { ErrorConector } from '../../domain/errores';

const ESTADO_HTTP: Record<string, HttpStatus> = {
  SIN_CONEXION_ERP: HttpStatus.NOT_FOUND,
  CONFIGURACION_NO_DISPONIBLE: HttpStatus.SERVICE_UNAVAILABLE,
  ERP_NO_DISPONIBLE: HttpStatus.BAD_GATEWAY,
  ERP_RESPUESTA_INVALIDA: HttpStatus.BAD_GATEWAY,
};

@Catch(ErrorConector)
export class ErroresFilter implements ExceptionFilter<ErrorConector> {
  catch(error: ErrorConector, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(ESTADO_HTTP[error.codigo] ?? HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ estado: 'RECHAZADO', error: error.codigo, mensaje: error.message });
  }
}
