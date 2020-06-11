import React, { Component } from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import { Form, InputGroup } from 'react-bootstrap';

import { ExtractWidget, PatchWidget, RemoteBrowserSelect } from 'containers';

import { remoteBrowserMod } from 'helpers/utils';

import './style.scss';


class RecordURLBar extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    activeCollection: PropTypes.object,
    autopilotRunning: PropTypes.bool,
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    history: PropTypes.object,
    params: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = { url: props.url || '' };
  }

  componentDidUpdate(prevProps) {
    if (this.props.url !== prevProps.url) {
      this.setState({ url: this.props.url });
    }
  }

  handleChange = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  handleSubmit = (evt) => {
    const { activeBrowser, currMode, history, params: { archiveId, coll, collId, extractMode, rec, user }, timestamp } = this.props;
    const { url } = this.state;

    if (evt.key === 'Enter') {
      evt.preventDefault();

      switch(currMode) {
        case 'live':
          history.push(`/${user}/${coll}/live/${url}`);
          break;
        case 'record':
          history.push(`/${user}/${coll}/${rec}/record/${remoteBrowserMod(activeBrowser, null, '/')}${url}`);
          break;
        case 'patch':
          history.push(`/${user}/${coll}/${rec}/patch/${remoteBrowserMod(activeBrowser, timestamp, '/')}${url}`);
          break;
        case 'extract':
          history.push(`/${user}/${coll}/${rec}/${extractMode}:${archiveId}${collId ? `:${collId}` : ''}/${remoteBrowserMod(activeBrowser, timestamp, '/')}${url}`);
          break;
        default:
          break;
      }
    }
  }

  render() {
    const { activeCollection, autopilotRunning, currMode, canAdmin, params } = this.props;
    const { url } = this.state;

    const isNew = currMode === 'new';
    const isExtract = currMode.indexOf('extract') !== -1;
    const isPatch = currMode === 'patch';

    return (
      <Form className={classNames('form-group-recorder-url', { 'start-recording': isNew, 'content-form': !isNew, 'remote-archive': isPatch || isExtract })}>
        <InputGroup>
          {
            canAdmin && !__DESKTOP__ &&
              <div className="rb-dropdown">
                {
                  <RemoteBrowserSelect
                    active
                    autopilotRunning={autopilotRunning}
                    currMode={currMode}
                    params={params} />
                }
              </div>
          }
          {
            <Form.Control type="text" disabled={autopilotRunning} onChange={this.handleChange} onKeyPress={this.handleSubmit} name="url" value={url} autoFocus required />
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
        </InputGroup>
      </Form>
    );
  }
}

export default RecordURLBar;
