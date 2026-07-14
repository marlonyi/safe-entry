/**
 * Escapa los metacaracteres de una expresión regular para que un string
 * provisto por el usuario se trate como TEXTO LITERAL dentro de un $regex de
 * MongoDB (evita ReDoS / patrones costosos por backtracking catastrófico).
 * Patrón estándar documentado por MDN.
 */
function escaparRegex(texto) {
    return String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escaparRegex };
