import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { fromJS } from 'immutable';
import { Link } from 'react-router-dom';
import { Button, Col, ProgressBar, Row } from 'react-bootstrap';

import { getCollectionLink } from 'helpers/utils';

import { Upload } from 'containers';

import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
import SizeFormat from 'components/SizeFormat';
import { NewCollection } from 'components/siteComponents';
import { GlobeIcon } from 'components/icons';

import './style.scss';


class CollectionListUI extends Component {
  static contextTypes = {
    isAnon: PropTypes.bool,
    router: PropTypes.object
  }

  static propTypes = {
    auth: PropTypes.object,
    collections: PropTypes.object,
    createNewCollection: PropTypes.func,
    orderedCollections: PropTypes.object,
    match: PropTypes.object,
    user: PropTypes.object
  };

  static defaultProps = fromJS({
    collections: []
  });

  constructor(props) {
    super(props);

    this.state = {
      showModal: false,
      isPublic: false,
      collTitle: 'New Collection'
    };
  }

  componentWillReceiveProps(nextProps) {
    const { collections, history, match: { params: { user } } } = this.props;
    const creatingCollection = collections.get('creatingCollection');
    const prevNewCollection = collections.get('newCollection');
    const newCollection = nextProps.collections.get('newCollection');

    // if incoming prop has a newCollection object and we are currently creating
    // a collection, reroute to new collection
    if (creatingCollection && newCollection && prevNewCollection !== newCollection) {
      history.push(`/${user}/${newCollection}/pages`);
    }
  }

  createCollection = (collTitle, isPublic) => {
    const { createNewCollection, match: { params: { user } } } = this.props;

    createNewCollection(user, collTitle, isPublic);
  }

  toggle = (evt) => {
    this.setState({ showModal: !this.state.showModal });
  }

  close = (evt) => {
    this.setState({ showModal: false });
  }

  render() {
    const { isAnon } = this.context;
    const { auth, collections, orderedCollections, match: { params }, user } = this.props;
    const { showModal } = this.state;
    const userParam = params.user;

    if (collections.get('error')) {
      return (
        <HttpStatus>
          {collections.getIn(['error', 'error_message'])}
        </HttpStatus>
      );
    }

    if (collections.get('loaded') && isAnon) {
      return <RedirectWithStatus to={`/${auth.getIn(['user', 'username'])}/temp`} status={301} />;
    }

    const canAdmin = auth.getIn(['user', 'username']) === userParam; // && !anon;
    const spaceUsed = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);
    const remaining = spaceUsed / totalSpace;

    let progressState = 'success';
    if (remaining >= 0.75) {
      if (remaining < 0.9) {
        progressState = 'warning';
      } else {
        progressState = 'danger';
      }
    }

    return (
      <React.Fragment>
        <Helmet>
          <title>{`${userParam}'s Collections`}</title>
        </Helmet>
        <Row className="collection-description page-archive">
          <Col xs={12}>
            <h2>{ userParam } Archive</h2>
            <p>Available collections are listed below.</p>
          </Col>
        </Row>
        <Row>
          <Col xs={6} className="wr-coll-meta">
            {
              !isAnon && canAdmin &&
                <React.Fragment>
                  <Button onClick={this.toggle} bsStyle="primary" bsSize="small">
                    <span className="glyphicon glyphicon-plus glyphicon-button" /> New Collection
                  </Button>
                  <Upload classes="btn btn-sm btn-success">
                    <span className="glyphicon glyphicon-upload" /> Upload
                  </Upload>
                </React.Fragment>
            }
          </Col>
          {
            !isAnon && canAdmin &&
              <Col xs={2} className="pull-right">
                <strong>Space Used: </strong>
                <SizeFormat bytes={spaceUsed} />
                <ProgressBar now={(remaining) * 100} bsStyle={progressState} />
              </Col>
          }
        </Row>

        {
          collections && collections.get('loaded') &&
            <Row>
              <ul className="list-group collection-list">
                {
                  orderedCollections.map((coll) => {
                    return (
                      <li className="left-buffer list-group-item" key={coll.get('id')}>
                        <Row>
                          <Col xs={9}>
                            <Link to={getCollectionLink(coll, canAdmin)} className="collection-title">{coll.get('title')}</Link>
                          </Col>
                          <Col xs={2}>
                            <SizeFormat bytes={coll.get('size')} />
                          </Col>
                          <Col xs={1}>
                            {
                              canAdmin && coll.get('public') &&
                                <span title="Public Collection &mdash; Visible to Everyone">
                                  <GlobeIcon />
                                </span>
                            }
                          </Col>
                        </Row>
                      </li>
                    );
                  })
                }
              </ul>
            </Row>
        }

        <NewCollection
          close={this.close}
          visible={showModal}
          createCollection={this.createCollection}
          creatingCollection={collections.get('creatingCollection')}
          error={collections.get('error')} />

      </React.Fragment>
    );
  }
}


export default CollectionListUI;
