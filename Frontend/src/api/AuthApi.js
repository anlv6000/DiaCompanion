const BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5136';

async function postJson(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export async function login(payload) {
  return postJson('/api/auth/login', payload);
}

export async function registerPatient(payload) {
  return postJson('/api/auth/register', payload);
}

export async function registerDoctor(payload) {
  return postJson('/api/auth/register/doctor', payload);
}
