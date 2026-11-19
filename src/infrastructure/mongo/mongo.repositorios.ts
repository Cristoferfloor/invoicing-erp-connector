import { randomUUID } from 'node:crypto';
import { Db } from 'mongodb';

import { ComprobantesPort, LecturasPort, RegistroComprobante } from '../../domain/puertos';
import { ResultadoLectura } from '../../domain/modelo';

type Doc = { _id: string } & Record<string, any>;

// Registra directamente en facturacion.comprobantes porque el Nucleo todavia
// no existe. Cuando exista, el Conector le pasara los comprobantes.
export class MongoComprobantesRepository implements ComprobantesPort {
  constructor(private readonly db: Db) {}

  async prepararIndices(): Promise<void> {
    const col = this.db.collection<Doc>('comprobantes');
    await col.createIndex({ empresaId: 1, tipo: 1, estab: 1, ptoEmi: 1, secuencial: 1 }, { unique: true, name: 'numero_unico' });
    await col.createIndex({ 'intentos.claveAcceso': 1 }, { unique: true, name: 'clave_unica' });
    await col.createIndex({ empresaId: 1, estado: 1, actualizadoEn: -1 }, { name: 'por_empresa_y_estado' });
  }

  async registrar(r: RegistroComprobante): Promise<'NUEVO' | 'YA_ESTABA'> {
    const ahora = new Date();
    try {
      await this.db.collection<Doc>('comprobantes').insertOne({
        _id: randomUUID(),
        empresaId: r.empresa.ruc,
        tipo: '01',
        estab: String(r.datos.serie),
        ptoEmi: String(r.datos.punto_emision),
        secuencial: String(r.datos.secuencial),
        ambiente: r.empresa.ambiente,
        estado: 'REGISTRADO',
        intentoActual: 1,
        intentos: [{
          numero: 1,
          claveAcceso: r.claveAcceso,
          estado: 'REGISTRADO',
          configuracion: {
            empresa: { ruc: r.empresa.ruc, razonSocial: r.empresa.razonSocial, ambiente: r.empresa.ambiente, version: r.empresa.version },
            plantilla: r.plantilla ? { tipoComprobante: '01', version: r.plantilla.version, huella: r.plantilla.huella } : null,
          },
          datos: r.datos,
          historial: [{ estado: 'REGISTRADO', fecha: ahora, servicio: 'conector-erp' }],
        }],
        origen: { servicio: 'conector-erp', leidoEn: ahora },
        creadoEn: ahora,
        actualizadoEn: ahora,
      });
      return 'NUEVO';
    } catch (error) {
      // Indice unico: el comprobante ya estaba registrado.
      if ((error as { code?: number }).code === 11000) return 'YA_ESTABA';
      throw error;
    }
  }
}

// Una fila por empresa con su ultima lectura y totales.
export class MongoLecturasRepository implements LecturasPort {
  constructor(private readonly db: Db) {}

  async guardar(r: ResultadoLectura): Promise<void> {
    await this.db.collection<Doc>('lecturas_erp').updateOne(
      { _id: r.empresaRuc },
      {
        $set: { ultima: r, actualizadoEn: new Date() },
        $inc: { 'totales.lecturas': 1, 'totales.nuevas': r.nuevas.length, 'totales.errores': r.error ? 1 : 0 },
      },
      { upsert: true },
    );
  }

  async ultima(empresaRuc: string) {
    const doc = await this.db.collection<Doc>('lecturas_erp').findOne({ _id: empresaRuc });
    return doc ? { ...(doc.ultima as ResultadoLectura), totales: doc.totales } : null;
  }
}
