const React = require('react');

const MockMapView = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    animateToRegion: jest.fn(),
    fitToCoordinates: jest.fn(),
  }));
  return React.createElement('MapView', props, props.children);
});
MockMapView.displayName = 'MapView';

const MockMarker = React.forwardRef((props, ref) => {
  return React.createElement('Marker', { ...props, ref }, props.children);
});
MockMarker.displayName = 'Marker';

const MockCallout = (props) => {
  return React.createElement('Callout', props, props.children);
};
MockCallout.displayName = 'Callout';

module.exports = {
  __esModule: true,
  default: MockMapView,
  MapView: MockMapView,
  Marker: MockMarker,
  Callout: MockCallout,
  PROVIDER_DEFAULT: 'default',
  PROVIDER_GOOGLE: 'google',
};
