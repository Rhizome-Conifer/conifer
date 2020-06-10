import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Toggle from 'react-toggle';
import { fromJS } from 'immutable';
import { Link } from 'react-router-dom';
import { Button, DropdownButton, InputGroup, Form } from 'react-bootstrap';

import { AppContext } from 'store/contexts';

import OutsideClick from 'components/OutsideClick';
import { ShareIcon } from 'components/icons';

import 'shared/scss/toggle.scss';
import './style.scss';


class ShareWidgetUI extends Component {
  static contextType = AppContext;

  static propTypes = {
    canAdmin: PropTypes.bool,
    collection: PropTypes.object,
    embedUrl: PropTypes.string,
    isPublic: PropTypes.bool,
    setPublic: PropTypes.func,
    shareUrl: PropTypes.string,
    showLoginModal: PropTypes.func,
  };

  constructor(props) {
    super(props);

    this.state = {
      open: false,
      sizeSet: false,
      widgetHeight: 0
    };
  }

  componentDidMount() {
    if (!this.props.isPublic && this.shareables) {
      this.setState({
        sizeSet: true,
        widgetHeight: this.shareables.getBoundingClientRect().height
      });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.open && this.state.open && this.props.isPublic) {
      this.thirdPartyJS();
      this.buildSocialWidgets();
    }
  }

  setPublic = () => {
    const { collection } = this.props;
    this.props.setPublic(collection.get('owner'), collection.get('id'));
  }

  thirdPartyJS = () => {
    /* eslint-disable */
    window.twttr = (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0],
        t = window.twttr || {};
      if (d.getElementById(id)) return t;
      js = d.createElement(s);
      js.id = id;
      js.src = "https://platform.twitter.com/widgets.js";
      fjs.parentNode.insertBefore(js, fjs);

      t._e = [];
      t.ready = function(f) {
        t._e.push(f);
      };

      return t;
    }(document, "script", "twitter-wjs"));

    // load fb
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "//connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
    /* eslint-enable */
  }

  buildSocialWidgets = () => {
    const { shareUrl } = this.props;

    // clear previous widget
    if (this.wrTW.childNodes.length) {
      this.wrTW.removeChild(this.wrTW.childNodes[0]);
    }

    if (typeof window.twttr !== 'undefined') {
      window.twttr.ready(() => (
        window.twttr.widgets.createShareButton(
          shareUrl,
          document.getElementById('wr-tw'),
          {
            text: '',
            size: 'large',
            via: 'webrecorder_io'
          }
        )
      ));
    }

    // fb sdk loaded?
    if (typeof window.FB === 'undefined') {
      window.fbAsyncInit = () => {
        window.FB.init({ xfbml: true, version: 'v2.8' });
        window.fbInitialized = true;
      };
    } else if (!window.fbInitialized) {
      window.FB.init({ xfbml: true, version: 'v2.8' });
      window.fbInitialized = true;
    } else {
      window.FB.XFBML.parse(this.wrFB);
    }
  }

  close = () => {
    if (this.state.open) {
      this.setState({ open: false });
    }
  }

  toggle = (open) => {
    this.setState({ open });
  }

  render() {
    const { isAnon } = this.context;
    const { canAdmin, collection, embedUrl, isPublic, shareUrl, showLoginModal } = this.props;
    const { open, sizeSet, widgetHeight } = this.state;

    const shareClasses = classNames('share-container', { open });
    const widgetClasses = classNames('public-switch clearfix', { hidden: isPublic });
    const shareableClasses = classNames('shareables', { disabled: !isPublic && sizeSet });

    return (
      <div id="share-widget" className={shareClasses} title="Sharing options">
        <div id="fb-root" />
        <DropdownButton
          title={<ShareIcon />}
          variant="outline-secondary"
          aria-label="Sharing widget"
          onToggle={this.toggle}>
          {
            canAdmin && !isPublic &&
              <div className={widgetClasses}>
                {
                  isAnon ?
                    <p className="make-public-desc">
                      This is a temporary collection. To preserve and share, <Link to="/_register">Sign Up</Link> or <button className="button-link" onClick={showLoginModal} type="button">Login</button>.
                    </p> :
                    <div>
                      <p className="make-public-desc">
                        Collection <strong>{ collection.get('title') }</strong> is set to private. To get a share link, make the collection public:
                      </p>
                      <div className="access-switch">
                        <span className="glyphicon glyphicon-globe" aria-hidden="true" />
                        <span className="left-buffer-sm hidden-xs">Collection Public?</span>
                        <Toggle
                          icons={false}
                          defaultChecked={isPublic}
                          onChange={this.setPublic} />
                      </div>
                    </div>
                }
              </div>
          }
          {
            isPublic &&
              <div
                className={shareableClasses}
                ref={(obj) => { this.shareables = obj; }}
                style={widgetHeight !== 0 ? { height: widgetHeight } : {}}>
                <div className="platforms clearfix">
                  <div id="wr-tw" ref={(obj) => { this.wrTW = obj; }} />
                  <div id="wr-fb" ref={(obj) => { this.wrFB = obj; }}>
                    <div className="fb-share-button" data-href={shareUrl} data-layout="button" data-size="large" data-mobile-iframe="true" />
                  </div>
                </div>

                <InputGroup className="mb-3">
                  <Form.Label htmlFor="shareable-url">Copy and paste to share:</Form.Label>
                  <Form.Control type="text" id="shareable-url" value={shareUrl} readOnly />
                </InputGroup>

                <InputGroup>
                  <Form.Label htmlFor="shareable-embed-code">Embed code:</Form.Label>
                  <Form.Control as="textarea" id="shareable-embed-code" readOnly value={`<iframe  src="${embedUrl}" onload="" width='640' height='480' seamless="seamless" frameborder="0" scrolling="yes" className="pager_iframe"></iframe>`} />
                </InputGroup>
              </div>
          }
        </DropdownButton>
      </div>
    );
  }
}

export default ShareWidgetUI;
