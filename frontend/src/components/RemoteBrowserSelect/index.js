import React, { Component } from 'react';
import classNames from 'classnames';
import { DropdownButton } from 'react-bootstrap';

import 'shared/scss/dropdown.scss';


class RemoteBrowserSelect extends Component {

  render() {
    const browsers = [];
    const activeBrowser = null;

    const nativeClasses = classNames('row cnt-browser', {
      active: !activeBrowser,
    });

    const btn = activeBrowser ?
      <span className="btn-content">
        <img src={`/api/browsers/browsers/${activeBrowser.id}/icon`} alt="Browser Icon" /> { activeBrowser.name } v{ activeBrowser.version }
      </span> :
      <span className="btn-content">(native) <span className="hidden-sm hidden-xs">Current</span></span>;

    return (
      <div className="input-group-btn">
        <DropdownButton id="cnt-button" title={btn} bsStyle="default">
          <li className="container">
            <ul className="row">
              <li className="col-xs-2"><h6 className="dropdown-header">browser</h6></li>
              <li className="col-xs-2"><h6 className="dropdown-header">version</h6></li>
              <li className="col-xs-2"><h6 className="dropdown-header">release</h6></li>
              <li className="col-xs-2"><h6 className="dropdown-header">OS</h6></li>
              <li className="col-xs-4"><h6 className="dropdown-header">capabilities</h6></li>
            </ul>
            <ul className={nativeClasses} data-native="true">
              <li className="col-xs-2">(native) Current</li>
              <li className="col-xs-2">-</li>
              <li className="col-xs-2">-</li>
              <li className="col-xs-2">-</li>
              <li className="col-xs-4">-</li>
            </ul>
          </li>
        </DropdownButton>
      </div>
    );
  }
}

export default RemoteBrowserSelect;
