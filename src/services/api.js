const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const parsedData = contentType.includes('application/json') ? await response.json() : await response.text();

  if (response.status === 401 && !path.startsWith('/auth')) {
    window.dispatchEvent(new CustomEvent('inv:unauthorized'));
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!response.ok) {
    const message = typeof parsedData === 'string' ? parsedData : parsedData?.message || 'Erro inesperado.';
    throw new Error(message);
  }

  return parsedData;
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

// ===== Autenticação =====
export const login = (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
export const logout = () => request('/auth/logout', { method: 'POST' });
export const fetchMe = () => request('/auth/me');
export const updateProfile = (payload) => request('/profile', { method: 'PUT', body: JSON.stringify(payload) });
export const updateProfilePassword = (current_password, password) => request('/profile/password', { method: 'PUT', body: JSON.stringify({ current_password, password }) });
export const uploadProfileAvatar = (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return request('/profile/avatar', { method: 'POST', body: formData });
};
export const fetchUsers = () => request('/users');
export const createUser = (payload) => request('/users', { method: 'POST', body: JSON.stringify(payload) });
export const updateUser = (id, payload) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const updateUserPassword = (id, password) => request(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });

// ===== Dashboard / Auditoria / Arquivo / Busca =====
export const fetchDashboard = () => request('/dashboard');
export const fetchAuditLog = (limit = 100) => request(`/audit${buildQueryString({ limit })}`);
export const fetchArchive = () => request('/archive');
export const globalSearch = (q) => request(`/search${buildQueryString({ q })}`);

// ===== Famílias =====
export const fetchFamilies = (filters = {}) => request(`/families${buildQueryString(filters)}`);
export const fetchFamily = (id) => request(`/families/${id}`);
export const createFamily = (payload) => request('/families', { method: 'POST', body: JSON.stringify(payload) });
export const updateFamily = (id, payload) => request(`/families/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const archiveFamily = (id, reason = '') => request(`/families/${id}/archive`, { method: 'POST', body: JSON.stringify({ reason }) });
export const restoreFamily = (id) => request(`/families/${id}/restore`, { method: 'POST' });
export const uploadFamilyLogo = (id, file) => {
  const formData = new FormData();
  formData.append('logo', file);
  return request(`/families/${id}/logo`, { method: 'POST', body: formData });
};

// ===== Membros =====
export const fetchMembers = (filters = {}) => request(`/members${buildQueryString(filters)}`);
export const fetchMember = (id) => request(`/members/${id}`);
export const createMember = (payload) => request('/members', { method: 'POST', body: JSON.stringify(payload) });
export const updateMember = (id, payload) => request(`/members/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const archiveMember = (id, reason = '') => request(`/members/${id}/archive`, { method: 'POST', body: JSON.stringify({ reason }) });
export const restoreMember = (id) => request(`/members/${id}/restore`, { method: 'POST' });
export const uploadMemberPhoto = (id, file) => {
  const formData = new FormData();
  formData.append('photo', file);
  return request(`/members/${id}/photo`, { method: 'POST', body: formData });
};
export const createMembership = (memberId, payload) =>
  request(`/members/${memberId}/memberships`, { method: 'POST', body: JSON.stringify(payload) });
export const updateMembership = (membershipId, payload) =>
  request(`/members/memberships/${membershipId}`, { method: 'PUT', body: JSON.stringify(payload) });
export const closeMembership = (membershipId, payload) =>
  request(`/members/memberships/${membershipId}/close`, { method: 'POST', body: JSON.stringify(payload) });

// ===== Cargos =====
export const fetchRoles = () => request('/roles');
export const createRole = (payload) => request('/roles', { method: 'POST', body: JSON.stringify(payload) });
export const updateRole = (id, payload) => request(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const reorderRoles = (ids) => request('/roles/reorder', { method: 'POST', body: JSON.stringify({ ids }) });
export const archiveRole = (id) => request(`/roles/${id}/archive`, { method: 'POST' });
export const restoreRole = (id) => request(`/roles/${id}/restore`, { method: 'POST' });

// ===== Relações =====
export const fetchRelations = (filters = {}) => request(`/relations${buildQueryString(filters)}`);
export const fetchRelation = (id) => request(`/relations/${id}`);
export const createRelation = (payload) => request('/relations', { method: 'POST', body: JSON.stringify(payload) });
export const updateRelation = (id, payload) => request(`/relations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const endRelation = (id, notes = '') => request(`/relations/${id}/end`, { method: 'POST', body: JSON.stringify({ notes }) });
export const archiveRelation = (id) => request(`/relations/${id}/archive`, { method: 'POST' });
export const restoreRelation = (id) => request(`/relations/${id}/restore`, { method: 'POST' });
export const uploadRelationEvidence = (id, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return request(`/relations/${id}/attachments`, { method: 'POST', body: formData });
};
export const deleteRelationEvidence = (attachmentId) =>
  request(`/relations/attachments/${attachmentId}`, { method: 'DELETE' });

// ===== Produtos por família =====
export const fetchProducts = (filters = {}) => request(`/products${buildQueryString(filters)}`);
export const createProduct = (payload) => request('/products', { method: 'POST', body: JSON.stringify(payload) });
export const updateProduct = (id, payload) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteProduct = (id) => request(`/products/${id}`, { method: 'DELETE' });
export const uploadProductPhoto = (id, file) => {
  const formData = new FormData();
  formData.append('photo', file);
  return request(`/products/${id}/photo`, { method: 'POST', body: formData });
};

// ===== Fotos de localização/QG da família =====
export const uploadFamilyPhotos = (id, files, category) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('category', category);
  return request(`/families/${id}/photos`, { method: 'POST', body: formData });
};
export const deleteFamilyPhoto = (attachmentId) =>
  request(`/families/attachments/${attachmentId}`, { method: 'DELETE' });

// ===== Investigações =====
export const fetchInvestigations = (filters = {}) => request(`/investigations${buildQueryString(filters)}`);
export const fetchInvestigation = (id) => request(`/investigations/${id}`);
export const createInvestigation = (payload) => request('/investigations', { method: 'POST', body: JSON.stringify(payload) });
export const updateInvestigation = (id, payload) => request(`/investigations/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const addInvolvedMember = (id, payload) => request(`/investigations/${id}/members`, { method: 'POST', body: JSON.stringify(payload) });
export const removeInvolvedMember = (id, linkId) => request(`/investigations/${id}/members/${linkId}`, { method: 'DELETE' });
export const addInvestigationNote = (id, note) => request(`/investigations/${id}/notes`, { method: 'POST', body: JSON.stringify({ note }) });
export const deleteInvestigationNote = (id, noteId) => request(`/investigations/${id}/notes/${noteId}`, { method: 'DELETE' });
export const uploadInvestigationEvidence = (id, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  return request(`/investigations/${id}/attachments`, { method: 'POST', body: formData });
};
export const deleteInvestigationEvidence = (attachmentId) =>
  request(`/investigations/attachments/${attachmentId}`, { method: 'DELETE' });
export const archiveInvestigation = (id) => request(`/investigations/${id}/archive`, { method: 'POST' });
export const restoreInvestigation = (id) => request(`/investigations/${id}/restore`, { method: 'POST' });

// ===== Mapa de relações =====
export const fetchRelationGraph = () => request('/graph');

export default request;
