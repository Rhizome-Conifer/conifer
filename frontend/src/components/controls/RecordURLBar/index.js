import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { PatchWidget, RemoteBrowserSelect } from 'containers';

import './style.scss';


class RecordURLBar extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    router: PropTypes.object
  }

  static propTypes = {
    params: PropTypes.object
  }

  constructor(props) {
    super(props);

    const { params } = props;
    this.state = { urlInput: params.splat || '' };
  }

  handleChange = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  changeURL = (evt, url) => {
    console.log(url);
  }

  render() {
    const { currMode, canAdmin } = this.context;
    const { params } = this.props;
    const { urlInput } = this.state;

    const isNew = currMode === 'new';
    const isExtract = currMode === 'extract';
    const isPatch = currMode === 'patch';

    /* TODO: fabric-ify these */
    return (
      <div className="main-bar">
        <form className={classNames('form-group-recorder-url', { 'start-recording': isNew, 'content-form': !isNew, 'remote-archive': isPatch || isExtract })}>
          <div className="input-group containerized">
            <div className="input-group-btn rb-dropdown">
              {
                canAdmin &&
                  <RemoteBrowserSelect />
              }
            </div>
            {
              /* {% if not browser %}autofocus{% endif %} */
              <input type="text" onChange={this.handleChange} className="url-input-recorder form-control" name="url" value={urlInput} autoFocus required />
            }
            {/*
              isExtract &&
                <div class="input-group-btn extract-selector">
                    {{ sources_widget(target=coll_title, active=True, req_timestamp=(ts or (wbrequest.wb_url.timestamp if webrequest else None))) }}
                </div>
              */
            }
            {
              isPatch &&
                <PatchWidget params={params} />
            }
          </div>
        </form>
      </div>
    );
  }
}

export default RecordURLBar;
