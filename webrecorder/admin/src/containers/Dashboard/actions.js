import { LOAD_DASHBOARD, LOAD_DASHBOARD_SUCCESS } from './constants';


export function loadDashboard() {
  return {
    type: LOAD_DASHBOARD,
  };
}

export function dashboardLoaded(data) {
  return {
    type: LOAD_DASHBOARD_SUCCESS,
    data,
  };
}
