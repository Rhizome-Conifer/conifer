import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

import { defaultCollDesc } from 'config';
import { getCollectionLink, getListLink } from 'helpers/utils';

import SidebarHeader from 'components/SidebarHeader';
import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { AllPagesIcon, CatalogIcon, WarcIcon } from 'components/icons';

import './style.scss';


class SidebarCollectionViewerUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool
  };

  static propTypes = {
    activeList: PropTypes.string,
    collection: PropTypes.object,
    orderdPages: PropTypes.object,
    showNavigator: PropTypes.func
  };

  returnToItem = () => {
    this.props.showNavigator(false);
  }

  render() {
    const { canAdmin } = this.context;
    const { activeList, collection } = this.props;

    const lists = collection.get('lists');
    const publicIndex = collection.get('public_index');
    const pg = this.props.orderdPages.get(0);

    return (
      <div className="sidebar-coll-navigator">
        <SidebarHeader label="Collection Navigator" />
        <div className="overflow-wrapper">
          {
            (canAdmin || publicIndex) &&
              <nav>
                <Link to={getCollectionLink(collection, true)}>Collection Index <CatalogIcon /></Link>
              </nav>
          }
          <header className="collection-header">
            <h5><WarcIcon /> {collection.get('title')}</h5>
          </header>
          <Truncate height={75} className="description">
            <WYSIWYG
              readOnly
              key={collection.get('id')}
              initial={collection.get('desc')} />
          </Truncate>
          <header className="lists-header">
            <h4>Lists ({lists.size})</h4>
          </header>
          <ul>
            {
              (publicIndex || canAdmin) && pg &&
                <React.Fragment>
                  <li className={classNames('all-pages', { selected: !activeList })}>
                    <div className="wrapper">
                      {
                        !activeList ?
                          <button className="borderless selected-item" onClick={this.returnToItem} type="button"><AllPagesIcon /> All Pages in Collection</button> :
                          <Link to={`${getCollectionLink(collection)}/${pg.get('timestamp')}/${pg.get('url')}`} title="Browse this collection" className="button-link"><AllPagesIcon /> All Pages in Collection</Link>
                      }
                    </div>
                  </li>
                  <li className="divider" />
                </React.Fragment>
            }
            {
              lists.map((list) => {
                const selected = activeList === list.get('slug');
                const classes = classNames({ selected, 'is-public': list.get('public') });
                const bk = list.getIn(['bookmarks', '0']);
                const loc = bk ?
                  `${getListLink(collection, list)}/b${bk.get('id')}/${bk.get('timestamp')}/${bk.get('url')}` :
                  getListLink(collection, list);

                return (
                  <li className={classes} key={list.get('id')}>
                    <div className="wrapper">
                      {
                        selected ?
                          <button className="borderless selected-item" onClick={this.returnToItem} type="button">{list.get('title')}</button> :
                          <Link to={loc} title={list.get('title')}>
                            { list.get('title') }
                          </Link>
                      }
                    </div>
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

export default SidebarCollectionViewerUI;
