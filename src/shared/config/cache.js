/**
 * Sistema de Cache en Memoria
 * Cache simple para respuestas frecuentes
 * Puede ser reemplazado por Redis en producción si es necesario
 */

class MemoryCache {
    constructor(options = {}) {
        this.cache = new Map();
        this.defaultTTL = options.defaultTTL || 60 * 1000; // 1 minuto por defecto
        this.maxSize = options.maxSize || 1000; // Máximo 1000 entradas
        this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // Limpiar cada 5 min

        // Estadísticas
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0
        };

        // Iniciar limpieza periódica
        this._startCleanup();
    }

    /**
     * Obtener valor del cache
     * @param {string} key - Clave
     * @returns {any} Valor o undefined si no existe/expiró
     */
    get(key) {
        const item = this.cache.get(key);

        if (!item) {
            this.stats.misses++;
            return undefined;
        }

        // Verificar si expiró
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        this.stats.hits++;
        return item.value;
    }

    /**
     * Guardar valor en cache
     * @param {string} key - Clave
     * @param {any} value - Valor a guardar
     * @param {number} ttl - Tiempo de vida en milisegundos (opcional)
     */
    set(key, value, ttl = this.defaultTTL) {
        // Evitar que el cache crezca demasiado
        if (this.cache.size >= this.maxSize) {
            this._evictOldest();
        }

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now()
        });

        this.stats.sets++;
    }

    /**
     * Eliminar valor del cache
     * @param {string} key - Clave
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Eliminar múltiples claves que coincidan con un patrón
     * @param {string} pattern - Patrón (ej: "usuarios:*")
     */
    deletePattern(pattern) {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        let deleted = 0;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deleted++;
            }
        }

        return deleted;
    }

    /**
     * Limpiar todo el cache
     */
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0, sets: 0 };
    }

    /**
     * Obtener estadísticas del cache
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            size: this.cache.size,
            hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Eliminar entradas expiradas
     */
    _cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cache: ${cleaned} entradas expiradas eliminadas`);
        }
    }

    /**
     * Eliminar la entrada más antigua cuando se alcanza el límite
     */
    _evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, item] of this.cache.entries()) {
            if (item.createdAt < oldestTime) {
                oldestTime = item.createdAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Iniciar limpieza periódica
     */
    _startCleanup() {
        setInterval(() => this._cleanup(), this.cleanupInterval);
    }
}

// Crear instancia singleton
const cache = new MemoryCache({
    defaultTTL: 60 * 1000,      // 1 minuto por defecto
    maxSize: 500,               // Máximo 500 entradas
    cleanupInterval: 5 * 60 * 1000  // Limpiar cada 5 minutos
});

module.exports = cache;