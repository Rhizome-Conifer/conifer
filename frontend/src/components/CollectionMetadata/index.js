import React, { Component } from 'react';
import { Link } from 'react-router';
import PropTypes from 'prop-types';

import EditableString from 'components/EditableString';

class CollectionMetadata extends Component {
  static propTypes = {
    title: PropTypes.string,
    desc: PropTypes.string
  };

  static contextTypes = {
    canAdmin: PropTypes.bool
  }

  render() {
    const { desc, dlUrl, title } = this.props;
    const { canAdmin, canWrite } = this.context;

    return (
      <div>
        <div className="row top-buffer-sm">
          <div className="col-xs-6">
            <h1 className="top-buffer-none pull-left">
              <EditableString
                string={title}
                contentType="Collection Title"
                className="editable-title" />
            </h1>
          </div>
          <div className="col-xs-6 pull-xs-right wr-coll-actions">
            <button id="delete-coll-btn" className="btn btn-sm btn-default" data-toggle="modal" data-target="#confirm-delete-collection-modal">
              <span className="glyphicon glyphicon-trash glyphicon-button" aria-hidden="true" />&nbsp;
              <span className="hidden-xs">Delete Collection</span>
            </button>

            {
              canAdmin &&
                <Link to={dlUrl}>
                  <button className="btn btn-success btn-sm btn-collection-download" role="button">
                    <span className="glyphicon glyphicon-cloud-download glyphicon-button" />&nbsp;
                    <span className="hidden-xs">Download Collection</span>
                  </button>
                </Link>
            }

            {
              canWrite &&
                <div className="access-switch">
                  public?
                </div>
            }
          </div>
        </div>
        <div className="row">
          <div className="col-xs-12 col-sm-10 collection-description">
            <EditableString
              string={desc}
              contentType="Collection Description"
              className="" />
          </div>
        </div>
      </div>
    );
  }
}


export default CollectionMetadata;
