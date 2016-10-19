import { actionKey } from 'config';

const component = 'UserList';

export const LOAD_TEMP_USERS = `${actionKey + component}/LOAD_TEMP_USERS`;
export const LOAD_USERS = `${actionKey + component}/LOAD_USERS`;
export const LOAD_USERS_SUCCESS = `${actionKey + component}/LOAD_USERS_SUCCESS`;
export const LOAD_USERS_ERROR = `${actionKey + component}/LOAD_USERS_ERROR`;
