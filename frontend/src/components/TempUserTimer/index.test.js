import React from 'react';
import ReactDOM from 'react-dom';
import { shallow } from 'enzyme';

import TempUserTimer from './index';


it('renders without crashing', () => {
  const div = document.createElement('div');
  ReactDOM.render(
    <TempUserTimer accessed={Date.now() - (60 * 1000)} ttl={120} />,
    div
  );
});


it('1 minute remaining', () => {
  const oneMin = shallow(<TempUserTimer accessed={Date.now() - (60 * 1000)} ttl={120} />);
  expect(oneMin.text()).toEqual('01 min, 00 sec');
});


it('five seconds expired', () => {
  const outOfTime = shallow(<TempUserTimer accessed={Date.now() - (5 * 1000)} ttl={0} />);
  expect(outOfTime.text()).toEqual('00 min, 00 sec');
});
