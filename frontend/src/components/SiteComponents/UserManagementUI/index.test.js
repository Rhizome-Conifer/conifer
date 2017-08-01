import React from 'react';
import ReactDOM from 'react-dom';
import { UserManagement } from 'components/UserManagement';


it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(<UserManagement loginFn={() => {}} logoutFn={() => {}} />, div);
});
