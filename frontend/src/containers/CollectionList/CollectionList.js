import React, { Component, PropTypes } from 'react';
import { Link } from 'react-router';
import { Button, Col, ProgressBar, Row } from 'react-bootstrap';

import './style.scss';


class CollectionList extends Component {

  render() {
    const { user } = this.props.params;

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
            <span>1.2 GB</span>
            <ProgressBar now={20} bsStyle="success" />
          </Col>
        </Row>
        <Row>
          <ul className="list-group collection-list">
            <li className="left-buffer list-group-item">
              <Row>
                <Col xs={9}>
                  <Link to="/m4rk3r/coll" className="collection-title">coll title</Link>
                </Col>
                <Col xs={2}>
                  0 MB
                </Col>
                <Col xs={1}>
                  <span className="glyphicon glyphicon-globe" title="Public Collection &mdash; Visible to Everyone" />
                </Col>
              </Row>
            </li>
          </ul>
        </Row>
      </div>
    );
  }
}

export default CollectionList;
