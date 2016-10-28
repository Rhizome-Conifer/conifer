import forEach from 'lodash/forEach';

import { endpoint } from 'config';


const fetchOptions = {credentials: 'same-origin'};


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

export function getDashboard() {
  return fetch(`${buildEndpoint()}/dashboard/`, fetchOptions)
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error(`Server error! ${res.url}`);
    })
    .catch(errorHandler);
}

export function getTempUsers() {
  return fetch(`${buildEndpoint()}/temp-users`, fetchOptions)
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error(`Server error! ${res.url}`);
    })
    .then(data => data.users)
    .catch(errorHandler);
}

export function getUsers(params) {
  let qs;

  if(params)
    qs = buildQueryString(params);

  return fetch(`${buildEndpoint()}/users/${typeof qs !== 'undefined' ? qs : ''}`, fetchOptions)
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error(`Server error! ${res.url}`);
    })
    .then(data => data.users)
    .catch(errorHandler);
}

export function getUser(username) {
  return fetch(`${buildEndpoint()}/users/${username}`, fetchOptions)
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error('Server error!');
    })
    .then(data => data.user)
    .catch(errorHandler);
}

export function updateUser(username, data) {
  const body = new FormData();
  body.append('json', JSON.stringify(data));
  return fetch(`${buildEndpoint()}/users/${username}`,
    {
      ...fetchOptions,
      method: 'PUT',
      body,
    })
    .then((res) => {
      if(res.status === 200 && !res.url.endsWith('_login')) return res.json();
      else if(res.url.endsWith('_login')) window.location = '/_login';
      throw new Error('Server error!');
    })
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
  if(visiblity===false)
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
