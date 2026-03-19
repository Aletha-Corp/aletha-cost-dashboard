import axios from 'axios';

/**
 * Axios instance — all requests go through /api (proxied in dev, same-origin in prod).
 * No credentials, API keys, or secrets are stored in frontend code.
 */
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message: string =
      error.response?.data?.error ?? error.message ?? 'An unknown error occurred';
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
