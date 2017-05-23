import React, { Component } from 'react';
import PropTypes from 'prop-types';
import isEmpty from 'lodash/isEmpty';
import find from 'lodash/find';
import map from 'lodash/map';
import { DropdownButton } from 'react-bootstrap';

import RemoteBrowserOption from 'components/RemoteBrowserOption';

import 'shared/scss/dropdown.scss';


class RemoteBrowserSelect extends Component {

  static propTypes = {
    getBrowsers: PropTypes.func,
    setBrowser: PropTypes.func,
    browsers: PropTypes.object,
    loading: PropTypes.bool,
    loaded: PropTypes.bool,
    accessed: PropTypes.number,
    activeBrowser: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = { open: false };

    this.getRemoteBrowsers = this.getRemoteBrowsers.bind(this);
    this.selectBrowser = this.selectBrowser.bind(this);
  }

  getRemoteBrowsers() {
    // load remote browsers if we don't already have them or
    // it's been 15min since last retrieval
    if (isEmpty(this.props.browsers) || !this.props.accessed || Date.now() - this.props.accessed > 15 * 60 * 1000) {
      this.props.getBrowsers();
    }

    this.setState({ open: !this.state.open });
  }

  selectBrowser(id) {
    this.setState({ open: false });
    this.props.setBrowser(id);
  }

  render() {
    const { activeBrowser, browsers, loading, loaded } = this.props;
    const { open } = this.state;

    const activeBrowserEle = find(browsers, { id: activeBrowser });

    const btn = activeBrowserEle ?
      <span className="btn-content">
        <img src={`/api/browsers/browsers/${activeBrowserEle.id}/icon`} alt="Browser Icon" />{ ` ${activeBrowserEle.name} v${activeBrowserEle.version}` }
      </span> :
      <span className="btn-content">(native) <span className="hidden-sm hidden-xs">Current</span></span>;

    return (
      <div className="input-group-btn">
        <DropdownButton
          id="cnt-button"
          title={btn}
          bsStyle="default"
          open={open}
          onToggle={this.getRemoteBrowsers}>
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
                map(browsers, browser => <RemoteBrowserOption browser={browser} key={browser.id ? browser.id : 'native'} selectBrowser={this.selectBrowser} isActive={activeBrowser === browser.id} />)
            }
            {
              <RemoteBrowserOption browser={{ id: null, name: '(native) Current' }} selectBrowser={this.selectBrowser} isActive={activeBrowser === null} />
            }
          </div>
        </DropdownButton>
      </div>
    );
  }
}

export default RemoteBrowserSelect;
