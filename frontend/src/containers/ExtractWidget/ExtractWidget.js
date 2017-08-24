import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { getActiveCollection } from 'redux/selectors';
import { getArchives, setExtractable,
         setAllSourcesOption } from 'redux/modules/controls';

import ExtractWidgetUI from 'components/ExtractWidgetUI';

import { stripProtocol } from 'helpers/utils';


class ExtractWidget extends Component {
  static propTypes = {
    active: PropTypes.bool,
    archives: PropTypes.object,
    archiveSources: PropTypes.object,
    archivesLoading: PropTypes.bool,
    extractable: PropTypes.object,
    getArchives: PropTypes.func,
    setExtractWidget: PropTypes.func,
    timestamp: PropTypes.number,
    toCollection: PropTypes.string,
    url: PropTypes.string,
    useAllSources: PropTypes.func
  };

  componentDidMount() {
    const { archives, archivesLoading } = this.props;

    if(!archivesLoading && archives.size === 0)
      this.props.getArchives();
  }

  componentWillReceiveProps(nextProps) {
    if(nextProps.url !== this.props.url)
      this.parseURL(nextProps.url);
  }

  parseURL = (url) => {
    const { archives, archiveSources, extractable, setExtractWidget } = this.props;

    if(!archives || archives.size === 0)
      return;

    const baseURL = stripProtocol(url);
    const match = archives.findKey(arch => baseURL.length >= arch.get('prefix').length && baseURL.startsWith(arch.get('prefix')));

    if(match) {
      const archive = archives.get(match);

      let targetURL = baseURL.replace(archive.get('prefix'), '');
      let targetColl = null;

      if(archive.get('parse_collection')) {
        targetColl = targetURL.split('/', 1)[0];
        targetURL = targetURL.substr(targetColl.length + 1);
      }

      const timestamp = targetURL.match(/^(\d{4,14})(\w{2}_)?\//)[1];
      targetURL = targetURL.replace(/\d+(\w+)?\//, '');

      // enable widget
      setExtractWidget({
        allSources: true, // test if exists and enabled?
        archive,
        fullUrl: url,
        id: match,
        targetColl,
        targetURL,
        timestamp
      });
    } else if(extractable) {
      // disable widget
      setExtractWidget(null);
    }
  }

  render() {
    const { active, archiveSources, extractable,
            toCollection, url, useAllSources } = this.props;

    return (
      <div className="input-group-btn extract-selector">
        {
          extractable &&
            <ExtractWidgetUI
              active={active}
              archiveSources={archiveSources}
              extractable={extractable}
              toCollection={toCollection}
              url={url}
              toggleAllSources={useAllSources} />
        }
        {
          extractable &&
            <button className="btn btn-default" type="submit" role="button" aria-label="Extract">
              <span className="glyphicon glyphicon-save" aria-hidden="true" /><span className="hidden-xs"> extract</span>
            </button>
        }
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  const controls = state.get('controls');

  return {
    archivesLoading: controls.get('archivesLodaing'),
    archives: controls.get('archives'),
    archiveSources: controls.get('archiveSources'),
    extractable: controls.get('extractable'),
    toCollection: getActiveCollection(state).title
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    getArchives: () => dispatch(getArchives()),
    setExtractWidget: obj => dispatch(setExtractable(obj)),
    useAllSources: b => dispatch(setAllSourcesOption(b))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ExtractWidget);
