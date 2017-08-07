import React from 'react';
import ReactDOM from 'react-dom';
import { UserManagementUI } from 'components/SiteComponents/UserManagementUI';


it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(
    <UserManagementUI
      auth={{
        username: 'test',
        role: 'archivist'
      }}
      collCount={0}
      loginFn={() => {}}
      logoutFn={() => {}} />,
    div
  );
});
