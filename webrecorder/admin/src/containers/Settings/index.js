import React, { Component, PropTypes } from 'react';
import Helmet from 'react-helmet';
import { Button, Col, Grid, Row } from 'react-bootstrap';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import AddRemoveWidget from 'components/AddRemoveWidget';
import FormFields from 'components/FormFields';
import Heading from 'components/Heading';
import { loadSettings, updateSettings } from './actions';

import './style.scss';


class Settings extends Component {

  static propTypes = {
    getSettings: PropTypes.func,
    setSettings: PropTypes.func,
    settings: PropTypes.object,
  }

  constructor(props) {
    super(props);

    this.modified = this.modified.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.state = {
      changes: false,
    }
  }

  onSubmit() {
    const settings = this.refs.settings.serialize();
    const tags = this.refs.tags.serialize();
    const data = {
      settings: settings,
      tags: tags,
    };

    this.setState({changes: false});
    this.props.setSettings(data);
  }

  modified() {
    if(!this.state.changes)
      this.setState({changes: true});
  }

  componentDidMount() {
    this.props.getSettings();

    this.props.router.setRouteLeaveHook(this.props.route, () => {
      if(this.state.changes)
        return 'You have unsaved changes.. are you sure you want to continue?'
    });
  }

  render() {
    const { settings } = this.props;
    const { changes } = this.state;

    return (
      <div>
        <Helmet title='Update settings' />
        <Heading type={3}>Edit Settings</Heading>
        {
          settings &&
          <Grid componentClass='form'
                fluid={true}>
            <Row>
              <Col xs={6}>
                <FormFields ref='settings' items={settings.defaults} modified={this.modified} />
              </Col>
              <Col xs={6}>
                <AddRemoveWidget ref='tags' items={settings.tags} modified={this.modified} />
              </Col>
            </Row>
            <Row>
              <Col xs={4} xsOffset={4} className='save-row'>
                <Button onClick={this.onSubmit}
                        bsStyle={changes?'primary':'default'}
                        disabled={!changes}>Save</Button>
              </Col>
            </Row>
          </Grid>
        }
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  return {
    getSettings: () => dispatch(loadSettings()),
    setSettings: data => dispatch(updateSettings(data)),
  };
}

function mapStateToProps(state) {
  const { settings } = state;
  return {
    settings: settings.settings,
  };
}

const Comp = connect(mapStateToProps, mapDispatchToProps)(Settings);
export default withRouter(Comp);
