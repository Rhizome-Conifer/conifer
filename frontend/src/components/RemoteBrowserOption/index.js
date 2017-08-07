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
    props.selectBrowser(props.browser.id);
  };

  return (
    <ul className={classes} onClick={click} role="button" data-native="true">
      <li className="col-xs-2">
        { browser.id &&
          <img src={`/api/browsers/browsers/${browser.id}/icon`} role="presentation" />
        }
        <span>{ browser.name }</span>
      </li>
      <li className="col-xs-2">{ browser.version ? `v${browser.version}` : '-' }</li>
      <li className="col-xs-2">{ browser.release ? browser.release : '-' }</li>
      <li className="col-xs-2">{ browser.os ? browser.os : '-' }</li>
      <li className="col-xs-4">{ browser.caps ? browser.caps : '-' }</li>
    </ul>
  );
}

RemoteBrowserOption.propTypes = {
  browser: PropTypes.object,
  isActive: PropTypes.bool,
  selectBrowser: PropTypes.func
};

export default RemoteBrowserOption;
