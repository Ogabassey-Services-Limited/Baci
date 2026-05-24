import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function AddDomainScreen() {
  const { colors, shadows } = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        Choose how you want to proceed
      </Text>

      {/* Buy New Domain */}
      <Pressable
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.primary },
          shadows.sm,
        ]}
        onPress={() => router.push('/domains/buy')}
      >
        <View
          style={[styles.iconBadge, { backgroundColor: `${colors.primary}15` }]}
        >
          <Ionicons name="cart" size={24} color={colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Get a custom domain
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Search and register a new domain name. We handle the technical setup
            for you.
          </Text>
          <View
            style={[
              styles.noteContainer,
              { backgroundColor: `${colors.warning}15` },
            ]}
          >
            <Ionicons
              name="information-circle"
              size={14}
              color={colors.warning}
            />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              Activation may take up to 72 hours
            </Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={colors.textSecondary}
        />
      </Pressable>

      {/* Connect Existing */}
      <Pressable
        style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        onPress={() => router.push('/domains/connect')}
      >
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: `${colors.textSecondary}15` },
          ]}
        >
          <Ionicons name="link" size={24} color={colors.text} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Connect to a domain
          </Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Already own a domain? Connect it here. You'll need to update DNS
            records.
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={24}
          color={colors.textSecondary}
        />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  title: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xl,
    marginTop: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: { flex: 1 },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    padding: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  noteText: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
