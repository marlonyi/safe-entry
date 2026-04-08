import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para inyectar el token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor para desempaquetar la nueva estructura del backend ({ success, data, message })
api.interceptors.response.use(
  (response) => {
    // Si el backend devuelve un wrapper con { data, success }, desempacamos la data y guardamos el message
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        // Adjuntamos el message por si alguien lo necesita para un toast
        const responseData = response.data.data;
        if (responseData && typeof responseData === 'object') {
           responseData._message = response.data.message;
        } else if (responseData === null) {
           return { data: { _status: "success", _message: response.data.message } };
        }
        response.data = responseData;
      }
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
