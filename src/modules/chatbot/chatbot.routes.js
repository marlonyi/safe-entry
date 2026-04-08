const express = require('express');
const router = express.Router();
const chatbotService = require('./chatbot.service');
const { verificarToken } = require('../../shared/middlewares/auth.middleware');

/**
 * @route POST /api/chat
 * @desc Consulta al chatbot inteligente usando Groq AI
 * @access Privado
 */
router.post('/', verificarToken, async (req, res) => {
    try {
        const { message } = req.body;
        // Si el middleware verificarToken agrega req.usuario
        const conjuntoId = req.usuario ? req.usuario.conjunto : null;
        
        if (!message) {
            return res.status(400).json({ error: 'El mensaje es requerido' });
        }

        const responseString = await chatbotService.processChatQuery(message, conjuntoId);
        
        res.json({
            success: true,
            response: responseString
        });
    } catch (error) {
        console.error('Error en chatbot route:', error);
        
        // Manejar el caso donde no hay clave configurada de Groq
        if (error.message.includes("GROQ_API_KEY")) {
            return res.status(503).json({ 
                error: 'Servicio no disponible', 
                mensaje: error.message 
            });
        }

        res.status(500).json({ 
            error: 'Error procesando la consulta con AI', 
            mensaje: error.message 
        });
    }
});

module.exports = router;
