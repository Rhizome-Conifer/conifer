import React, { PropTypes } from 'react';

import './style.scss';


function Heading(props) {
  const { type } = props;
  const Tag = `h${type}`;

  return (
    <Tag className='wr-heading'>{props.children}</Tag>
  );
}

Heading.propTypes = {
  type: PropTypes.number,
};

export default Heading;
