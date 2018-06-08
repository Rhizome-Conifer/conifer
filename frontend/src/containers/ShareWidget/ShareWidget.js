import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { appHost } from 'config';
import { remoteBrowserMod } from 'helpers/utils';
import { edit } from 'store/modules/collection';
import { showModal } from 'store/modules/userLogin';

import { ShareWidgetUI } from 'components/controls';


class ShareWidget extends Component {

  static propTypes = {
    activeBrowser: PropTypes.string,
    activeBookmarkId: PropTypes.string,
    activeList: PropTypes.string,
    collection: PropTypes.object,
    match: PropTypes.object,
    setCollPublic: PropTypes.func,
    showLoginModal: PropTypes.func,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  render() {
    const { activeBrowser, activeBookmarkId, activeList, collection,
            match: { params: { user, coll } }, showLoginModal, timestamp, url } = this.props;

    const tsMod = remoteBrowserMod(activeBrowser, timestamp, '/');
    const listFrag = activeList ? `list/${activeList}/b${activeBookmarkId}/` : '';

    const shareUrl = `${appHost}/${user}/${coll}/${listFrag}${tsMod}${url}`;
    const embedUrl = `${appHost}/_embed/${user}/${coll}/${listFrag}${tsMod}${url}`;

    return (
      <ShareWidgetUI
        isPublic={collection.get('public')}
        setPublic={this.props.setCollPublic}
        collection={collection}
        shareUrl={shareUrl}
        embedUrl={embedUrl}
        showLoginModal={showLoginModal} />
    );
  }
}

const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    activeBookmarkId: app.getIn(['controls', 'activeBookmarkId']),
    activeList: app.getIn(['controls', 'activeList']),
    collection: app.get('collection'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setCollPublic: (user, coll) => dispatch(edit(user, coll, { public: true })),
    showLoginModal: () => dispatch(showModal(true))
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(ShareWidget));
