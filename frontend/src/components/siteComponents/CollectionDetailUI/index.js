import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';
import { Map } from 'immutable';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { truncate } from 'helpers/utils';
import PageList from 'components/PageList';
import TimeFormat from 'components/TimeFormat';
import SizeFormat from 'components/SizeFormat';

import './style.scss';


class CollectionDetailUI extends Component {
  static propTypes = {
    collection: PropTypes.object,
    browsers: PropTypes.object,
    auth: PropTypes.object,
    params: PropTypes.object,
    recordings: PropTypes.oneOfType([Map])
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  render() {
    const { browsers, collection, recordings, params: { user, coll } } = this.props;

    return (
      <div className="wr-coll-detail">
        <BreadcrumbsItem to={`/${user}`}>{ user }</BreadcrumbsItem>
        <BreadcrumbsItem to={`/${user}/${coll}`}>{ truncate(collection.get('title'), 60) }</BreadcrumbsItem>

        <header>
          <h1>{collection.get('title')}</h1>
          <hr />
          <p>{collection.get('desc')}</p>
        </header>
        <div className="wr-coll-detail-table">
          <nav>
            <span className="glyphicon glyphicon-inbox" />
            <span className="glyphicon glyphicon-upload" />
            <span className="glyphicon glyphicon-th-list" />
            <Toggle
              defaultChecked
              icons={false} />

            <span className="search-box">
              <input type="text" name="filter" />
              <span className="glyphicon glyphicon-search" />
            </span>
          </nav>
          {
            recordings.map(rec =>
              <div className="wr-coll-session">
                <header>
                  <h2>{rec.get('title')}</h2>
                  <TimeFormat epoch={rec.get('updated_at')} />
                  <SizeFormat bytes={rec.get('size')} />
                </header>
                <PageList
                  browsers={browsers}
                  coll={collection}
                  pages={rec.get('pages')} />
              </div>
            )
          }
        </div>
      </div>
    );
  }
}

export default CollectionDetailUI;
