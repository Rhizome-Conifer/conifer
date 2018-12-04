import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';

import { appHost, defaultCollDesc, onboardingLink, tagline } from 'config';
import { getCollectionLink, getListLink, truncate } from 'helpers/utils';
import { collection as collectionErr } from 'helpers/userMessaging';

import { Temp404 } from 'containers';

import Capstone from 'components/collection/Capstone';
import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { OnBoarding } from 'components/siteComponents';
import { ListIcon } from 'components/icons';

import './style.scss';


class CollectionCoverUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    isAnon: PropTypes.bool,
    isMobile: PropTypes.bool
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

    return getCollectionLink(collection, true);
  }

  render() {
    const { collection, history, match: { params: { user, coll } } } = this.props;

    if (collection.get('error')) {
      return user.startsWith('temp-') ?
        <Temp404 /> :
        <HttpStatus>{collectionErr[collection.getIn(['error', 'error'])]}</HttpStatus>;
    } else if (collection.get('loaded') && !collection.get('slug_matched') && coll !== collection.get('slug')) {
      return (
        <RedirectWithStatus to={getCollectionLink(collection)} status={301} />
      );
    }

    const lists = collection.get('lists') ? collection.get('lists').filter(o => o.get('public') && o.get('bookmarks') && o.get('bookmarks').size) : [];

    return (
      <div className="coll-cover">
        <Helmet>
          {
            !__PLAYER__ ?
              <title>{`${collection.get('title')} (Web archive collection by ${collection.get('owner')})`}</title> :
              <title>{collection.get('title')}</title>
          }
          <meta property="og:url" content={`${appHost}${getCollectionLink(collection)}`} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={collection.get('title')} />
          <meta property="og:description" content={collection.get('desc') ? truncate(collection.get('desc'), 3, new RegExp(/([.!?])/)) : tagline} />
        </Helmet>
        {
          onboardingLink && !this.context.isMobile &&
            <OnBoarding />
        }
        {
          this.context.canAdmin && !this.context.isAnon && !collection.get('public') &&
          <div className="visibility-warning">
            Note: this collection is set to 'private' so only you can see it. <Link to={getCollectionLink(collection, true)}>If you set this collection to 'public'</Link> you can openly share the web pages you have collected.
          </div>
        }
        <Capstone user={collection.get('owner')} />
        <h1>{collection.get('title')}</h1>
        <div className="description">
          <WYSIWYG
            readOnly
            placeholder={defaultCollDesc}
            initial={collection.get('desc')} />
        </div>
        {
          (this.context.canAdmin || collection.get('public_index')) &&
            <Link className="browse" to={this.collectionLink()}>{ this.context.canAdmin ? 'Collection Index' : 'Browse Collection' }</Link>
        }
        {
          lists.size > 0 &&
            <div className="lists-container">
              <h3 className="lists-header">Lists in this Collection</h3>
              <ul className="lists">
                {
                  lists.map((list) => {
                    const bk = list.getIn(['bookmarks', '0']);
                    const loc = `${getListLink(collection, list)}/b${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}`;
                    const bkCount = list.get('total_bookmarks');
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
                              <Truncate height={1000}>
                                <WYSIWYG
                                  readOnly
                                  initial={list.get('desc')} />
                              </Truncate>
                          }
                          <button onClick={() => history.push(getListLink(collection, list))} className="rounded list-link" type="button">View list ({`${bkCount} Bookmark${bkCount === 1 ? '' : 's'}`}) &raquo;</button>
                        </div>
                      </li>
                    );
                  })
                }
              </ul>
            </div>
        }
      </div>
    );
  }
}


export default CollectionCoverUI;
