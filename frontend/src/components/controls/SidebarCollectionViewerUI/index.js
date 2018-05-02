import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

import SidebarHeader from 'components/SidebarHeader';
import Truncate from 'components/Truncate';
import { AllPagesIcon, CatalogIcon, WarcIcon } from 'components/icons';

import './style.scss';


class SidebarCollectionViewerUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeListId: PropTypes.string,
    collection: PropTypes.object,
    orderdPages: PropTypes.object
  };

  render() {
    const { canAdmin } = this.context;
    const { activeListId, collection } = this.props;

    const lists = collection.get('lists');
    const publicIndex = collection.get('public_index');
    const pg = this.props.orderdPages.get(0);

    return (
      <div className="sidebar-coll-navigator">
        <SidebarHeader label="Collection Navigator" />
        <div className="overflow-wrapper">
          <nav>
            <Link to={`/${collection.get('user')}/${collection.get('id')}/pages`}>catalog view <CatalogIcon /></Link>
          </nav>
          <header className="collection-header">
            <h5><WarcIcon /> {collection.get('title')}</h5>
          </header>
          <Truncate height={75} className="description">
            {collection.get('desc')}
          </Truncate>
          <header className="lists-header">
            <h4>Lists ({lists.size})</h4>
          </header>
          <ul>
            {
              lists.map((list) => {
                const classes = classNames({ selected: activeListId === list.get('id'), 'is-public': list.get('public') });
                const bk = list.getIn(['bookmarks', '0']);
                const loc = `/${collection.get('user')}/${collection.get('id')}/list/${list.get('id')}-${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}`;

                return (
                  <li className={classes} key={list.get('id')}>
                    <div className="wrapper">
                      <Link to={loc} title={list.get('title')}>
                        { list.get('title') }
                      </Link>
                    </div>
                  </li>
                );
              })
            }
            {
              (publicIndex || canAdmin) && pg &&
                <React.Fragment>
                  <li className="divider" />
                  <li className={classNames('all-pages', { selected: !activeListId })}>
                    <div className="wrapper">
                      <Link to={`/${collection.get('user')}/${collection.get('id')}/${pg.get('timestamp')}/${pg.get('url')}`} title="Browse this collection" className="button-link"><AllPagesIcon /> See all pages in this collection</Link>
                    </div>
                  </li>
                </React.Fragment>
            }
          </ul>
        </div>
      </div>
    );
  }
}

export default SidebarCollectionViewerUI;
