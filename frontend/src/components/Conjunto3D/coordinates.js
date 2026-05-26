/**
 * Convierte el número de plaza (P-001, V-003, PM-001, VM-002) a coordenadas
 * 3D en la escena. No requiere modificar el esquema de base de datos —
 * derivamos la posición del numero + categoria.
 *
 * Layout en la escena (vista cenital):
 *
 *            Z negativo (al fondo — torres residenciales)
 *  ────────────────────────────────────────────────
 *  │  P-001 P-002 P-003 P-004 P-005 P-006 P-007  │  ← carros privados fila 2
 *  │  P-008 P-009 P-010 P-011 P-012 P-013 P-014  │  ← carros privados fila 1
 *  ────────────────────────────────────────────────
 *              [ vía central — entrada al conjunto ]
 *  ────────────────────────────────────────────────
 *  │   V-001  V-002  V-003  V-004  V-005         │  ← visitantes carros
 *  │   PM-001 PM-002 │  VM-001 VM-002            │  ← motos
 *  ────────────────────────────────────────────────
 *            Z positivo (entrada / portería)
 */

const COLS_PRIVADO_CARRO = 7;     // 7 plazas por fila
const COLS_VISITANTE_CARRO = 5;   // 5 plazas visitantes
const COLS_MOTO = 4;              // 4 motos juntas

const SPACING_X = 3.0;            // separación entre plazas (eje X)
const ROW_PRIVADO_2_Z = -12;      // fila trasera (más lejos)
const ROW_PRIVADO_1_Z = -6;       // fila delantera de privados
const ROW_VISITANTE_Z = 8;        // fila visitantes (frente a la portería)
const ROW_MOTO_Z = 14;            // motos

/**
 * Determina si una plaza es de moto.
 */
function esMoto(numero = '', tipoVehiculo = '') {
  const tv = (tipoVehiculo || '').toUpperCase();
  return tv === 'MOTO' || /^[A-Z]*M-?\d+$/i.test(numero) || /^M[PV]?-?\d+$/i.test(numero);
}

/**
 * Extrae el índice numérico del número de plaza.
 * "P-001" → 1, "V-12" → 12, "PM-3" → 3
 */
function extraerIndice(numero = '') {
  const m = String(numero).match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

/**
 * Función principal — devuelve { x, z, categoria, tipoVehiculo, valida }
 */
export function plazaACoordenadas(plaza) {
  if (!plaza) return null;
  const numero = plaza.numero || '';
  const categoria = (plaza.categoria || 'PRIVADO').toUpperCase();
  const tipoVehiculo = (plaza.tipoVehiculo || 'CARRO').toUpperCase();

  const idx = extraerIndice(numero);
  const i = Math.max(0, idx - 1);
  const esMotoSpot = esMoto(numero, tipoVehiculo);

  let x, z;

  if (esMotoSpot) {
    // Motos: una sola fila al frente del todo
    const col = i % COLS_MOTO;
    const startX = -((COLS_MOTO - 1) * (SPACING_X * 0.7)) / 2;
    x = startX + col * (SPACING_X * 0.7);
    z = ROW_MOTO_Z;
  } else if (categoria === 'VISITANTE') {
    // Visitantes (carro) — fila frontal
    const col = i % COLS_VISITANTE_CARRO;
    const startX = -((COLS_VISITANTE_CARRO - 1) * SPACING_X) / 2;
    x = startX + col * SPACING_X;
    z = ROW_VISITANTE_Z;
  } else {
    // Privado (residente) — 2 filas al fondo
    const col = i % COLS_PRIVADO_CARRO;
    const fila = i < COLS_PRIVADO_CARRO ? 1 : 2; // primeras 7 son fila 1
    const startX = -((COLS_PRIVADO_CARRO - 1) * SPACING_X) / 2;
    x = startX + col * SPACING_X;
    z = fila === 1 ? ROW_PRIVADO_1_Z : ROW_PRIVADO_2_Z;
  }

  return { x, z, categoria, tipoVehiculo, esMoto: esMotoSpot };
}

/**
 * Devuelve la posición de la entrada (donde aparece el carro).
 */
export const ENTRADA = { x: -22, z: 22 };

/**
 * Calcula la ruta desde la entrada hasta una plaza destino.
 * Devuelve un array de waypoints [{x, z}, ...] que el carro recorrerá.
 */
export function calcularRuta(plazaDestino) {
  const target = plazaACoordenadas(plazaDestino);
  if (!target) return [ENTRADA];

  const waypoints = [
    { x: ENTRADA.x, z: ENTRADA.z },          // entrada
    { x: -10, z: ENTRADA.z },                // pasar barrera
    { x: -10, z: target.z + (target.z > 0 ? 4 : -4) }, // vía central, antes de girar
    { x: target.x, z: target.z + (target.z > 0 ? 4 : -4) }, // alinear con plaza
    { x: target.x, z: target.z },            // entrar a la plaza
  ];

  return waypoints;
}

/**
 * Genera una lista de plazas "fake" para visualización cuando no hay datos
 * reales del backend (modo standalone / demo).
 */
export function generarPlazasDemo() {
  const plazas = [];
  // Privados: P-001 a P-014
  for (let i = 1; i <= 14; i++) {
    plazas.push({
      _id: `demo-p-${i}`,
      numero: `P-${String(i).padStart(3, '0')}`,
      categoria: 'PRIVADO',
      tipoVehiculo: 'CARRO',
      estado: i === 3 || i === 7 || i === 11 ? 'OCUPADO' : 'DISPONIBLE',
    });
  }
  // Visitantes: V-001 a V-005
  for (let i = 1; i <= 5; i++) {
    plazas.push({
      _id: `demo-v-${i}`,
      numero: `V-${String(i).padStart(3, '0')}`,
      categoria: 'VISITANTE',
      tipoVehiculo: 'CARRO',
      estado: i === 2 ? 'OCUPADO' : 'DISPONIBLE',
    });
  }
  // Motos privadas
  for (let i = 1; i <= 2; i++) {
    plazas.push({
      _id: `demo-pm-${i}`,
      numero: `PM-${String(i).padStart(3, '0')}`,
      categoria: 'PRIVADO',
      tipoVehiculo: 'MOTO',
      estado: 'DISPONIBLE',
    });
  }
  // Motos visitantes
  for (let i = 1; i <= 2; i++) {
    plazas.push({
      _id: `demo-vm-${i}`,
      numero: `VM-${String(i).padStart(3, '0')}`,
      categoria: 'VISITANTE',
      tipoVehiculo: 'MOTO',
      estado: 'DISPONIBLE',
    });
  }
  return plazas;
}
