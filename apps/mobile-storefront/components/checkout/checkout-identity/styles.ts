import { StyleSheet } from 'react-native';
import { buttonStyles } from './styles/button-styles';
import { feedbackStyles } from './styles/feedback-styles';
import { footerStyles } from './styles/footer-styles';
import { formStyles } from './styles/form-styles';
import { layoutStyles } from './styles/layout-styles';
import { optionStyles } from './styles/option-styles';
import { socialStyles } from './styles/social-styles';
import { tabStyles } from './styles/tab-styles';

export const styles = StyleSheet.create({
  ...layoutStyles,
  ...tabStyles,
  ...optionStyles,
  ...buttonStyles,
  ...socialStyles,
  ...feedbackStyles,
  ...formStyles,
  ...footerStyles,
});
