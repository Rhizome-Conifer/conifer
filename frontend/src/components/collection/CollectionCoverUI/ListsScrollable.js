import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { getListLink } from 'helpers/utils';

import TimeFormat from 'components/TimeFormat';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon } from 'components/icons';


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
                    <Link to={getListLink(collection, list)}>
                      <div className="list-title">
                        <div>
                          <ListIcon />
                        </div>
                        <h3>{list.get('title')}</h3>
                      </div>
                    </Link>
                    <div className="desc">
                      {
                        list.get('desc') &&
                          <Truncate height={1000}>
                            <WYSIWYG
                              readOnly
                              initial={list.get('desc')} />
                          </Truncate>
                      }
                    </div>
                    <ol>
                      {
                        list.get('bookmarks').map((bk) => {
                          const replay = `${getListLink(collection, list)}/b${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}`;
                          return (
                            <li key={bk.get('id')}>
                              <h4><Link to={replay}>{bk.get('title')}</Link></h4>
                              <a className="source-link" href={bk.get('url')} target="_blank">{bk.get('url')}</a>
                              <TimeFormat classes="bk-timestamp" dt={bk.get('timestamp')} />
                              {
                                bk.get('desc') &&
                                  <WYSIWYG readOnly initial={bk.get('desc')} />
                              }
                            </li>
                          );
                        })
                      }
                    </ol>
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
