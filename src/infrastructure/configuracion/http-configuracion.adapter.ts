import { ConfiguracionPort } from '../../domain/puertos';
import { ConexionErp, EmpresaConfigurada, PlantillaConfigurada } from '../../domain/modelo';
import { ConfiguracionNoDisponibleError } from '../../domain/errores';

export class HttpConfiguracionAdapter implements ConfiguracionPort {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  conexiones(soloActivas: boolean): Promise<ConexionErp[]> {
    return this.pedir<ConexionErp[]>(`/v1/conexiones-erp?activas=${soloActivas}`);
  }

  empresa(ruc: string): Promise<EmpresaConfigurada> {
    return this.pedir<EmpresaConfigurada>(`/v1/empresas/${ruc}`);
  }

  async plantilla(ruc: string, tipo: string): Promise<PlantillaConfigurada | null> {
    const plantilla = await this.pedir<PlantillaConfigurada | null>(`/v1/empresas/${ruc}/plantillas/${tipo}`, true);
    return plantilla ? { version: plantilla.version, huella: plantilla.huella } : null;
  }

  private async pedir<T>(ruta: string, nuloSiNoExiste = false): Promise<T> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${this.baseUrl}${ruta}`, {
        headers: { 'X-Token-Admin': this.token },
        signal: AbortSignal.timeout(15000),
      });
    } catch (error) {
      throw new ConfiguracionNoDisponibleError(`No se pudo conectar con Configuracion: ${(error as Error).message}`);
    }
    if (respuesta.status === 404 && nuloSiNoExiste) return null as T;
    if (!respuesta.ok) {
      throw new ConfiguracionNoDisponibleError(`Configuracion respondio HTTP ${respuesta.status} en ${ruta.split('?')[0]}.`);
    }
    return (await respuesta.json()) as T;
  }
}
