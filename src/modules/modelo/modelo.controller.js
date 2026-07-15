/**
 * Controlador del Modelo de Programación Lineal.
 *
 * Calcula los parámetros del modelo desde datos REALES de la BD:
 *   - Plazas actuales (Parqueadero)
 *   - Rotación histórica de visitantes (HistorialAcceso JOIN Visitante por placa)
 *   - Horas-portero disponibles (count de usuarios con rol 'porteria')
 *   - Visitantes atendidos hoy y en los últimos 30 días
 *
 *   x₁ = plazas visitantes para carros
 *   x₂ = plazas visitantes para motos
 *
 *   Max  Z = r₁·x₁ + r₂·x₂
 *   s.a. a₁·x₁ + a₂·x₂       <= A    (área m²)
 *        r₁·t₁·x₁ + r₂·t₂·x₂ <= H    (horas portero/día)
 *        x₁                  >= x₁min
 *        x₂                  <= x₂max
 */

const mongoose = require('mongoose');
const parqueaderoService = require('../parqueaderos/parqueadero.service');
const HistorialAcceso = require('../../shared/models/historialAcceso');
const Usuario = require('../usuarios/usuario.model');
const Conjunto = require('../conjuntos/conjunto.model');

// === Constantes operativas (estándares urbanísticos y datos sectoriales) ===
const AREA_CARRO_M2 = 12.5;              // Plaza estándar carro (5.0 × 2.5 m)
const AREA_MOTO_M2 = 2.5;                // Plaza estándar moto (2.0 × 1.25 m)
const HORAS_TURNO_PORTERO = 8;           // Un turno = 8 horas
const FRACCION_TIEMPO_VISITANTES = 0.5;  // 50% del turno se dedica a visitantes
const TIEMPO_REGISTRO_CARRO_H = 0.10;    // ≈ 6 min por carro
const TIEMPO_REGISTRO_MOTO_H = 0.05;     // ≈ 3 min por moto
const DIAS_OBSERVACION = 30;             // Ventana histórica para calcular rotación

/**
 * GET /api/modelo/conjuntos
 * Lista los conjuntos activos para el selector.
 */
exports.listarConjuntos = async (req, res) => {
    try {
        const conjuntos = await Conjunto.find({ estado: 'activo' })
            .select('_id nombre ciudad')
            .sort({ nombre: 1 })
            .lean();
        res.json({ success: true, data: conjuntos });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/modelo/parametros/:conjuntoId
 * Calcula y retorna todos los parámetros del modelo desde datos reales.
 */
exports.obtenerParametros = async (req, res) => {
    try {
        const { conjuntoId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(conjuntoId)) {
            return res.status(400).json({ success: false, message: 'conjuntoId inválido' });
        }
        const conjuntoObjId = new mongoose.Types.ObjectId(conjuntoId);

        const conjunto = await Conjunto.findById(conjuntoObjId).lean();
        if (!conjunto) {
            return res.status(404).json({ success: false, message: 'Conjunto no encontrado' });
        }

        // === 1. Plazas actuales del conjunto ===
        // Misma fuente de conteos que dashboard y chatbot (parqueadero.service)
        const plazas = await parqueaderoService.contarPlazasPorCategoria({ conjunto: conjuntoObjId });
        const plazasCarroPriv = plazas.privadoCarro.total;
        const plazasMotoPriv = plazas.privadoMoto.total;

        const x1Actual = plazas.visitanteCarro.total;
        const x2Actual = plazas.visitanteMoto.total;

        // === 2. Área física disponible (m²) ===
        // Se calcula como el área que YA está asignada a la zona de visitantes.
        // El modelo decide cómo redistribuir ese mismo espacio entre carro y moto.
        const A = Math.max(1, x1Actual * AREA_CARRO_M2 + x2Actual * AREA_MOTO_M2);

        // === 3. Rotación real desde historialaccesos (últimos 30 días) ===
        // JOIN con la colección `visitantes` por placaVehiculo para leer su tipoVehiculo
        // (campo poblado desde el formulario del residente). Confiable y por conjunto.
        const fechaInicio = new Date(Date.now() - DIAS_OBSERVACION * 24 * 60 * 60 * 1000);

        const rotacionAgg = await HistorialAcceso.aggregate([
            {
                $match: {
                    conjunto: conjuntoObjId,
                    tipoUsuario: 'visitante',
                    tipoAcceso: 'entrada',
                    fechaHora: { $gte: fechaInicio }
                }
            },
            {
                $lookup: {
                    from: 'visitantes',
                    let: { placa: '$placa', conj: '$conjunto' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$conjunto', '$$conj'] },
                                        { $eq: ['$placaVehiculo', '$$placa'] }
                                    ]
                                }
                            }
                        },
                        { $project: { tipoVehiculo: 1 } },
                        { $limit: 1 }
                    ],
                    as: 'visit'
                }
            },
            { $unwind: { path: '$visit', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: { $ifNull: ['$visit.tipoVehiculo', 'DESCONOCIDO'] },
                    total: { $sum: 1 }
                }
            }
        ]);

        const entradasCarro = rotacionAgg.find(g => g._id === 'CARRO')?.total || 0;
        const entradasMoto = rotacionAgg.find(g => g._id === 'MOTO')?.total || 0;
        const entradasDesconocidas = rotacionAgg.find(g => g._id === 'DESCONOCIDO')?.total || 0;

        // Rotación = entradas / plazas disponibles / días observados
        const r1Real = entradasCarro / Math.max(x1Actual, 1) / DIAS_OBSERVACION;
        const r2Real = entradasMoto / Math.max(x2Actual, 1) / DIAS_OBSERVACION;

        // Fallback: si el historial es pobre, usar promedios sectoriales razonables
        const r1 = r1Real > 0.1 ? Math.round(r1Real * 100) / 100 : 3;
        const r2 = r2Real > 0.1 ? Math.round(r2Real * 100) / 100 : 5;

        // === 4. Horas-portero disponibles para visitantes ===
        const totalPorteros = await Usuario.countDocuments({
            conjunto: conjuntoObjId,
            rol: 'porteria'
        });
        const porterosEfectivos = Math.max(totalPorteros, 1);
        const H = Math.round(porterosEfectivos * HORAS_TURNO_PORTERO * FRACCION_TIEMPO_VISITANTES);

        // === 5. Tiempos de registro (constantes operativas) ===
        const t1 = TIEMPO_REGISTRO_CARRO_H;
        const t2 = TIEMPO_REGISTRO_MOTO_H;

        // === 6. Límites institucionales ===
        // Mínimo razonable: 2 plazas o el 50% de las actuales, lo que sea mayor
        const x1Min = Math.max(2, Math.floor(x1Actual * 0.5));
        // Máximo: el menor entre el límite del plan y el espacio físico disponible
        const maxPlan = conjunto.plan?.limites?.maxParqueaderos
            || conjunto.configuracion?.maxParqueaderos
            || 20;
        const x2Max = Math.min(maxPlan, Math.max(1, Math.floor(A / AREA_MOTO_M2)));

        // === 7. Métricas reales para comparar con la solución óptima ===
        const inicioDia = new Date();
        inicioDia.setHours(0, 0, 0, 0);
        const visitantesHoy = await HistorialAcceso.countDocuments({
            conjunto: conjuntoObjId,
            tipoUsuario: 'visitante',
            tipoAcceso: 'entrada',
            fechaHora: { $gte: inicioDia }
        });

        return res.json({
            success: true,
            data: {
                conjunto: {
                    id: conjunto._id,
                    nombre: conjunto.nombre,
                    ciudad: conjunto.ciudad
                },
                parametros: {
                    a1: AREA_CARRO_M2,
                    a2: AREA_MOTO_M2,
                    A: Math.round(A * 100) / 100,
                    r1,
                    r2,
                    t1,
                    t2,
                    H,
                    x1Min,
                    x2Max
                },
                estadoActual: {
                    x1Actual,
                    x2Actual,
                    plazasPrivadoCarro: plazasCarroPriv,
                    plazasPrivadoMoto: plazasMotoPriv,
                    totalPorteros: porterosEfectivos,
                    visitantesHoy,
                    visitantesUltimos30Dias: entradasCarro + entradasMoto + entradasDesconocidas,
                    entradasCarro30d: entradasCarro,
                    entradasMoto30d: entradasMoto,
                    entradasDesconocidas30d: entradasDesconocidas
                },
                fuentes: {
                    a1: 'Estándar urbanístico colombiano (5.0×2.5 m)',
                    a2: 'Estándar urbanístico colombiano (2.0×1.25 m)',
                    A: `${x1Actual} carros × ${AREA_CARRO_M2} m² + ${x2Actual} motos × ${AREA_MOTO_M2} m² (suma de plazas visitante actuales)`,
                    r1: r1Real > 0.1
                        ? `${entradasCarro} entradas de carros / ${x1Actual} plazas / ${DIAS_OBSERVACION} días (JOIN historialaccesos ⋈ visitantes)`
                        : 'Promedio sectorial (sin historial suficiente de carros en últimos 30 días)',
                    r2: r2Real > 0.1
                        ? `${entradasMoto} entradas de motos / ${x2Actual} plazas / ${DIAS_OBSERVACION} días (JOIN historialaccesos ⋈ visitantes)`
                        : 'Promedio sectorial (sin historial suficiente de motos en últimos 30 días)',
                    t1: 'Tiempo operativo típico de registro (escaneo QR + placa)',
                    t2: 'Tiempo operativo típico de registro (más ágil que carro)',
                    H: `${porterosEfectivos} portero(s) × ${HORAS_TURNO_PORTERO} h × ${FRACCION_TIEMPO_VISITANTES * 100}% dedicado a visitantes = ${H} h/día`,
                    x1Min: `max(2, 50% de plazas carro actuales) = ${x1Min}`,
                    x2Max: `min(plan.maxParqueaderos=${maxPlan}, área/a₂)`
                }
            }
        });
    } catch (error) {
        console.error('Error obteniendo parámetros del modelo:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
