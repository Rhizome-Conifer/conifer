import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { Link } from 'react-router-dom';
import { Button, Col, ProgressBar, Row } from 'react-bootstrap';

import SizeFormat from 'components/SizeFormat';

import { Upload } from 'containers';
import { NewCollection } from 'components/siteComponents';

import './style.scss';


class CollectionListUI extends Component {
  static contextTypes = {
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
    const newCollection = nextProps.collections.get('newCollection');

    // if incoming prop has a newCollection object and we are currently creating
    // a collection, reroute to new collection
    if (newCollection && creatingCollection) {
      history.push(`/${user}/${newCollection}/`);
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
    const { auth, collections, orderedCollections, match: { params }, user } = this.props;
    const { showModal } = this.state;
    const userParam = params.user;

    const canAdmin = auth.getIn(['user', 'username']) === userParam; // && !anon;
    const spaceUsed = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);

    return (
      <div>
        <Row className="collection-description page-archive">
          <Col xs={12}>
            <h2>{ userParam } Archive</h2>
            <p>Available collections are listed below.</p>
          </Col>
        </Row>
        <Row>
          <Col xs={6} className="wr-coll-meta">
            {
              canAdmin &&
                <React.Fragment>
                  <Button onClick={this.toggle} bsStyle="primary" bsSize="small">
                    <span className="glyphicon glyphicon-plus glyphicon-button" /> New Collection
                  </Button>
                  <Upload>
                    <span className="glyphicon glyphicon-upload" /> Upload
                  </Upload>
                </React.Fragment>
            }
          </Col>
          {
            canAdmin &&
              <Col xs={2} className="pull-right">
                <strong>Space Used: </strong>
                <SizeFormat bytes={spaceUsed} />
                <ProgressBar now={(spaceUsed / totalSpace) * 100} bsStyle="success" />
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
                            <Link to={`/${userParam}/${coll.get('id')}`} className="collection-title">{coll.get('title')}</Link>
                          </Col>
                          <Col xs={2}>
                            <SizeFormat bytes={coll.get('size')} />
                          </Col>
                          <Col xs={1}>
                            { coll.get('r:@public') === '1' &&
                              <span className="glyphicon glyphicon-globe" title="Public Collection &mdash; Visible to Everyone" />
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
          creatingCollection={collections.get('creatingCollection')} />

      </div>
    );
  }
}


export default CollectionListUI;
