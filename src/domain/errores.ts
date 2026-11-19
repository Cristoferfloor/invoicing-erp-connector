export abstract class ErrorConector extends Error {
  abstract readonly codigo: string;

  constructor(mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}

export class ErpNoDisponibleError extends ErrorConector {
  readonly codigo = 'ERP_NO_DISPONIBLE';
}

export class ErpRespuestaInvalidaError extends ErrorConector {
  readonly codigo = 'ERP_RESPUESTA_INVALIDA';
}

export class ConfiguracionNoDisponibleError extends ErrorConector {
  readonly codigo = 'CONFIGURACION_NO_DISPONIBLE';
}

export class SinConexionErpError extends ErrorConector {
  readonly codigo = 'SIN_CONEXION_ERP';
}
