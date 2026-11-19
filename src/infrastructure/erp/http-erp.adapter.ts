import { ErpPort } from '../../domain/puertos';
import { ConexionErp, FacturaErp } from '../../domain/modelo';
import { leerRespuestaErp } from '../../domain/factura-erp';
import { ErpNoDisponibleError } from '../../domain/errores';

// Web service REST del ERP actual (CodeIgniter), el mismo que consulta
// clientrest.php: GET <url>facturas/input/{"token":"..."}.
// Solo se usa el GET. El POST que marca las facturas como procesadas no se
// llama nunca: el PAC de produccion dejaria de verlas.
export class HttpErpAdapter implements ErpPort {
  constructor(private readonly timeoutMs: number) {}

  async facturasPendientes(conexion: ConexionErp): Promise<FacturaErp[]> {
    const entrada = encodeURIComponent(JSON.stringify({ token: conexion.token }));
    const url = `${conexion.url}facturas/input/${entrada}`;

    let respuesta: Response;
    try {
      respuesta = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      // Sin la URL en el mensaje: lleva el token.
      throw new ErpNoDisponibleError(`No se pudo conectar con el ERP de ${conexion.empresaRuc}: ${(error as Error).message}`);
    }

    const texto = await respuesta.text();
    if (respuesta.status === 404 && texto.includes('Permisos')) {
      throw new ErpNoDisponibleError(`El ERP de ${conexion.empresaRuc} rechazo el token ("No tiene Permisos").`);
    }
    if (!respuesta.ok) {
      throw new ErpNoDisponibleError(`El ERP de ${conexion.empresaRuc} respondio HTTP ${respuesta.status}.`);
    }
    return leerRespuestaErp(texto);
  }
}
