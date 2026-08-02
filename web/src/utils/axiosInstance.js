import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api/v1`;

const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
});

// Flag to prevent multiple simultaneous refresh requests
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Authentication requests handle their own 401 errors (for example, invalid login credentials).
    if (error.response?.status === 401 && !originalRequest.skipAuthRefresh && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");
      
      if (!refreshToken) {
        // No refresh token, redirect to login
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // Request new access token
        const response = await axios.post(
          `${apiBaseUrl}/token/refresh`,
          { refresh_token: refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { access_token, refresh_token: newRefreshToken } = response.data;
        
        // Store new tokens
        localStorage.setItem("access_token", access_token);
        if (newRefreshToken) {
          localStorage.setItem("refresh_token", newRefreshToken);
        }

        // Update authorization header
        axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        // Process queued requests
        processQueue(null, access_token);
        isRefreshing = false;

        // Retry original request
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear session and redirect to login
        processQueue(refreshError, null);
        isRefreshing = false;
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
