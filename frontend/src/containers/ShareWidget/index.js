import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import ShareWidgetUI from 'components/ShareWidgetUI';

class ShareWidget extends Component {
  static PropTypes = {
    collection: PropTypes.object
  }

  render() {
    const { collection } = this.props;

    return (
      <ShareWidgetUI
        isPublic={false}
        coll={collection.get('collection')}
        shareUrl="http://example.com"
        embedUrl="http://example/com" />
    );
  }
}

const mapStateToProps = (state) => {
  return {
    collection: state.get('collection')
  };
};

export default connect(
  mapStateToProps
)(ShareWidget);
