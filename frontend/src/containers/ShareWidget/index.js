import React, { Component } from 'react';
import { connect } from 'react-redux';

import ShareWidgetUI from 'components/ShareWidgetUI';

class ShareWidget extends Component {

  render() {
    const { collection } = this.props;

    return (
      <ShareWidgetUI
        isPublic={false}
        coll={collection.collection}
        shareUrl="http://example.com"
        embedUrl="http://example/com" />
    );
  }
}

const mapStateToProps = (state) => {
  const { collection } = state;
  return {
    collection
  };
}

export default connect(
  mapStateToProps
)(ShareWidget);
