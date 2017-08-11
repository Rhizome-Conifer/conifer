import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { fromJS } from 'immutable';

import OutsideClick from 'components/OutsideClick';
import { ShareIcon } from 'components/Icons';

import './style.scss';


class ShareWidgetUI extends Component {

  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    isPublic: PropTypes.bool,
    shareUrl: PropTypes.string,
    embedUrl: PropTypes.string,
    bsSize: PropTypes.string,
    coll: PropTypes.object
  };

  static defaultProps = fromJS({
    bsSize: ''
  });

  constructor(props) {
    super(props);

    this.state = { open: false };
  }

  toggleOpen = () => {
    this.setState({ open: !this.state.open });
  }

  close = () => {
    if(this.state.open)
      this.setState({ open: false });
  }

  render() {
    const { bsSize, coll, embedUrl, isPublic, shareUrl } = this.props;
    const { open } = this.state;
    const { canAdmin } = this.context;

    const shareClasses = classNames('share-container', { open });
    const widgetClasses = classNames('public-switch clearfix', { hidden: isPublic });
    const shareableClasses = classNames('shareables', { disabled: !isPublic });

    return (
      <OutsideClick handleClick={this.close}>
        <div id="share-widget" className={shareClasses} title="Sharing options">
          <div id="fb-root" />
          <button
            type="button"
            className={`btn btn-default btn-${bsSize} dropdown-toggle sharing-widget`}
            data-toggle="dropdown"
            aria-label="Sharing widget"
            onClick={this.toggleOpen}>
            <ShareIcon />
            { bsSize === 'xs' && <span>&nbsp;Share</span> }
          </button>
          <div className="dropdown-menu share-modal arrow_box">
            <span onClick={this.close} role="button" className="glyphicon glyphicon-remove-circle" />
            {
              canAdmin &&
                <div className={widgetClasses}>
                  {
                  /* if anon
                    <p className="make-public-desc">
                      This is a temporary collection. To preserve and share, <a href="/_register" target="_parent">Sign Up</a> or <a className="login-link" href="/_login_modal">Login</a>.
                    </p>
                    else */
                  }
                  <p className="make-public-desc">
                    Collection <strong >{ coll.title }</strong> is set to private. To get a share link, make the collection public:
                  </p>
                  <div className="access-switch">
                    {/* include 'public_private_switch.html' */}
                  </div>
                </div>
            }
            <div className={shareableClasses}>
              <div className="platforms clearfix">
                <div id="wr-tw" />
                <div id="wr-fb" />
              </div>

              <label htmlFor="shareable-url">Copy and paste to share:</label>
              <input type="text" id="shareable-url" value={shareUrl} />

              <label htmlFor="shareable-embed-code">Embed code:</label>
              <textarea id="shareable-embed-code" value={`<iframe  src="${embedUrl}" onload="" width='640' height='480' seamless="seamless" frameborder="0" scrolling="yes" className="pager_iframe"></iframe>`} />
            </div>
          </div>
        </div>
      </OutsideClick>
    );
  }
}

export default ShareWidgetUI;
