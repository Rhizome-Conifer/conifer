import React from 'react';
import ReactDOM from 'react-dom';
import { fromJS } from 'immutable';

import { UserManagementUI } from 'components/siteComponents';


it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(
    <UserManagementUI
      auth={fromJS({
        username: 'test',
        role: 'archivist',
        anon: false
      })}
      loginFn={() => {}} />,
    div
  );
});
