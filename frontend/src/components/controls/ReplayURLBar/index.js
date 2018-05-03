import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { remoteBrowserMod } from 'helpers/utils';

import { InfoWidget, RemoteBrowserSelect } from 'containers';

import TimeFormat from 'components/TimeFormat';

import './style.scss';


class ReplayURLBar extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    router: PropTypes.object
  }

  static propTypes = {
    activeBrowser: PropTypes.string,
    bookmarks: PropTypes.object,
    params: PropTypes.object,
    recordingIndex: PropTypes.number,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = { url: props.url };
  }

  componentWillReceiveProps(nextProps) {
    if(nextProps.url !== this.props.url) {
      this.setState({ url: nextProps.url });
    }
  }

  handleInput = (evt) => {
    evt.preventDefault();
    this.setState({ url: evt.target.value });
  }

  handleSubmit = (evt) => {
    const { activeBrowser, params: { user, coll } } = this.props;
    const { url } = this.state;

    if (evt.key === 'Enter') {
      evt.preventDefault();
      this.context.router.history.push(`/${user}/${coll}/${remoteBrowserMod(activeBrowser, null, '/')}${url}`);
    }
  }

  render() {
    const { canAdmin } = this.context;
    const { params, timestamp } = this.props;
    const { url } = this.state;

    return (
      <div className="main-bar">
        <form className="form-group-recorder-url">
          <div className="input-group containerized">
            <div className="input-group-btn rb-dropdown">
              {
                canAdmin &&
                  <RemoteBrowserSelect
                    active
                    params={params} />
              }
            </div>

            <div className="wr-app-url">
              <input type="text" onChange={this.handleInput} onKeyPress={this.handleSubmit} className="form-control dropdown-toggle" name="url" aria-haspopup="true" value={url} autoComplete="off" />
              <div className="wr-replay-info">
                <InfoWidget />
                <span className="replay-date main-replay-date hidden-xs">
                  <TimeFormat dt={timestamp} />
                </span>
              </div>
            </div>

          </div>
        </form>
      </div>
    );
  }
}

export default ReplayURLBar;
