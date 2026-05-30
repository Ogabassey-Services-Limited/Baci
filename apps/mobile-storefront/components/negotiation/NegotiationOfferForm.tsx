import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { palette } from '@/constants/Colors';
import { negotiationModalViewStyles as styles } from './NegotiationModalView.styles';

type NegotiationOfferFormProps = {
  offer: string;
  onOfferChange: (value: string) => void;
  onSubmitPress: () => void;
};

export function NegotiationOfferForm({
  offer,
  onOfferChange,
  onSubmitPress,
}: NegotiationOfferFormProps) {
  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Text style={styles.inputLabel}>Your Offer (₦)</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.priceInput}
          value={offer}
          onChangeText={onOfferChange}
          placeholder="Enter amount..."
          placeholderTextColor={palette.gray[400]}
          keyboardType="numeric"
        />
      </View>
      <Pressable
        style={styles.submitButton}
        onPress={onSubmitPress}
        accessibilityLabel="Submit your offer"
        accessibilityRole="button"
      >
        <Text style={styles.submitButtonText}>Submit Offer</Text>
      </Pressable>
    </Animated.View>
  );
}
