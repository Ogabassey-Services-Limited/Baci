import renderer from 'react-test-renderer';

import { MonoText } from '../StyledText';

// eslint-disable-next-line no-undef
it(`renders correctly`, () => {
  const tree = renderer.create(<MonoText>Snapshot test!</MonoText>).toJSON();

  // eslint-disable-next-line no-undef
  expect(tree).toMatchSnapshot();
});
