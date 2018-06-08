import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { DropdownButton } from 'react-bootstrap';

import { remoteBrowserMod } from 'helpers/utils';

import { RemoteBrowserOption } from 'components/controls';

import 'shared/scss/dropdown.scss';


class RemoteBrowserSelectUI extends PureComponent {

  static propTypes = {
    accessed: PropTypes.number,
    active: PropTypes.bool,
    activeBookmarkId: PropTypes.string,
    activeBrowser: PropTypes.string,
    activeList: PropTypes.string,
    browsers: PropTypes.object,
    getBrowsers: PropTypes.func,
    loading: PropTypes.bool,
    loaded: PropTypes.bool,
    params: PropTypes.object,
    selectRemoteBrowser: PropTypes.func,
    selectedBrowser: PropTypes.string,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  static contextTypes = {
    router: PropTypes.object,
    currMode: PropTypes.string
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

    this.setState({ open: !this.state.open });
  }

  selectBrowser = (id) => {
    const { active, activeBookmarkId, activeList, params, timestamp, url } = this.props;
    const { currMode } = this.context;

    this.setState({ open: false });

    if (active) {
      const { archiveId, coll, collId, extractMode, rec, user } = params;

      if (currMode.includes('replay')) {
        // list replay
        if (activeBookmarkId) {
          this.context.router.history.push(`/${user}/${coll}/list/${activeList}/b${activeBookmarkId}/${remoteBrowserMod(id, timestamp)}/${url}`);
        } else {
          this.context.router.history.push(`/${user}/${coll}/${remoteBrowserMod(id, timestamp)}/${url}`);
        }
      } else if (currMode === 'record') {
        this.context.router.history.push(`/${user}/${coll}/${rec}/record/${remoteBrowserMod(id, null, '/')}${url}`);
      } else if (['patch', 'record'].includes(currMode)) {
        this.context.router.history.push(`/${user}/${coll}/${rec}/patch/${remoteBrowserMod(id, timestamp, '/')}${url}`);
      } else if (['extract', 'extract_only'].includes(currMode)) {
        this.context.router.history.push(`/${user}/${coll}/${rec}/${extractMode}:${archiveId}${collId || ''}/${remoteBrowserMod(id, timestamp, '/')}${url}`);
      }
    } else {
      this.props.selectRemoteBrowser(id);
    }
  }

  render() {
    const { active, activeBrowser, browsers, loading, loaded, selectedBrowser } = this.props;
    const { open } = this.state;

    // if this in an active instance of the widget (on replay/record interface) use activeBrowser prop
    // otherwise use the selected browser from the ui.
    const instanceContext = active ? activeBrowser : selectedBrowser;

    const activeBrowserEle = browsers ? browsers.find(b => b.get('id') === instanceContext) : null;

    const btn = activeBrowserEle ?
      (
        <span className="btn-content">
          <img src={`/api/browsers/browsers/${activeBrowserEle.get('id')}/icon`} alt="Browser Icon" />{ ` ${activeBrowserEle.get('name')} v${activeBrowserEle.get('version')}` }
        </span>
      ) :
      (<span className="btn-content">{active ? 'Current Browser' : 'Use Current Browser'}</span>);

    return (
      <DropdownButton
        id="cnt-button"
        title={btn}
        bsStyle="default"
        open={open}
        onToggle={this.getRemoteBrowsers}>
        <div className="container">
          <ul className="row">
            <li className="col-sm-2 col-xs-4"><h6 className="dropdown-header">browser</h6></li>
            <li className="col-sm-2 col-xs-4"><h6 className="dropdown-header">version</h6></li>
            <li className="col-sm-2"><h6 className="dropdown-header hidden-xs">release</h6></li>
            <li className="col-sm-2"><h6 className="dropdown-header hidden-xs">OS</h6></li>
            <li className="col-sm-4 col-xs-4"><h6 className="dropdown-header">capabilities</h6></li>
          </ul>
          { loading &&
            <div>loading options..</div>
          }
          { loaded && browsers &&
              browsers.valueSeq().map(browser => <RemoteBrowserOption browser={browser} key={browser.get('id') ? browser.get('id') : 'native'} selectBrowser={this.selectBrowser} isActive={instanceContext === browser.get('id')} />)
          }
          {
            <RemoteBrowserOption browser={fromJS({ id: null, name: 'Use Current Browser' })} selectBrowser={this.selectBrowser} isActive={instanceContext === null} />
          }
        </div>
      </DropdownButton>
    );
  }
}

export default RemoteBrowserSelectUI;
