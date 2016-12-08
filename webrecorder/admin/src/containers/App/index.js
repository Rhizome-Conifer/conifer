import React, { Component, PropTypes } from 'react';
import Helmet from 'react-helmet';
import classNames from 'classnames';
import { connect } from 'react-redux';

import Header from 'components/Header';
import Loader from 'components/Loader';

import './styles.scss';


// named export for tests
export class App extends Component {

  static propTypes = {
    children: PropTypes.node,
  }

  constructor(props) {
    super(props);
    this.state = {loading: false, transition: false};
  }

  componentWillReceiveProps(nextProps) {
    /**
     * a pinch of sugar here.. manage loading with internal state to build in
     * slight delay between loading completion and css animation conclusion..
     */
    if(this.props.loading !== nextProps.loading) {

      if(!nextProps.loading && this.state.loading){
        this.setState({loading: false, transition: true});
        setTimeout(() => this.setState({transition: false}), 150);
      } else
        this.setState({loading: nextProps.loading, transition: false});
    }
  }

  render() {
    const { loading, transition } = this.state;
    const classes = classNames('content-container', {
      'loading': loading,
      'transition': transition,
    });

    return (
      <div className='app'>
        <Helmet
          titleTemplate='%s ~ Webrecorder Admin'
          defaultTitle='Dashboard ~ Webrecorder Admin'
        />
        <Header />
        <Loader loading={loading} transition={transition} />
        <section className={classes}>
          {React.Children.toArray(this.props.children)}
        </section>
      </div>
    );
  }
}

function mapStateToProps(state) {
  const isLoading = (
    state.user.loading ||
    state.users.loading ||
    state.dashboard.loading ||
    state.settings.loading
  );
  return {
    loading: isLoading,
  };
}

export default connect(mapStateToProps)(App);
