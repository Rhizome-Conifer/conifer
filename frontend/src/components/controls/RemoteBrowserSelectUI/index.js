import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { Col, Dropdown, Row } from 'react-bootstrap';

import { remoteBrowserMod } from 'helpers/utils';

import { RemoteBrowserOption } from 'components/controls';

import { filterBrowsers } from 'config';

class RemoteBrowserSelectUI extends PureComponent {
  static propTypes = {
    accessed: PropTypes.number,
    active: PropTypes.bool,
    activeBookmarkId: PropTypes.string,
    activeBrowser: PropTypes.string,
    activeList: PropTypes.string,
    autopilotRunning: PropTypes.bool,
    browsers: PropTypes.object,
    currMode: PropTypes.bool,
    getBrowsers: PropTypes.func,
    history: PropTypes.object,
    loading: PropTypes.bool,
    loaded: PropTypes.bool,
    params: PropTypes.object,
    selectRemoteBrowser: PropTypes.func,
    selectedBrowser: PropTypes.string,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  static defaultProps = {
    active: false
  };

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
  }

  selectBrowser = (id) => {
    const { active, activeBookmarkId, activeList, currMode, history, params, timestamp, url } = this.props;

    // this.setState({ open: false });

    if (active) {
      const { archiveId, coll, collId, extractMode, rec, user } = params;

      if (currMode.includes('replay')) {
        // list replay
        if (activeBookmarkId) {
          history.push(`/${user}/${coll}/list/${activeList}/b${activeBookmarkId}/${remoteBrowserMod(id, timestamp)}/${url}`);
        } else {
          history.push(`/${user}/${coll}/${remoteBrowserMod(id, timestamp)}/${url}`);
        }
      } else if (currMode === 'record') {
        history.push(`/${user}/${coll}/${rec}/record/${remoteBrowserMod(id, null, '/')}${url}`);
      } else if (['patch', 'record'].includes(currMode)) {
        history.push(`/${user}/${coll}/${rec}/patch/${remoteBrowserMod(id, timestamp, '/')}${url}`);
      } else if (['extract', 'extract_only'].includes(currMode)) {
        history.push(`/${user}/${coll}/${rec}/${extractMode}:${archiveId}${collId || ''}/${remoteBrowserMod(id, timestamp, '/')}${url}`);
      }
    } else {
      this.props.selectRemoteBrowser(id);
    }
  }

  render() {
    const { active, activeBrowser, autopilotRunning, browsers, loading, loaded, selectedBrowser } = this.props;
    const { open } = this.state;

    // if this in an active instance of the widget (on replay/record interface) use activeBrowser prop
    // otherwise use the selected browser from the ui.
    const instanceContext = active ? activeBrowser : selectedBrowser;

    const activeBrowserEle = browsers ? browsers.find(b => b.get('id') === instanceContext) : null;

    let showBrowsers = [];

    if (browsers && filterBrowsers) {
      filterBrowsers.forEach((id) => {
        const browser = browsers.get(id);
        if (browser) {
          showBrowsers.push(browser);
        }
      });
    } else if (browsers) {
      showBrowsers = browsers.valueSeq();
    }

    const btn = activeBrowserEle ?
      (
        <span className="btn-content">
          <img src={`/api/browsers/browsers/${activeBrowserEle.get('id')}/icon`} alt="Browser Icon" />{ ` ${activeBrowserEle.get('name')} v${activeBrowserEle.get('version')}` }
        </span>
      ) :
      (<span className="btn-content">{active ? 'Current Browser' : 'Use Current Browser'}</span>);

    return (
      <Dropdown
        id="cnt-button"
        variant="outline-secondary"
        disabled={autopilotRunning}
        onToggle={this.getRemoteBrowsers}>
        <Dropdown.Toggle block variant="outline-secondary">{btn}</Dropdown.Toggle>
        <Dropdown.Menu>
          <div className="container">
            <Row>
              <Col><h6 className="dropdown-header">browser</h6></Col>
              <Col><h6 className="dropdown-header">version</h6></Col>
              <Col className="d-none d-lg-block"><h6 className="dropdown-header">release</h6></Col>
              <Col className="d-none d-lg-block"><h6 className="dropdown-header">OS</h6></Col>
              <Col><h6 className="dropdown-header">capabilities</h6></Col>
            </Row>
            { loading &&
              <div>loading options..</div>
            }
            { loaded && showBrowsers &&
                showBrowsers.map(browser => <RemoteBrowserOption browser={browser} key={browser.get('id') ? browser.get('id') : 'native'} selectBrowser={this.selectBrowser} isActive={instanceContext === browser.get('id')} />)
            }
            {
              <RemoteBrowserOption browser={fromJS({ id: null, name: 'Use Current Browser' })} selectBrowser={this.selectBrowser} isActive={instanceContext === null} />
            }
          </div>
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default RemoteBrowserSelectUI;
