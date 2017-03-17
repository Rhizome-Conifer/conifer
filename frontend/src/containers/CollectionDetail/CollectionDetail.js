import React, { Component } from 'react';


class CollectionDetail extends Component {

  render() {
    const collection = {};
    return (
      <div>
        <div className="row top-buffer-sm">
          <div className="col-xs-9">
            <h1 className="top-buffer-none pull-left">
              <span className="editable-title">Title</span>
              <button
                type="button"
                className="edit-title btn btn-default btn-xs icon-button"
                aria-label="Edit collection title"
                title="Edit collection title">
                <span className="glyphicon glyphicon-pencil" aria-hidden="true" />
              </button>
            </h1>
          </div>
          <div className="col-xs-3 pull-xs-right">
            <div className="access-switch" />
          </div>
        </div>

        <div className="row">
          <div className="col-xs-6 collection-description">
            <div id="about">
              <div id="home-markdown" className="collapse">{ collection.desc }</div>
              <div id="home-view" />
            </div>
          </div>
        </div>


      </div>
    );
  }
}

export default CollectionDetail;
