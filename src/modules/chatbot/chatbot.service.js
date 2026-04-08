const process = require("process");
const Groq = require("groq-sdk");

// Dependencias de modelos (basados en la estructura real)
const HistorialAcceso = require("../../shared/models/historialAcceso");
const Visitante = require("../visitantes/visitante.model");
const Usuario = require("../usuarios/usuario.model");
const Parqueadero = require("../parqueaderos/parqueadero.model");

class ChatbotService {
    constructor() {
        // Inicializar lazily para permitir arranque sin llave
        this.groq = null;
    }

    getGroqClient() {
        if (!this.groq && process.env.GROQ_API_KEY) {
            this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        }
        return this.groq;
    }

    async getContextData(conjuntoId) {
        // Consultar datos del día (hoy)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Construir queries considerando enfoque multi-tenant si conjuntoId existe
        const queryBase = conjuntoId ? { conjunto: conjuntoId } : {};
        const queryHoy = { ...queryBase, fechaHora: { $gte: today } };

        try {
            // 1. Accesos de hoy
            const entradasHoy = await HistorialAcceso.countDocuments({ ...queryHoy, tipoAcceso: "entrada" });
            const salidasHoy = await HistorialAcceso.countDocuments({ ...queryHoy, tipoAcceso: "salida" });

            // 2. Total de Visitantes y Residentes
            const visitantesTotal = await Visitante.countDocuments(queryBase);
            const residentesTotal = await Usuario.countDocuments({ ...queryBase, rol: "residente" });

            // 3. Estado de Parqueaderos
            const parqueaderosTotal = await Parqueadero.countDocuments(queryBase);
            const parqueaderosLibres = await Parqueadero.countDocuments({ ...queryBase, estado: "DISPONIBLE" });
            const parqueaderosOcupados = await Parqueadero.countDocuments({ ...queryBase, estado: "OCUPADO" });

            return `
=== CONTEXTO ACTUAL DE LA BASE DE DATOS ===
- Vehículos que han ingresado hoy: ${entradasHoy}
- Vehículos que han salido hoy: ${salidasHoy}
- Total de visitantes registrados en el sistema: ${visitantesTotal}
- Total de residentes en el sistema: ${residentesTotal}
- Total de plazas de parqueadero: ${parqueaderosTotal}
- Parqueaderos disponibles (libres): ${parqueaderosLibres}
- Parqueaderos ocupados: ${parqueaderosOcupados}
===========================================
            `;
        } catch (error) {
            console.error("Error obteniendo contexto DB para Groq:", error);
            return "No hay contexto de base de datos disponible.";
        }
    }

    async processChatQuery(userQuery, conjuntoId) {
        const client = this.getGroqClient();
        if (!client) {
            throw new Error("El servicio de Chat no está habilitado. Verifica la variable GROQ_API_KEY.");
        }

        const context = await this.getContextData(conjuntoId);
        
        const systemPrompt = `
Eres un asistente virtual de inteligencia artificial integrado en el sistema "Admin Residencial".
Tu objetivo es responder a las preguntas del usuario sobre la administración del conjunto basándote ÚNICAMENTE en el siguiente contexto de la base de datos en tiempo real.
Responde de forma concisa (máximo 2-3 oraciones), clara y profesional. No inventes datos que no estén en el contexto.

${context}
`;

        const chatCompletion = await client.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userQuery }
            ],
            model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            temperature: 0.1, // Baja temperatura para mantener respuestas fácticas y precisas
            max_tokens: 300,
        });

        return chatCompletion.choices[0]?.message?.content || "Lo siento, no pude procesar la respuesta.";
    }
}

module.exports = new ChatbotService();
