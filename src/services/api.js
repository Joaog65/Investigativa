const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const parsedData = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof parsedData === 'string' ? parsedData : parsedData?.message || 'Erro inesperado.';
    throw new Error(message);
  }

  return parsedData;
}

export async function fetchCategories() {
  return request('/categories');
}

export function buildQueryString(params) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      query.append(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function fetchOrganizations(filters = {}) {
  const query = buildQueryString({
    category: filters.category || '',
    search: filters.search || '',
    product: filters.product || '',
    partnership: filters.partnership || '',
    alliance: filters.alliance || '',
    color: filters.color || '',
  });

  return request(`/organizations${query}`);
}

export async function fetchOrganization(id) {
  return request(`/organizations/${id}`);
}

export async function createOrganization(payload) {
  return request('/organizations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrganization(id, payload) {
  return request(`/organizations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOrganization(id) {
  return request(`/organizations/${id}`, {
    method: 'DELETE',
  });
}

export async function uploadOrganizationLogo(id, file) {
  const formData = new FormData();
  formData.append('logo', file);

  return request(`/organizations/${id}/logo`, {
    method: 'POST',
    body: formData,
  });
}

export async function uploadTrackTable(id, file) {
  const formData = new FormData();
  formData.append('trackTable', file);

  return request(`/organizations/${id}/track-table`, {
    method: 'POST',
    body: formData,
  });
}

export async function uploadPartnershipTable(id, file) {
  const formData = new FormData();
  formData.append('partnershipTable', file);

  return request(`/organizations/${id}/partnership-table`, {
    method: 'POST',
    body: formData,
  });
}

export async function uploadBaseImages(id, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('baseImages', file));

  return request(`/organizations/${id}/images`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteOrganizationImage(id, imageId) {
  return request(`/organizations/${id}/images/${imageId}`, {
    method: 'DELETE',
  });
}
