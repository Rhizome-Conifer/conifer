import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Toggle from 'react-toggle';
import { fromJS } from 'immutable';
import { Link } from 'react-router-dom';

import OutsideClick from 'components/OutsideClick';
import { ShareIcon } from 'components/icons';

import 'shared/scss/toggle.scss';
import './style.scss';


class ShareWidgetUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool
  };

  static propTypes = {
    bsSize: PropTypes.string,
    collection: PropTypes.object,
    embedUrl: PropTypes.string,
    isPublic: PropTypes.bool,
    setPublic: PropTypes.func,
    shareUrl: PropTypes.string,
    showLoginModal: PropTypes.func,
  };

  static defaultProps = fromJS({
    bsSize: ''
  });

  constructor(props) {
    super(props);

    this.state = {
      open: false,
      sizeSet: false,
      widgetHeight: 0
    };
  }

  componentDidMount() {
    if (!this.props.isPublic) {
      this.setState({
        sizeSet: true,
        widgetHeight: this.shareables.getBoundingClientRect().height
      });
    }
  }

  componentWillReceiveProps(nextProps, nextState) {
    if (nextProps.isPublic && nextProps.collection !== this.props.collection) {
      this.thirdPartyJS();
      this.buildSocialWidgets();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevState.open && this.state.open) {
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

  toggle = () => {
    this.setState({ open: !this.state.open });
  }

  render() {
    const { canAdmin, isAnon } = this.context;
    const { bsSize, collection, embedUrl, isPublic, shareUrl, showLoginModal } = this.props;
    const { open, sizeSet, widgetHeight } = this.state;

    const shareClasses = classNames('share-container', { open });
    const widgetClasses = classNames('public-switch clearfix', { hidden: isPublic });
    const shareableClasses = classNames('shareables', { disabled: !isPublic && sizeSet });

    return (
      <OutsideClick handleClick={this.close}>
        <div id="share-widget" className={shareClasses} title="Sharing options">
          <div id="fb-root" />
          <button
            type="button"
            className={`btn btn-default btn-${bsSize} dropdown-toggle sharing-widget`}
            data-toggle="dropdown"
            aria-label="Sharing widget"
            onClick={this.toggle}>
            <ShareIcon />
            { bsSize === 'xs' && <span>&nbsp;Share</span> }
          </button>
          <div className="dropdown-menu share-modal arrow_box">
            <span onClick={this.close} role="button" className="glyphicon glyphicon-remove-circle" tabIndex={0} />
            {
              canAdmin &&
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

              <label htmlFor="shareable-url">Copy and paste to share:</label>
              <input type="text" id="shareable-url" value={shareUrl} readOnly />

              <label htmlFor="shareable-embed-code">Embed code:</label>
              <textarea id="shareable-embed-code" readOnly value={`<iframe  src="${embedUrl}" onload="" width='640' height='480' seamless="seamless" frameborder="0" scrolling="yes" className="pager_iframe"></iframe>`} />
            </div>
          </div>
        </div>
      </OutsideClick>
    );
  }
}

export default ShareWidgetUI;
