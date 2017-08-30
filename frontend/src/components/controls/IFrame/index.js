import React, { Component } from 'react';
import PropTypes from 'prop-types';

import './style.scss';

class IFrame extends Component {
  static propTypes = {
    url: PropTypes.string,
    params: PropTypes.object
  };

  static contextTypes = {
    currMode: PropTypes.string
  }

  componentDidMount() {
    const { params, url } = this.props;
    const { currMode } = this.context;

    // TODO: fill out wbinfo
    window.wbinfo = {
      outer_prefix: '',
      prefix: '',
      coll: params.coll,
      url,
      capture_url: '',
      reqTimestamp: params.ts,
      timestamp: params.ts,
      is_frame: true,
      frame_mod: '',
      replay_mod: '',
      state: currMode,
      sources: [],
      inv_sources: '',
      info: {}
    };
  }

  render() {
    const { url } = this.props;

    return (
      <div>
        <iframe id="replay_iframe" src={url} seamless="seamless" frameBorder="0" scrolling="yes" className="wb_iframe" />
      </div>
    );
  }
}

export default IFrame;
