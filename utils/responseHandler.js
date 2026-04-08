/**
 * Estandarizador de Respuestas HTTP
 * Asegura que todas las respuestas del API tengan la misma estructura
 * facilitando su consumo en Vite / React (Axios).
 */

const successResponse = (res, data = null, message = 'Operación exitosa', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    });
};

const errorResponse = (res, message = 'Error en el servidor', statusCode = 500, errors = null) => {
    const response = {
        success: false,
        error: message
    };
    if (errors) {
        response.details = errors;
    }
    return res.status(statusCode).json(response);
};

module.exports = {
    successResponse,
    errorResponse
};
