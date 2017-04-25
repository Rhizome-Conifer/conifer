import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import { DropdownButton } from 'react-bootstrap';

import 'shared/scss/dropdown.scss';


class RemoteBrowserSelect extends Component {

  static propTypes = {
    browsers: PropTypes.object,
    getBrowsers: PropTypes.func,
    loading: PropTypes.bool,
    loaded: PropTypes.bool,
    accessed: PropTypes.number
  }

  constructor(props) {
    super(props);

    this.getRemoteBrowsers = this.getRemoteBrowsers.bind(this);
    this.selectBrowser = this.selectBrowser.bind(this);
  }

  getRemoteBrowsers(isOpen, evt) {
    if (!isOpen) return;

    // load remote browsers if we don't already have them or
    // it's been 15min since last retrieval
    if (isEmpty(this.props.browsers) || (Date.now() - this.props.accessed) > 15 * 60 * 60) {
      this.props.getBrowsers();
    }
  }

  selectBrowser(evt) {
    evt.preventDefault();

    console.log(evt.target);
    // this.props.setBrowser(browser.id);
  }

  render() {
    const { browsers, loading, loaded } = this.props;
    const activeBrowser = null;

    const nativeClasses = br => classNames('row cnt-browser', {
      active: activeBrowser === br,
    });

    const btn = activeBrowser ?
      <span className="btn-content">
        <img src={`/api/browsers/browsers/${activeBrowser.id}/icon`} alt="Browser Icon" /> { activeBrowser.name } v{ activeBrowser.version }
      </span> :
      <span className="btn-content">(native) <span className="hidden-sm hidden-xs">Current</span></span>;

    return (
      <div className="input-group-btn">
        <DropdownButton
          id="cnt-button"
          title={btn}
          bsStyle="default"
          onToggle={this.getRemoteBrowsers}
          onSelect={this.selectBrowser}>
          <div className="container">
            <ul className="row">
              <li className="col-xs-2"><h6 className="dropdown-header">browser</h6></li>
              <li className="col-xs-2"><h6 className="dropdown-header">version</h6></li>
              <li className="col-xs-2"><h6 className="dropdown-header">release</h6></li>
              <li className="col-xs-2"><h6 className="dropdown-header">OS</h6></li>
              <li className="col-xs-4"><h6 className="dropdown-header">capabilities</h6></li>
            </ul>
            { loading &&
              <div>loading options..</div>
            }
            { loaded && !isEmpty(browsers) &&
                map(browsers, (browser, key) =>
                  <ul className={nativeClasses(browser.id)} data-native="true" key={key}>
                    <li className="col-xs-2">
                      <button onClick={this.selectBrowser}>
                        <img src={`/api/browsers/browsers/${browser.id}/icon`} role="presentation" />&nbsp;<span>{ browser.name }</span>
                      </button>
                    </li>
                    <li className="col-xs-2">v{ browser.version }</li>
                    <li className="col-xs-2">{ browser.release }</li>
                    <li className="col-xs-2">{ browser.os }</li>
                    <li className="col-xs-4">{ browser.caps ? browser.caps : '-' }</li>
                  </ul>
                )
            }
            <ul className={nativeClasses(null)} data-native="true">
              <li className="col-xs-2">(native) Current</li>
              <li className="col-xs-2">-</li>
              <li className="col-xs-2">-</li>
              <li className="col-xs-2">-</li>
              <li className="col-xs-4">-</li>
            </ul>
          </div>
        </DropdownButton>
      </div>
    );
  }
}

export default RemoteBrowserSelect;
