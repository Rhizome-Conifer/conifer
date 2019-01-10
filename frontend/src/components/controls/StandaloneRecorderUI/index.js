import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { Button, FormControl, HelpBlock, Row } from 'react-bootstrap';

import { appHost, defaultRecDesc } from 'config';
import { addTrailingSlash, apiFetch, fixMalformedUrls } from 'helpers/utils';

import { CollectionDropdown, ExtractWidget, RemoteBrowserSelect } from 'containers';

import WYSIWYG from 'components/WYSIWYG';

import './style.scss';


class StandaloneRecorderUI extends Component {
  static contextTypes = {
    isAnon: PropTypes.bool
  };

  static propTypes = {
    activeCollection: PropTypes.object,
    extractable: PropTypes.object,
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
      url: ''
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

  startRecording = (evt) => {
    evt.preventDefault();
    const { activeCollection, extractable, history, selectedBrowser } = this.props;
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
      <form className="start-recording-homepage" onSubmit={this.startRecording}>
        <div className={classNames('col-md-8 col-md-offset-2', { 'input-group': extractable })}>
          <FormControl id="url" aria-label="url" type="text" name="url" onChange={this.handleInput} style={{ height: '33px' }} value={url} placeholder="URL to capture" title={isOutOfSpace ? 'Out of space' : 'Enter URL to capture'} required disabled={isOutOfSpace} />
          <label htmlFor="url" aria-label="url" className="control-label sr-only">Url</label>
          <ExtractWidget
            toCollection={activeCollection.title}
            url={url} />
        </div>

        <div className="col-md-8 col-md-offset-2 top-buffer">
          <Row>
            <p className="col-md-2 standalone-dropdown-label">Add to collection </p>
            <div className="col-md-10">
              {
                isAnon ?
                  <Button onClick={this.triggerLogin} className="anon-button"><span>Login to add to Collection...</span></Button> :
                  <CollectionDropdown label={false} />
              }
              {
                this.state.setColl &&
                  <HelpBlock style={{ color: 'red' }}>
                    Choose a collection
                  </HelpBlock>
              }
            </div>
          </Row>
        </div>

        <div className="col-md-8 col-md-offset-2 top-buffer rb-dropdown">
          <Row>
            <p className="col-md-2 standalone-dropdown-label">Select browser</p><div className="col-md-10"><RemoteBrowserSelect /></div>
          </Row>
        </div>

        <div className="col-md-8 col-md-offset-2 top-buffer">
          <Collapsible
            easing="ease-in-out"
            lazyRender
            onClose={this.closeAdvance}
            onOpen={this.openAdvance}
            open={initialOpen}
            overflowWhenOpen="visible"
            transitionTime={300}
            trigger={advOptions}>
            <h4>Session Notes</h4>
            <textarea rows={5} ref={(o) => { this.textarea = o; }} onFocus={this.handleFocus} name="sessionNotes" placeholder={defaultRecDesc} value={this.state.sessionNotes} onChange={this.handleInput} />
          </Collapsible>
          <Button type="submit" aria-label="start recording" disabled={isOutOfSpace}>
            Start
          </Button>
        </div>
      </form>
    );
  }
}

export default StandaloneRecorderUI;
