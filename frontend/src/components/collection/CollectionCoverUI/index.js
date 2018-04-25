import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import Truncate from 'components/Truncate';
import WYSIWYG from 'components/WYSIWYG';
import { ListIcon, WarcIcon } from 'components/icons';

import './style.scss';


class CollectionCoverUI extends Component {
  static propTypes = {
    collection: PropTypes.object,
    history: PropTypes.object
  };

  render() {
    const { collection } = this.props;
    const user = collection.get('user');
    const collId = collection.get('id');
    const lists = collection.get('lists').filter(o => o.get('public') && o.get('bookmarks') && o.get('bookmarks').size);

    return (
      <div className="coll-cover">
        <div className="capstone">
          <h4><WarcIcon /> Collection</h4>
          <div>by <Link to={`/${user}`}>{user}</Link></div>
        </div>
        <h1>{collection.get('title')}</h1>
        <div className="description">
          <WYSIWYG
            initial={collection.get('desc')}
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
                        <Link to={loc}><h3><ListIcon />&nbsp;&nbsp;{list.get('title')}</h3></Link>
                        <div className="desc">
                          {
                            list.get('desc') &&
                              <Truncate height={75}>
                                <WYSIWYG
                                  initial={list.get('desc')}
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
        <Link className="browse" to={`/${user}/${collId}/pages`}>Browse Entire Collection</Link>
      </div>
    );
  }
}


export default CollectionCoverUI;
