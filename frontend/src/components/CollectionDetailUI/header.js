import React from 'react';
import PropTypes from 'prop-types';

import ReactMarkdown from 'react-markdown';


function CollDetailHeader({ activeList, collection, list }) {
  return (
    <header>
      <h1>{collection.get('title')}{activeList ? ` > ${list.get('title')}` : null }</h1>
      <hr />
      <ReactMarkdown className="coll-desc" source={activeList ? list.get('desc') : collection.get('desc')} />
    </header>
  );
}

CollDetailHeader.propTypes = {
  activeList: PropTypes.bool,
  collection: PropTypes.object,
  list: PropTypes.object
};

export default CollDetailHeader;
