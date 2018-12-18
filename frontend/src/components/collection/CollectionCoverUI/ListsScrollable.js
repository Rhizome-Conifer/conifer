import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import ListEntry from 'components/collection/ListEntry';
import WYSIWYG from 'components/WYSIWYG';


class ListsScrollable extends PureComponent {
  static propTypes = {
    collection: PropTypes.object,
    lists: PropTypes.object,
    outerRef: PropTypes.object,
    scrollHandler: PropTypes.func
  };

  render() {
    const { collection, lists, outerRef, scrollHandler } = this.props;
    return (
      <div className="scroll-wrapper">
        <div className="lists-container" onScroll={scrollHandler} ref={outerRef}>
          <h1>{collection.get('title')}</h1>
          <div className="coll-description">
            <WYSIWYG
              readOnly
              initial={collection.get('desc')} />
          </div>
          <ul className="lists">
            {
              lists.map((list) => {
                return (
                  <li key={list.get('id')} id={`list-${list.get('id')}`}>
                    <ListEntry collection={collection} list={list} />
                  </li>
                );
              })
            }
          </ul>
        </div>
      </div>
    );
  }
}


export default React.forwardRef((props, ref) => <ListsScrollable outerRef={ref} {...props} />);
