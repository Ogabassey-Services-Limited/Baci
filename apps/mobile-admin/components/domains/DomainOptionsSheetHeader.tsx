import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { Domain } from './domain-types';
import { domainOptionsSheetStyles } from './domain-options-sheet.styles';

interface DomainOptionsSheetHeaderProps {
  domain: Domain;
}

export default function DomainOptionsSheetHeader({
  domain,
}: DomainOptionsSheetHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        domainOptionsSheetStyles.header,
        { borderBottomColor: colors.border },
      ]}
    >
      <View
        style={[
          domainOptionsSheetStyles.iconBadge,
          {
            backgroundColor:
              domain.status === 'active'
                ? colors.successLight
                : colors.warningLight,
          },
        ]}
      >
        <Ionicons
          name="globe-outline"
          size={24}
          color={domain.status === 'active' ? colors.success : colors.warning}
        />
      </View>
      <View>
        <Text style={[domainOptionsSheetStyles.domainName, { color: colors.text }]}>
          {domain.domain}
        </Text>
        <Text
          style={[
            domainOptionsSheetStyles.domainType,
            { color: colors.textSecondary },
          ]}
        >
          {domain.domain_type === 'subdomain' ? 'Store Link' : 'Custom Domain'} •{' '}
          {domain.status}
        </Text>
      </View>
    </View>
  );
}
