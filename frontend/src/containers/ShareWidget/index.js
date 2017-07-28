import React, { Component } from 'react';

import ShareWidgetUI from 'components/ShareWidgetUI';

class ShareWidget extends Component {

  render() {
    return (
      <ShareWidgetUI
        isPublic
        shareUrl="http://example.com"
        embedUrl="http://example/com" />
    );
  }
}

export default ShareWidget;
