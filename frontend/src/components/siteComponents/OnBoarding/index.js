import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import { onboardingLink } from 'config';

import Modal from 'components/Modal';


class OnBoarding extends PureComponent {
  static propTypes = {
    open: PropTypes.bool
  };

  static defaultProps = {
    open: false
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.open && nextProps.open !== prevState.show) {
      return {
        show: nextProps.open
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.handle = null;
    this.state = {
      show: props.open,
    };
  }

  componentDidMount() {
    window.addEventListener('message', this.closeOnboarding);
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
    window.removeEventListener('message', this.closeOnboarding);
  }

  closeOnboarding = () => {
    this.setState({
      show: false
    });
  }

  render() {
    return (
      <Modal
        closeCb={this.closeOnboarding}
        dialogClassName="on-boarding"
        header="Introducing New Features"
        visible={this.state.show}>
        <iframe src={onboardingLink} />
      </Modal>
    );
  }
}

export default OnBoarding;
