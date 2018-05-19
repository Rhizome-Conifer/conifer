import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';

import { defaultCollDesc } from 'config';
import { getCollectionLink, getListLink } from 'helpers/utils';

import Capstone from 'components/collection/Capstone';
import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
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
    match: PropTypes.object,
    orderdPages: PropTypes.object
  };

  collectionLink = () => {
    const { canAdmin } = this.context;
    const { collection, orderdPages } = this.props;

    if (!canAdmin && orderdPages.size) {
      const pg = orderdPages.get(0);
      return `${getCollectionLink(collection)}/${pg.get('timestamp')}/${pg.get('url')}`;
    }

    return getCollectionLink(collection, true);
  }

  render() {
    const { collection, match: { params: { coll } } } = this.props;

    if (collection.get('error')) {
      return (
        <HttpStatus>
          {collection.getIn(['error', 'error_message'])}
        </HttpStatus>
      );
    } else if (collection.get('loaded') && !collection.get('slug_matched') && coll !== collection.get('slug')) {
      return (
        <RedirectWithStatus to={getCollectionLink(collection)} status={301} />
      );
    }

    const user = collection.get('owner');
    const collId = collection.get('id');
    const lists = collection.get('lists') ? collection.get('lists').filter(o => o.get('public') && o.get('bookmarks') && o.get('bookmarks').size) : [];

    return (
      <div className="coll-cover">
        <Helmet>
          <title>{`${collection.get('title')} (Web archive collection by ${collection.get('owner')})`}</title>
        </Helmet>
        <Capstone user={collection.get('owner')} />
        <h1>{collection.get('title')}</h1>
        <div className="description">
          <WYSIWYG
            readOnly
            initial={collection.get('desc') || defaultCollDesc} />
        </div>
        {
          lists &&
            <div className="lists-container">
              <h3 className="lists-header">Lists in this Collection</h3>
              <ul className="lists">
                {
                  lists.map((list) => {
                    const bk = list.getIn(['bookmarks', '0']);
                    const loc = `${getListLink(collection, list)}/b${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}`;
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
                                  readOnly
                                  initial={list.get('desc')} />
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
