import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import { ExtractWidget, PatchWidget, RemoteBrowserSelect } from 'containers';

import './style.scss';


class RecordURLBar extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    router: PropTypes.object
  };

  static propTypes = {
    activeCollection: PropTypes.object,
    params: PropTypes.object
  };

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
    const { activeCollection, params } = this.props;
    const { urlInput } = this.state;

    const isNew = currMode === 'new';
    const isExtract = currMode.indexOf('extract') !== -1;
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
            {
              isExtract &&
                <ExtractWidget
                  active
                  toCollection={activeCollection.title} />
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
