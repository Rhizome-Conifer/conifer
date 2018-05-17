import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';

import { defaultCollDesc } from 'config';

import Capstone from 'components/collection/Capstone';
import HttpStatus from 'components/HttpStatus';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon } from 'components/icons';

import './style.scss';


class CollectionCoverUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    collection: PropTypes.object,
    history: PropTypes.object,
    orderdPages: PropTypes.object
  };

  collectionLink = () => {
    const { canAdmin } = this.context;
    const { collection, orderdPages } = this.props;

    if (!canAdmin && orderdPages.size) {
      const pg = orderdPages.get(0);
      return `/${collection.get('user')}/${collection.get('id')}/${pg.get('timestamp')}/${pg.get('url')}`;
    }

    return `/${collection.get('user')}/${collection.get('id')}/pages`;
  }

  render() {
    const { collection } = this.props;

    if (collection.get('error')) {
      return (
        <HttpStatus>
          {collection.getIn(['error', 'error_message'])}
        </HttpStatus>
      );
    }

    const user = collection.get('user');
    const collId = collection.get('id');
    const lists = collection.get('lists') ? collection.get('lists').filter(o => o.get('public') && o.get('bookmarks') && o.get('bookmarks').size) : [];

    return (
      <div className="coll-cover">
        <Helmet>
          <title>{`${collection.get('title')} (Web archive collection by ${collection.get('user')})`}</title>
        </Helmet>
        <Capstone user={collection.get('user')} />
        <h1>{collection.get('title')}</h1>
        <div className="description">
          <WYSIWYG
            initial={collection.get('desc') || defaultCollDesc}
            externalEditButton
            editMode={false} />
        </div>
        {
          lists &&
            <div className="lists-container">
              <h3 className="lists-header">Lists in this Collection</h3>
              <ul className="lists">
                {
                  lists.map((list) => {
                    const bk = list.getIn(['bookmarks', '0']);
                    const loc = `/${user}/${collId}/list/${list.get('id')}-${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}`;
                    return (
                      <li key={list.get('id')}>
                        <Link to={loc}>
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
                              <Truncate height={75}>
                                <WYSIWYG
                                  initial={list.get('desc')}
                                  externalEditButton
                                  editMode={false} />
                              </Truncate>
                          }
                          <Link to={loc} className="list-link">view list &raquo;</Link>
                        </div>
                      </li>
                    );
                  })
                }
              </ul>
            </div>
        }
        {
          (this.context.canAdmin || collection.get('public_index')) &&
            <Link className="browse" to={this.collectionLink()}>Browse Entire Collection</Link>
        }
      </div>
    );
  }
}


export default CollectionCoverUI;
