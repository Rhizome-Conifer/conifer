import { LOAD_DASHBOARD, LOAD_DASHBOARD_SUCCESS } from './constants';


export function loadDashboard() {
  return {
    type: LOAD_DASHBOARD,
  };
}

export function dashboardLoaded(users) {
  return {
    type: LOAD_DASHBOARD_SUCCESS,
    users,
  };
}
