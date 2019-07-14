import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './style.scss';


function RemoteBrowserOption(props) {
  const { browser, isActive, selectBrowser } = props;

  const classes = classNames('row cnt-browser', {
    active: isActive,
  });

  const click = (evt) => {
    evt.preventDefault();
    props.selectBrowser(props.browser.get('id'));
  };

  return (
    <ul className={classes} onClick={click} role="button" data-native="true">
      <li className="col-sm-2 col-xs-4">
        { browser.get('id') &&
          <img src={`/api/browsers/browsers/${browser.get('id')}/icon`} alt="" />
        }
        <span>{ browser.get('name') }</span>
      </li>
      <li className="col-sm-2 col-xs-4">{ browser.get('version') ? `v${browser.get('version')}` : '-' }</li>
      <li className="col-xs-2 hidden-xs">{ browser.get('release') ? browser.get('release') : '-' }</li>
      <li className="col-xs-2 hidden-xs">{ browser.get('os') ? browser.get('os') : '-' }</li>
      <li className="col-xs-4">{ browser.get('caps') ? browser.get('caps') : '-' }</li>
    </ul>
  );
}

RemoteBrowserOption.propTypes = {
  browser: PropTypes.object,
  isActive: PropTypes.bool,
  selectBrowser: PropTypes.func
};

export default RemoteBrowserOption;
