import forEach from 'lodash/forEach';

import { endpoint } from 'config';


const fetchOptions = { credentials: 'same-origin' };


function buildQueryString(params) {
  const parts = [];
  forEach(params, (v, k) => parts.push(`${k}=${v}`));

  return `?${parts.join('&')}`;
}

function buildEndpoint() {
  const isAbsolute = endpoint.startsWith('/');
  return endpoint.startsWith('http') ? endpoint : `${window.location.protocol}//${window.location.host}${isAbsolute?'':'/'}${endpoint}`;
}

function errorHandler(err) {
  console.log('api', err);
}

function apiGet(url) {
  return fetch(`${buildEndpoint() + url}`, fetchOptions)
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error(`Server error! ${res.url}`);
    });
}

function apiPut(url, data) {
  const body = new FormData();
  body.append('json', JSON.stringify(data));
  return fetch(`${buildEndpoint() + url}`,
    {
      ...fetchOptions,
      method: 'PUT',
      body,
    })
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error('Server error!');
    });
}

export function getDashboard() {
  return apiGet('/dashboard/')
          .catch(errorHandler);
}

export function getSettings() {
  return apiGet('/settings')
          .catch(errorHandler);
}

export function getTempUsers() {
  return apiGet('/temp-users')
          .then(data => data.users)
          .catch(errorHandler);
}

export function getUsers(params) {
  let qs;

  if(params)
    qs = buildQueryString(params);

  return apiGet(`/users/${typeof qs !== 'undefined' ? qs : ''}`)
          .then(data => data.users)
          .catch(errorHandler);
}

export function getUser(username) {
  return apiGet(`/users/${username}`)
          .then(data => data.user)
          .catch(errorHandler);
}

export function getUserRoles() {
  return apiGet('/user_roles')
          .then(data => data.roles)
          .catch(errorHandler);
}

export function updateSettings(data) {
  return apiPut('/settings', data)
          .then((json) => {
            if(json.errors) {
              throw(json.errors);
            }
            return json;
          })
          .catch(errorHandler);
}

export function updateUser(username, data) {
  return apiPut(`/users/${username}`, data)
          .then((json) => {
            if(json.errors) {
              throw(json.errors);
            }
            return json.user;
          })
          .catch(errorHandler);
}

export function setCollectionVisibility(user, coll, visiblity) {
  const data = new FormData();
  data.append('public', visiblity);

  // notify user if we're turning off visibility
  if(visiblity === false)
    data.append('notify', true);

  return fetch(`${buildEndpoint()}/collections/${coll}/public?user=${user}`,
    {
      ...fetchOptions,
      method: 'POST',
      body: data,
    })
    .then(res => res.status === 200)
    .catch(errorHandler);
}
