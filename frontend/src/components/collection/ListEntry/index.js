import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { getCollectionLink, getListLink, remoteBrowserMod } from 'helpers/utils';

import ClippedLink from 'components/ClippedLink';
import TimeFormat from 'components/TimeFormat';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon } from 'components/icons';

import './style.scss';


const ListEntry = ({ collection, isDetail, list }) => {
  return (
    <div className="list-entry">
      {
        isDetail ?
          <div className="list-title">
            <div>
              <ListIcon />
            </div>
            <div className="list-metadata">
              <div className="title-container"><h1>{list.get('title')}</h1>{ list.get('public') && <span className="visibility-badge">PUBLIC</span>}</div>
              <React.Fragment>
                from <Link to={getCollectionLink(collection)}>{collection.get('title')}</Link>
                {
                  !__PLAYER__ &&
                  <React.Fragment>
                    &nbsp;by <Link to={`/${collection.get('owner')}`}>{collection.get('owner')}</Link>
                  </React.Fragment>
                }
              </React.Fragment>
            </div>
          </div> :
          <div className="list-title">
            <div>
              <ListIcon />
            </div>

            <h3><Link to={getListLink(collection, list)}>{list.get('title')}</Link></h3>
          </div>
      }
      <div className="desc">
        {
          list.get('desc') &&
            <WYSIWYG
              readOnly
              initial={list.get('desc')} />
        }
      </div>
      <ol>
        {
          list.get('bookmarks').map((bk) => {
            const replay = `${getListLink(collection, list)}/b${bk.get('id')}/${remoteBrowserMod(bk.get('browser'), bk.get('timestamp'))}/${bk.get('url')}`;
            return (
              <li key={bk.get('id')}>
                <Link className="link-group" to={replay}>
                  <h4>{bk.get('title')}</h4>
                  <ClippedLink link={bk.get('url')} className="source-link" />
                </Link>

                <TimeFormat classes="bk-timestamp" dt={bk.get('timestamp')} />
                {
                  bk.get('desc') &&
                    <WYSIWYG
                      readOnly
                      initial={bk.get('desc')} />
                }
              </li>
            );
          })
        }
      </ol>
    </div>
  );
};


ListEntry.propTypes = {
  collection: PropTypes.object,
  isDetail: PropTypes.bool,
  list: PropTypes.object
};


export default ListEntry;
