import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { appHost } from 'config';
import { remoteBrowserMod } from 'helpers/utils';
import { setPublic } from 'redux/modules/collection';
import { showModal } from 'redux/modules/userLogin';

import { ShareWidgetUI } from 'components/controls';


class ShareWidget extends Component {

  static propTypes = {
    activeBrowser: PropTypes.string,
    activeListId: PropTypes.string,
    collection: PropTypes.object,
    params: PropTypes.object,
    setCollPublic: PropTypes.func,
    timestamp: PropTypes.string,
    url: PropTypes.string
  }

  render() {
    const { activeBrowser, activeListId, collection, params: { user, coll }, showLoginModal, timestamp, url } = this.props;

    const tsMod = remoteBrowserMod(activeBrowser, timestamp, '/');
    const activeList = activeListId ? `list/${activeListId}/` : '';

    const shareUrl = `${appHost}/${user}/${coll}/${activeList}${tsMod}${url}`;
    const embedUrl = `${appHost}/_embed/${user}/${coll}/${activeList}${tsMod}${url}`;
    const isPublic = collection.get('isPublic') === '1';

    return (
      <ShareWidgetUI
        isPublic={isPublic}
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
    activeListId: app.getIn(['controls', 'activeListId']),
    collection: app.get('collection'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setCollPublic: (collId, user) => dispatch(setPublic(collId, user)),
    showLoginModal: () => dispatch(showModal(true))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ShareWidget);
