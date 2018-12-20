import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

import { getListLink } from 'helpers/utils';

import './style.scss';


class SidebarCollectionViewerUI extends PureComponent {
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
    const { activeList, collection } = this.props;

    const lists = collection.get('lists');

    return (
      <div className="sidebar-coll-navigator">
        <div className="overflow-wrapper">
          <header className="lists-header">
            <h4>Lists ({lists.size})</h4>
          </header>
          <ul>
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
