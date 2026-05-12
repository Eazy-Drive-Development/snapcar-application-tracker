type LoginPayload = {
  username: string;
  password: string;
};

type LoginResponse = {
  ok: boolean;
  message: string;
};

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api';

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${apiBase}${path}`, init);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
};

export const login = async (payload: LoginPayload): Promise<LoginResponse> =>
  fetchJson<LoginResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
