import { claveDeFactura, leerRespuestaErp, motivoDeRechazo } from '../src/domain/factura-erp';

describe('respuesta del web service del ERP', () => {
  it('lee el JSON dos veces codificado', () => {
    const texto = JSON.stringify(JSON.stringify([{ numero: '003-001-000115743' }]));
    expect(leerRespuestaErp(texto)).toEqual([{ numero: '003-001-000115743' }]);
  });

  it('sin facturas pendientes responde "[]"', () => {
    expect(leerRespuestaErp('"[]"')).toEqual([]);
  });

  it('token incorrecto: {"error":"No tiene Permisos"}', () => {
    expect(() => leerRespuestaErp('{"error":"No tiene Permisos"}')).toThrow(/No tiene Permisos/);
  });

  it('una pagina HTML no es una respuesta valida', () => {
    expect(() => leerRespuestaErp('<html>error</html>')).toThrow(/no es JSON/);
  });
});

describe('factura del ERP', () => {
  const factura = { numero: '003-001-000115743', fecha: '2026-09-16 15:04:13', serie: '003', punto_emision: '001', secuencial: '000115743' };

  it('calcula la misma clave que se cargo a mano para la 003-001-000115743', () => {
    expect(claveDeFactura(factura, '2390625475001', 1)).toBe('1609202601239062547500110030010001157430011574311');
  });

  it('acepta una factura completa', () => {
    expect(motivoDeRechazo(factura)).toBeNull();
  });

  it('rechaza con motivo si falta lo minimo', () => {
    expect(motivoDeRechazo({ ...factura, secuencial: '115743' })).toMatch(/secuencial/);
    expect(motivoDeRechazo({ ...factura, fecha: '16/09/2026' })).toMatch(/fecha/);
    expect(motivoDeRechazo({ ...factura, serie: undefined })).toMatch(/serie/);
  });
});
