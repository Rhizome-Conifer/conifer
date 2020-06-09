import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { Button, Col, Form, Row } from 'react-bootstrap';

import { appHost, defaultRecDesc } from 'config';

import { addTrailingSlash, apiFetch, fixMalformedUrls } from 'helpers/utils';
import { AppContext } from 'store/contexts';

import { CollectionDropdown, ExtractWidget, RemoteBrowserSelect } from 'containers';

import './style.scss';

const ipcRenderer = __DESKTOP__ ? window.require('electron').ipcRenderer : null;


class StandaloneRecorderUI extends Component {
  static contextType = AppContext;

  static propTypes = {
    activeCollection: PropTypes.object,
    extractable: PropTypes.object,
    history: PropTypes.object,
    selectedBrowser: PropTypes.string,
    spaceUtilization: PropTypes.object,
    toggleLogin: PropTypes.func,
    username: PropTypes.string
  };

  constructor(props) {
    super(props);

    const hasRB = Boolean(props.selectedBrowser);
    this.state = {
      advOpen: hasRB,
      initialOpen: hasRB,
      sessionNotes: '',
      setColl: false,
      url: '',
      validation: null
    };
  }

  handleFocus = (evt) => {
    if (!this.state.highlight) {
      this.textarea.setSelectionRange(0, this.state.sessionNotes.length);
      this.setState({ highlight: true });
    }
  }

  handleInput = (evt) => {
    evt.preventDefault();
    this.setState({ [evt.target.name]: evt.target.value });
  }

  startPreview = (evt) => {
    evt.preventDefault();
    const { history, username, activeCollection } = this.props;
    const { url } = this.state;

    if (!url) {
      return this.setState({ validation: 'error' });
    }

    if (!this.context.isAnon && !activeCollection.id) {
      this.setState({ setColl: true });
      return false;
    }

    this.setState({ validation: null });

    const cleanUrl = addTrailingSlash(fixMalformedUrls(url));
    history.push(`/${username}/${activeCollection.id}/live/${cleanUrl}`);
  }

  startRecording = (evt) => {
    evt.preventDefault();
    const { activeCollection, extractable, history, selectedBrowser, username } = this.props;
    const { sessionNotes, url } = this.state;

    if (!url) {
      return false;
    }

    if (!this.context.isAnon && !activeCollection.id) {
      this.setState({ setColl: true });
      return false;
    }

    const cleanUrl = addTrailingSlash(fixMalformedUrls(url));

    // data to create new recording
    const data = {
      url: cleanUrl,
      coll: activeCollection.id,
      desc: sessionNotes
    };

    // add remote browser
    if (selectedBrowser) {
      data.browser = selectedBrowser;
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
      .then(({ url }) => history.push(url.replace(appHost, '')))
      .catch(err => console.log('error', err));
  }

  closeAdvance = () => this.setState({ advOpen: false })

  openAdvance = () => this.setState({ advOpen: true })

  triggerLogin = () => this.props.toggleLogin(true, '/');

  render() {
    const { isAnon } = this.context;
    const { activeCollection, extractable, spaceUtilization } = this.props;
    const { advOpen, initialOpen, url } = this.state;

    const isOutOfSpace = spaceUtilization ? spaceUtilization.get('available') <= 0 : false;

    const advOptions = (
      <div><span className={classNames('caret', { 'caret-flip': advOpen })} /> Session settings</div>
    );

    return (
      <Form className="start-recording-homepage" onSubmit={this.startRecording}>
        <Row>
          <Col>
            <Form.Group className={classNames({ 'input-group': extractable })}>
              <Form.Label htmlFor="url" aria-label="url" srOnly>Url</Form.Label>
              <Form.Control id="url" aria-label="url" type="text" name="url" onChange={this.handleInput} style={{ height: '33px' }} value={url} placeholder="URL to capture" title={isOutOfSpace ? 'Out of space' : 'Enter URL to capture'} required disabled={isOutOfSpace} />
              <ExtractWidget
                toCollection={activeCollection.title}
                url={url} />
            </Form.Group>
          </Col>
        </Row>

        <Row className="top-buffer">
          <Col xs={12} md={2}>
            <p className="standalone-dropdown-label">Add to collection </p>
          </Col>
          <Col xs={12} md={10}>
            {
              isAnon ?
                <Button block onClick={this.triggerLogin} variant="outline-secondary" className="anon-button"><span>Login to add to Collection...</span></Button> :
                <CollectionDropdown label={false} />
            }
            {
              this.state.setColl &&
                <Form.Text style={{ color: 'red' }}>
                  Choose a collection
                </Form.Text>
            }
          </Col>
        </Row>

        {
          !__DESKTOP__ &&
            <Row className="top-buffer rb-dropdown">
              <Col xs={12} md={2}>
                <p className="standalone-dropdown-label">Select browser</p>
              </Col>
              <Col xs={12} md={10}>
                <RemoteBrowserSelect />
              </Col>
            </Row>
        }

        <Col xs={12} className="top-buffer">
          <Collapsible
            easing="ease-in-out"
            lazyRender
            onClose={this.closeAdvance}
            onOpen={this.openAdvance}
            open={initialOpen}
            overflowWhenOpen="visible"
            transitionTime={300}
            trigger={advOptions}>
            <div className="session-settings">
              <div>
                <h4>Session Notes</h4>
                <textarea rows={5} ref={(o) => { this.textarea = o; }} onFocus={this.handleFocus} name="sessionNotes" placeholder={defaultRecDesc} value={this.state.sessionNotes} onChange={this.handleInput} />
              </div>
            </div>
          </Collapsible>

          <div className="actions">
            {
              __DESKTOP__ &&
                <Button variant="outline-secondary" onClick={this.startPreview} aria-label="start preview">Preview</Button>
            }
            <Button type="submit" variant="primary" aria-label="start recording" disabled={isOutOfSpace}>
              Start Capture
            </Button>
          </div>
        </Col>
      </Form>
    );
  }
}

export default StandaloneRecorderUI;
