import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Toggle from 'react-toggle';
import classNames from 'classnames';
import Collapsible from 'react-collapsible';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { truncate, getStorage, inStorage, setStorage } from 'helpers/utils';
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
    recordings: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      groupDisplay: true
    };
  }

  componentWillMount() {
    if (typeof window !== 'undefined' && inStorage('groupDisplay')) {
      try {
        this.setState({ groupDisplay: JSON.parse(getStorage('groupDisplay')) });
      } catch (e) {
        console.log('Erroneous `groupDisplay` storage value');
      }
    }
  }

  componentWillUnmount() {
    const { groupDisplay } = this.state;
    setStorage('groupDisplay', groupDisplay);
  }

  onToggle = (e) => {
    let bool;
    if (typeof e.target.checked !== 'undefined') {
      bool = e.target.checked;
    } else {
      bool = !this.state.groupDisplay;
    }

    this.setState({ groupDisplay: bool });
  }

  render() {
    const { browsers, collection, recordings, params: { user, coll } } = this.props;
    const { groupDisplay } = this.state;

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
            <div className="toggle-label">
              <span onClick={this.onToggle}>Group by session</span>
              <Toggle
                checked={groupDisplay}
                onChange={this.onToggle}
                icons={false} />
            </div>

            <span className="search-box">
              <input type="text" name="filter" />
              <span className="glyphicon glyphicon-search" />
            </span>
          </nav>
          {
            recordings.map((rec) => {
              const pageCount = rec.get('pages').size;

              // if flat display is on
              if (!groupDisplay) {
                if (pageCount > 0) {
                  return (
                    <PageList
                      browsers={browsers}
                      coll={collection}
                      pages={rec.get('pages')} />
                  );
                }
                return null;
              }

              // otherwise render nested display
              const header = (
                <header className={classNames({ collapsible: pageCount > 0 })}>
                  { pageCount > 0 && <span className="glyphicon glyphicon-triangle-right" />}
                  <h2>{rec.get('title')}</h2>
                  <TimeFormat classes="session-ts" epoch={rec.get('updated_at')} />
                  <SizeFormat bytes={rec.get('size')} />
                </header>
              );
              return (
                <div className="wr-coll-session">
                  <Collapsible
                    lazyRender
                    transitionTime={300}
                    easing="ease-in-out"
                    trigger={header}>
                    <PageList
                      browsers={browsers}
                      coll={collection}
                      pages={rec.get('pages')} />
                  </Collapsible>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  }
}

export default CollectionDetailUI;
