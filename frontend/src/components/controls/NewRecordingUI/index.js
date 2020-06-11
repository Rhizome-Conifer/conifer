import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import classNames from 'classnames';
import { Button, Card, Col, InputGroup, Form, Row } from 'react-bootstrap';

import config from 'config';

import { addTrailingSlash, apiFetch, fixMalformedUrls } from 'helpers/utils';
import { AccessContext } from 'store/contexts';

import { ExtractWidget, RemoteBrowserSelect } from 'containers';

import './style.scss';


class NewRecordingUI extends Component {
  static contextType = AccessContext;

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    extractable: PropTypes.object,
    history: PropTypes.object,
    remoteBrowserSelected: PropTypes.string,
    spaceUtilization: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      url: '',
    };
  }

  handeSubmit = (evt) => {
    evt.preventDefault();
    const { collection, extractable, remoteBrowserSelected } = this.props;
    const { url } = this.state;

    const cleanUrl = addTrailingSlash(fixMalformedUrls(url));

    // data to create new recording
    const data = {
      url: cleanUrl,
      coll: collection.get('id'),
    };

    // add remote browser
    if (remoteBrowserSelected) {
      data.browser = remoteBrowserSelected;
    }

    if (extractable) {
      const mode = extractable.get('allSources') ? 'extract' : 'extract_only';
      data.url = extractable.get('targetUrl');
      data.mode = `${mode}:${extractable.get('id')}`;
      data.timestamp = extractable.get('timestamp');
    } else {
      data.mode = 'record';
    }

    // generate recording url
    apiFetch('/new', data, { method: 'POST' })
      .then(res => res.json())
      .then(({ url }) => this.props.history.push(url.replace(config.appHost, '')))
      .catch(err => console.log('error', err));
  }

  startPreview = (evt) => {
    evt.preventDefault();
    const { auth, history, collection } = this.props;
    const { url } = this.state;

    const cleanUrl = addTrailingSlash(fixMalformedUrls(url));
    history.push(`/${auth.getIn(['user', 'username'])}/${collection.get('id')}/live/${cleanUrl}`);
  }

  handleChange = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  render() {
    const { collection, extractable, spaceUtilization } = this.props;
    const { url } = this.state;
    const isOutOfSpace = spaceUtilization ? spaceUtilization.get('available') <= 0 : false;

    return (
      <React.Fragment>
        <Helmet>
          <title>New Capture</title>
        </Helmet>
        <div role="presentation" className="wr-controls navbar-default new-recording-ui">
          <Form className="container-fluid" onSubmit={this.handeSubmit}>
            <Form.Row>
              <Col>
                <InputGroup>
                  {
                    !__DESKTOP__ &&
                      <div className="rb-dropdown">
                        <RemoteBrowserSelect />
                      </div>
                  }

                  <Form.Control
                    autoFocus
                    required
                    inline
                    type="text"
                    aria-label="url-input"
                    disabled={isOutOfSpace}
                    name="url"
                    onChange={this.handleChange}
                    title={isOutOfSpace ? 'Out of space' : 'Enter URL to capture'}
                    value={url} />
                  <ExtractWidget
                    includeButton
                    toCollection={collection.get('title')}
                    url={url} />
                </InputGroup>
              </Col>
              <Col xs={1}>
                {
                  __DESKTOP__ && !extractable &&
                    <Button variant="outline-secondary" onClick={this.startPreview}>Preview</Button>
                }
                <Button size="sm" block variant="primary" type="submit" disabled={isOutOfSpace}>
                  { extractable ? "Extract" : "Capture" }
                </Button>
              </Col>
            </Form.Row>
          </Form>
        </div>
        <div className="container col-md-4 col-md-offset-4 top-buffer-lg">
          <Card>
            <Card.Header>Create a new capture</Card.Header>
            <Card.Body>Ready to add a new capture to your collection <b>{collection.get('title')}</b></Card.Body>
          </Card>
        </div>
      </React.Fragment>
    );
  }
}

export default NewRecordingUI;
