import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import { getCollectionLink, getListLink } from 'helpers/utils';

import TimeFormat from 'components/TimeFormat';
import Truncate from 'components/Truncate';
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
              from <Link to={getCollectionLink(collection)}>{collection.get('title')}</Link> by <Link to={`/${collection.get('owner')}`}>{collection.get('owner')}</Link>
            </div>
          </div> :
          <Link to={getListLink(collection, list)}>
            <div className="list-title">
              <div>
                <ListIcon />
              </div>
              <h3>{list.get('title')}</h3>
            </div>
          </Link>
      }
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
    </div>
  );
};


ListEntry.propTypes = {
  collection: PropTypes.object,
  isDetail: PropTypes.bool,
  list: PropTypes.object
};


export default ListEntry;
