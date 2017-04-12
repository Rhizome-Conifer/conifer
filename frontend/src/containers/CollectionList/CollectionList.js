import React, { Component, PropTypes } from 'react';
import { asyncConnect } from 'redux-connect';
import { Link } from 'react-router';
import { Button, Col, ProgressBar, Row } from 'react-bootstrap';
import sortBy from 'lodash/sortBy';
import sumBy from 'lodash/sumBy';

import { isLoaded, load } from 'redux/modules/collections';

import SizeFormat from 'components/SizeFormat';

import './style.scss';


class CollectionList extends Component {

  static propTypes = {
    collections: PropTypes.object,
    auth: PropTypes.object
  }

  static defaultProps = {
    collections: []
  }

  render() {
    const { user } = this.props.params;
    const { collections } = this.props.collections;

    return (
      <div>
        <Row className="collection-description page-archive">
          <Col xs={12}>
            <h2>{ user } Archive</h2>
            <p>Available collections are listed below.</p>
          </Col>
        </Row>
        <Row>
          <Col xs={6} className="wr-coll-meta">
            <Button bsStyle="primary" bsSize="small">
              <span className="glyphicon glyphicon-plus glyphicon-button" /> New Collection
            </Button>
          </Col>
          <Col xs={2} className="pull-right">
            <strong>Space Used: </strong>
            <SizeFormat bytes={sumBy(collections, 'size')} />
            <ProgressBar now={20} bsStyle="success" />
          </Col>
        </Row>
        <Row>
          <ul className="list-group collection-list">
            { sortBy(collections, ['created_at']).map((coll) => {
              return (
                <li className="left-buffer list-group-item" key={coll.id}>
                  <Row>
                    <Col xs={9}>
                      <Link to={`${user}/${coll.id}`} className="collection-title">{coll.title}</Link>
                    </Col>
                    <Col xs={2}>
                      <SizeFormat bytes={coll.size} />
                    </Col>
                    <Col xs={1}>
                      { coll['r:@public'] === '1' &&
                        <span className="glyphicon glyphicon-globe" title="Public Collection &mdash; Visible to Everyone" />
                      }
                    </Col>
                  </Row>
                </li>);
            })
            }
          </ul>
        </Row>
      </div>
    );
  }
}

const loadCollections = [
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      const { auth } = getState();

      if(!isLoaded(getState()) && auth.user.username)
        return dispatch(load(auth.user.username));

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  const { auth, collections } = state;
  return {
    auth,
    collections
  };
};

export default asyncConnect(
  loadCollections,
  mapStateToProps
)(CollectionList);
