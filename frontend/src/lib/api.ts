import axios, { AxiosInstance } from "axios";

const API_BASE = "";

export function createApi(token: string | null): AxiosInstance {
  const api = axios.create({ baseURL: API_BASE });
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
  return api;
}

export function withAuth(token: string | null) {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}
