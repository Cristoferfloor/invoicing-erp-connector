export type Ambiente = 1 | 2;

// Conexion al web service del ERP, tal como la entrega Configuracion.
export interface ConexionErp {
  empresaRuc: string;
  url: string;
  token: string;
  activa: boolean;
  intervaloSegundos: number;
}

export interface EmpresaConfigurada {
  ruc: string;
  razonSocial: string;
  ambiente: Ambiente;
  version: number;
}

export interface PlantillaConfigurada {
  version: number;
  huella: string;
}

// Una factura tal como la devuelve la vista del ERP.
export type FacturaErp = Record<string, unknown> & {
  numero?: unknown;
  fecha?: unknown;
  serie?: unknown;
  punto_emision?: unknown;
  secuencial?: unknown;
};

export interface ResultadoLectura {
  empresaRuc: string;
  iniciadaEn: Date;
  terminadaEn: Date;
  duracionMs: number;
  leidas: number;
  nuevas: string[];
  yaEstaban: number;
  rechazadas: Array<{ numero: string; motivo: string }>;
  error: string | null;
}
