import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { getActiveCollection, getRemoteArchiveStats } from 'store/selectors';
import { getArchives, setExtractable, setAllSourcesOption } from 'store/modules/controls';

import { ExtractWidgetUI } from 'components/controls';

import { stripProtocol } from 'helpers/utils';


class ExtractWidget extends Component {
  static propTypes = {
    active: PropTypes.bool,
    includeButton: PropTypes.bool,
    toCollection: PropTypes.string,

    // from state
    archives: PropTypes.object,
    archivesLoading: PropTypes.bool,
    extractable: PropTypes.object,
    getArchives: PropTypes.func,
    setExtractWidget: PropTypes.func,
    stats: PropTypes.array,
    timestamp: PropTypes.string,
    url: PropTypes.string,
    useAllSources: PropTypes.func
  };

  static defaultProps = {
    active: false
  };

  componentWillMount() {
    if (!this.props.active && this.props.extractable) {
      this.props.setExtractWidget(null);
    }
  }

  componentDidMount() {
    const { archives, archivesLoading } = this.props;

    if (!archivesLoading && archives.size === 0) {
      this.props.getArchives();
    }
  }

  componentWillReceiveProps(nextProps) {
    if (!this.props.active && nextProps.url !== this.props.url) {
      this.parseURL(nextProps.url);
    }
  }

  parseURL = (url) => {
    const { archives, extractable, setExtractWidget } = this.props;

    if (!archives || archives.size === 0) {
      return;
    }

    const baseURL = stripProtocol(url);
    const match = archives.findKey(arch => baseURL.length >= arch.get('prefix').length && baseURL.startsWith(arch.get('prefix')));

    if (match) {
      const archive = archives.get(match);

      let targetUrl = baseURL.replace(archive.get('prefix'), '');
      let targetColl = null;

      if (archive.get('parse_collection')) {
        targetColl = targetUrl.split('/', 1)[0]; // eslint-disable-line
        targetUrl = targetUrl.substr(targetColl.length + 1);
      }

      const tsMatch = targetUrl.match(/^(\d{4,14})(\w{2}_)?\//);

      if (!tsMatch) {
        return setExtractWidget(null);
      }

      const timestamp = tsMatch[1];
      targetUrl = targetUrl.replace(/\d+(\w+)?\//, '');


      // enable widget
      setExtractWidget({
        allSources: true, // test if exists and enabled?
        archive,
        id: match,
        targetColl,
        targetUrl,
        timestamp
      });
    } else if (extractable) {
      // disable widget
      setExtractWidget(null);
    }
  }

  render() {
    const {
      active,
      extractable,
      includeButton,
      stats,
      toCollection,
      url,
      useAllSources
    } = this.props;

    return (
      extractable &&
        <div className="input-group-btn extract-selector">
          <ExtractWidgetUI
            active={active}
            extractable={extractable}
            stats={stats}
            toCollection={toCollection}
            toggleAllSources={useAllSources}
            url={url} />
          {
            includeButton &&
              <button className="btn btn-default" type="submit" aria-label="Extract">
                <span className="glyphicon glyphicon-save" aria-hidden="true" /><span className="hidden-xs"> extract</span>
              </button>
          }
        </div>
    );
  }
}

const mapStateToProps = ({ app }, props) => {
  const controls = app.get('controls');

  return {
    archivesLoading: controls.get('archivesLodaing'),
    archives: controls.get('archives'),
    extractable: controls.get('extractable'),
    stats: getRemoteArchiveStats(app),
    timestamp: app.getIn(['controls', 'timestamp']),
    // use collection provided to widget, or fallback to collection active in global state
    toCollection: props.toCollection ? props.toCollection : getActiveCollection(app).title
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
