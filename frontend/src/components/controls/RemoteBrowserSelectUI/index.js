import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { DropdownButton } from 'react-bootstrap';

import { RemoteBrowserOption } from 'components/controls';

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
  }

  getRemoteBrowsers = () => {
    // load remote browsers if we don't already have them or
    // it's been 15min since last retrieval
    if (!this.props.browsers || !this.props.accessed || Date.now() - this.props.accessed > 15 * 60 * 1000) {
      this.props.getBrowsers();
    }

    this.setState({ open: !this.state.open });
  }

  selectBrowser = (id) => {
    this.setState({ open: false });
    this.props.setBrowser(id);
  }

  render() {
    const { activeBrowser, browsers, loading, loaded } = this.props;
    const { open } = this.state;

    const activeBrowserEle = browsers ? browsers.find(b => b.get('id') === activeBrowser) : null;

    const btn = activeBrowserEle ?
      <span className="btn-content">
        <img src={`/api/browsers/browsers/${activeBrowserEle.get('id')}/icon`} alt="Browser Icon" />{ ` ${activeBrowserEle.get('name')} v${activeBrowserEle.get('version')}` }
      </span> :
      <span className="btn-content">(native) <span className="hidden-sm hidden-xs">Current</span></span>;

    return (
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
          { loaded && browsers &&
              browsers.valueSeq().map(browser => <RemoteBrowserOption browser={browser} key={browser.get('id') ? browser.get('id') : 'native'} selectBrowser={this.selectBrowser} isActive={activeBrowser === browser.get('id')} />)
          }
          {
            <RemoteBrowserOption browser={fromJS({ id: null, name: '(native) Current' })} selectBrowser={this.selectBrowser} isActive={activeBrowser === null} />
          }
        </div>
      </DropdownButton>
    );
  }
}

export default RemoteBrowserSelect;
