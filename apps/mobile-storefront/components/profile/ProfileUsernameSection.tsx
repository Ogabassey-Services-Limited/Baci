import { Text, View } from 'react-native';
import { UsernamePrompt } from '@/components/account/UsernamePrompt';
import type Colors from '@/constants/Colors';
import { useAuthStore } from '@/stores/auth-store';
import { styles } from './profile-edit.styles';

type ProfileEditColors = typeof Colors.light;

interface ProfileUsernameSectionProps {
  colors: ProfileEditColors;
  onSaved: () => void;
  username?: string | null;
  nextEligibleAt?: string | null;
}

/**
 * Username display + set/update control for the profile edit screen. Extracted
 * from the route so it stays focused on wiring/navigation: setting a username
 * uses its own dedicated auth-store action (`setUsername`) via `UsernamePrompt`,
 * not the react-hook-form `updateProfile` path the rest of the form uses.
 */
export function ProfileUsernameSection({
  colors,
  onSaved,
  username,
  nextEligibleAt,
}: ProfileUsernameSectionProps) {
  const storedNextEligibleAt = useAuthStore(
    (state) => state.customer?.username_next_eligible_at
  );
  const nextEligibleTimestamp = Date.parse(
    nextEligibleAt ?? storedNextEligibleAt ?? ''
  );
  const cooldownActive =
    Boolean(username) &&
    Number.isFinite(nextEligibleTimestamp) &&
    nextEligibleTimestamp > Date.now();

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Username
      </Text>
      <View
        style={[
          styles.emailContainer,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.emailText, { color: colors.text }]}>
          {username ? `@${username}` : 'Not set yet'}
        </Text>
      </View>
      {cooldownActive ? (
        <Text style={[styles.emailText, { color: colors.textSecondary }]}>
          {`You can change this username again on ${new Intl.DateTimeFormat(
            undefined,
            { dateStyle: 'medium' }
          ).format(nextEligibleTimestamp)}.`}
        </Text>
      ) : (
        <View style={styles.usernamePromptSpacing}>
          <UsernamePrompt
            initialValue={username ?? ''}
            onSuccess={onSaved}
            submitLabel={username ? 'Update username' : 'Save username'}
          />
        </View>
      )}
    </View>
  );
}
