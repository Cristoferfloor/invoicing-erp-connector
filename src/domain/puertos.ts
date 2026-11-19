import { ConexionErp, EmpresaConfigurada, FacturaErp, PlantillaConfigurada, ResultadoLectura } from './modelo';

export const ERP_PORT = Symbol('ERP_PORT');
export const CONFIGURACION_PORT = Symbol('CONFIGURACION_PORT');
export const COMPROBANTES_PORT = Symbol('COMPROBANTES_PORT');
export const LECTURAS_PORT = Symbol('LECTURAS_PORT');

export interface ErpPort {
  // Solo lectura: nunca marca nada como procesado en el ERP.
  facturasPendientes(conexion: ConexionErp): Promise<FacturaErp[]>;
}

export interface ConfiguracionPort {
  conexiones(soloActivas: boolean): Promise<ConexionErp[]>;
  empresa(ruc: string): Promise<EmpresaConfigurada>;
  plantilla(ruc: string, tipo: string): Promise<PlantillaConfigurada | null>;
}

export interface RegistroComprobante {
  empresa: EmpresaConfigurada;
  plantilla: PlantillaConfigurada | null;
  claveAcceso: string;
  datos: FacturaErp;
}

export interface ComprobantesPort {
  // NUEVO si se guardo; YA_ESTABA si el numero ya existia.
  registrar(registro: RegistroComprobante): Promise<'NUEVO' | 'YA_ESTABA'>;
}

export interface LecturasPort {
  guardar(resultado: ResultadoLectura): Promise<void>;
  ultima(empresaRuc: string): Promise<(ResultadoLectura & { totales: { lecturas: number; nuevas: number; errores: number } }) | null>;
}
