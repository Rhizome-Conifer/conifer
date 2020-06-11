import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Form, InputGroup } from 'react-bootstrap';

import { remoteBrowserMod } from 'helpers/utils';

import { InfoWidget, RemoteBrowserSelect } from 'containers';

import TimeFormat from 'components/TimeFormat';

import './style.scss';


class ReplayURLBar extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    canAdmin: PropTypes.bool,
    bookmarks: PropTypes.object,
    history: PropTypes.object,
    params: PropTypes.object,
    recordingIndex: PropTypes.number,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = { url: props.url };
  }

  componentDidUpdate(prevProps) {
    if (this.props.url !== prevProps.url) {
      this.setState({ url: this.props.url });
    }
  }

  handleInput = (evt) => {
    evt.preventDefault();
    this.setState({ url: evt.target.value });
  }

  handleSubmit = (evt) => {
    const { activeBrowser, history, params: { user, coll } } = this.props;
    const { url } = this.state;

    if (evt.key === 'Enter') {
      evt.preventDefault();
      history.push(`/${user}/${coll}/${remoteBrowserMod(activeBrowser, null, '/')}${url}`);
    }
  }

  render() {
    const { canAdmin, params, timestamp } = this.props;
    const { url } = this.state;

    return (
      <Form className="form-group-recorder-url">
        <InputGroup>
          {
            canAdmin && !__DESKTOP__ &&
              <div className="rb-dropdown">
                <RemoteBrowserSelect
                  active
                  currMode={this.props.currMode}
                  params={params} />
              </div>
          }

          <div className="wr-app-url">
            <Form.Control type="text" onChange={this.handleInput} onKeyPress={this.handleSubmit} name="url" aria-haspopup="true" value={url} autoComplete="off" />
            <div className="wr-replay-info">
              <InfoWidget />
              <span className="replay-date main-replay-date d-none d-sm-inline-block">
                <TimeFormat dt={timestamp} />
              </span>
            </div>
          </div>
        </InputGroup>
      </Form>
    );
  }
}

export default ReplayURLBar;
