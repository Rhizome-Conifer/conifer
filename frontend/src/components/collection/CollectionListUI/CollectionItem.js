import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import removeMd from 'remove-markdown';
import { Link } from 'react-router-dom';
import { Button, Col, Row, Tooltip } from 'react-bootstrap';

import { buildDate, getCollectionLink, truncate } from 'helpers/utils';

import SizeFormat from 'components/SizeFormat';
import { DeleteCollection } from 'containers';
import { TrashIcon, PlusIcon } from 'components/icons';
import classNames from 'classnames';

class CollectionItem extends PureComponent {
  static propTypes = {
    canAdmin: PropTypes.bool,
    addToList: PropTypes.func,
    collId: PropTypes.string,
    collUser: PropTypes.string,
    editCollection: PropTypes.func,
    id: PropTypes.string,
    isOver: PropTypes.bool,
    collection: PropTypes.object,
    selected: PropTypes.bool,
    history: PropTypes.string
  };

  newSession = () => {
    const { collection, history } = this.props;
    history.push(`${getCollectionLink(collection)}/$new`);
  }

  setPublic = (bool) => {
    const { collection } = this.props;
    this.props.editCollection(collection.get('owner'), collection.get('id'), { public: bool });
  }

  render() {
    const { canAdmin, collection } = this.props;
    const pubButton = collection.get('public') ? <span><span className="is-public"> PUBLIC </span></span> : <span className="is-private"><span> PRIVATE </span></span>;
    const descClasses = classNames('left-buffer list-group-item', { 'has-description': collection.get('desc') });

    return (
      <li className={descClasses} key={collection.get('id')}>
        <Row>
          <Col sm={12} md={7}>
            {canAdmin ? <Link className="collection-title" to={`${getCollectionLink(collection)}/index`}>{collection.get('title')}</Link> : <span className="collection-title">{collection.get('title')}</span>}
            <p className="collection-list-description">
              {
                truncate(removeMd(collection.get('desc'), { useImgAltText: false }), 3, new RegExp(/([.!?])/))
              }
            </p>
            <Link to={getCollectionLink(collection)}>
              <Button className="rounded">
                View Cover Page
              </Button>
            </Link>
            {
              canAdmin &&
              <Button className="rounded expandable-button" onClick={this.newSession}><PlusIcon /><div className="expandable-text">New Session</div></Button>
            }
          </Col>
          <Col xs={6} md={1} className="collection-list-size">
            <SizeFormat bytes={collection.get('size')} />
          </Col>
          <Col className="collection-time" xs={6} md={2}>
            Created {buildDate(collection.get('created_at'), false, true)}
          </Col>
          <Col className="collection-delete-action col-xs-offset-7 col-md-offset-0" xs={5} md={2}>
            {
              canAdmin &&
                pubButton
            }
            {
              canAdmin &&
                <DeleteCollection>
                  <TrashIcon />
                  <Tooltip placement="top" className="in" id="tooltip-top">
                    DELETE
                  </Tooltip>
                </DeleteCollection>
            }
          </Col>
        </Row>
      </li>
    );
  }
}

export default CollectionItem;
