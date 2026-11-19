import { Ambiente, FacturaErp } from './modelo';
import { ErpRespuestaInvalidaError } from './errores';

// El web service del ERP devuelve el JSON dos veces codificado: un texto que a
// su vez contiene el arreglo. Si no hay permiso responde {"error": "..."}.
export function leerRespuestaErp(texto: string): FacturaErp[] {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
    while (typeof valor === 'string') valor = JSON.parse(valor);
  } catch {
    throw new ErpRespuestaInvalidaError(`El ERP respondio algo que no es JSON: ${texto.slice(0, 80)}`);
  }
  if (Array.isArray(valor)) return valor as FacturaErp[];
  const error = (valor as { error?: unknown } | null)?.error;
  throw new ErpRespuestaInvalidaError(error ? `El ERP respondio: ${String(error)}` : 'El ERP no devolvio un arreglo de facturas.');
}

// Si la factura no trae lo minimo para identificarla y calcular su clave, no
// se registra: se informa el motivo.
export function motivoDeRechazo(f: FacturaErp): string | null {
  if (!/^\d{3}$/.test(String(f.serie ?? ''))) return 'serie debe tener 3 digitos';
  if (!/^\d{3}$/.test(String(f.punto_emision ?? ''))) return 'punto_emision debe tener 3 digitos';
  if (!/^\d{9}$/.test(String(f.secuencial ?? ''))) return 'secuencial debe tener 9 digitos';
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(f.fecha ?? ''))) return 'fecha debe empezar con AAAA-MM-DD';
  return null;
}

function digitoVerificador(digitos: string): string {
  const pesos = [2, 3, 4, 5, 6, 7];
  let suma = 0;
  for (let i = digitos.length - 1, p = 0; i >= 0; i--, p++) suma += Number(digitos[i]) * pesos[p % 6];
  const r = 11 - (suma % 11);
  return r === 11 ? '0' : r === 10 ? '1' : String(r);
}

// Misma regla que clave_helper.php: el codigo numerico son los ultimos 8
// digitos del secuencial.
export function claveDeFactura(f: FacturaErp, ruc: string, ambiente: Ambiente): string {
  const [anio, mes, dia] = String(f.fecha).slice(0, 10).split('-');
  const secuencial = String(f.secuencial);
  const base = `${dia}${mes}${anio}01${ruc}${ambiente}${f.serie}${f.punto_emision}${secuencial}${secuencial.slice(1)}1`;
  return base + digitoVerificador(base);
}
