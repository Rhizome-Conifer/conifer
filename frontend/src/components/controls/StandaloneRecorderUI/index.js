import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { Button, FormControl } from 'react-bootstrap';

import { appHost, defaultRecDesc } from 'config';
import { addTrailingSlash, apiFetch, fixMalformedUrls } from 'helpers/utils';

import { CollectionDropdown, ExtractWidget,
         RemoteBrowserSelect } from 'containers';

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
    toggleLogin: PropTypes.func,
    username: PropTypes.string
  };

  constructor(props) {
    super(props);

    const hasRB = Boolean(props.selectedBrowser);
    this.state = {
      sessionNotes: '',
      url: '',
      advOpen: hasRB,
      initialOpen: hasRB
    };
  }

  handleInput = (evt) => {
    evt.preventDefault();
    this.setState({ [evt.target.name]: evt.target.value });
  }

  editRecDesc = (notes) => {
    this.setState({ sessionNotes: notes });
  }

  startRecording = (evt) => {
    evt.preventDefault();
    const { activeCollection, extractable, history, selectedBrowser } = this.props;
    const { sessionNotes, url } = this.state;

    if (!url) {
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

  triggerLogin = () => this.props.toggleLogin(true);

  render() {
    const { isAnon } = this.context;
    const { activeCollection, extractable, selectedBrowser } = this.props;
    const { advOpen, initialOpen, url } = this.state;

    const isOutOfSpace = false;

    const advOptions = (
      <div>{advOpen ? 'Hide' : 'Show'} session settings <span className={classNames('caret', { 'caret-flip': advOpen })} /></div>
    );

    return (
      <form className="start-recording-homepage clearfix" onSubmit={this.startRecording}>
        <div className={classNames('col-md-8 col-md-offset-2', { 'input-group': extractable })}>
          <FormControl type="text" name="url" onChange={this.handleInput} style={{ height: '33px' }} value={url} placeholder="URL to record" required disabled={isOutOfSpace} />
          <label htmlFor="url" className="control-label sr-only">Url</label>
          <ExtractWidget
            toCollection={activeCollection.title}
            url={url} />
        </div>

        <div className="col-md-8 col-md-offset-2 top-buffer">
          {
            isAnon ?
              <Button onClick={this.triggerLogin} className="anon-button"><span>Login to add to Collection...</span><span className="caret" /></Button> :
              <CollectionDropdown label={false} />
          }
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
            <WYSIWYG
              editMode
              externalEditButton
              contentSync={this.editRecDesc}
              initial={defaultRecDesc} />

            <h4>Preconfigured Browsers</h4>
            <div className="rb-dropdown">
              <RemoteBrowserSelect />
            </div>
          </Collapsible>
          <Button type="submit" disabled={isOutOfSpace}>
            Collect
          </Button>
        </div>
      </form>
    );
  }
}

export default StandaloneRecorderUI;
