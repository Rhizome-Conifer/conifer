import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Dropdown, Col, Row } from 'react-bootstrap';

import './style.scss';


function RemoteBrowserOption(props) {
  const { browser, isActive, selectBrowser } = props;

  const classes = classNames('cnt-browser', {
    active: isActive,
  });

  const click = (evt) => {
    evt.preventDefault();
    props.selectBrowser(props.browser.get('id'));
  };

  return (
    <Dropdown.Item as={Row} className={classes} onClick={click} role="button" data-native="true">
      <Col>
        { browser.get('id') &&
          <img src={`/api/browsers/browsers/${browser.get('id')}/icon`} alt="" />
        }
        <span>{ browser.get('name') }</span>
      </Col>
      <Col>{ browser.get('version') ? `v${browser.get('version')}` : '-' }</Col>
      <Col className="d-none d-lg-block">{ browser.get('release') ? browser.get('release') : '-' }</Col>
      <Col className="d-none d-lg-block">{ browser.get('os') ? browser.get('os') : '-' }</Col>
      <Col>{ browser.get('caps') ? browser.get('caps') : '-' }</Col>
    </Dropdown.Item>
  );
}

RemoteBrowserOption.propTypes = {
  browser: PropTypes.object,
  isActive: PropTypes.bool,
  selectBrowser: PropTypes.func
};

export default RemoteBrowserOption;
